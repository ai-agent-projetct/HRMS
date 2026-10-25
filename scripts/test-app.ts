/**
 * App unit tests — pure-logic coverage for the wage engine, payroll, masters,
 * tenure and the month-aware store helpers. Run: npx tsx scripts/test-app.ts
 * No framework (assert-based), matching scripts/check-mill-wages.ts.
 */
import { computeMonthly, computeWeekly, monthlyIncentive, denominations, payDaysFromMarks } from "../src/lib/mill-wages";
import { buildDailyPayslip, buildPayslip, monthSalary, schemeFromSource } from "../src/lib/payroll";
import { SHIFTS, shiftById, categoryById, categoryIdOf, agentById, allAgents, nextToken, tokenPrefixFor } from "../src/lib/hr-master";
import { tenure, totalExperience } from "../src/lib/hr-data";
import { attendanceFor, deductionFor, availableMonths, monthLabel, workedUnitFor } from "../src/stores/hr";
import type { AttendanceRecord } from "../src/stores/hr";
import { otRowFor } from "../src/lib/ot";

let pass = 0, fail = 0;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
function t(name: string, got: unknown, want: unknown) {
  const ok = typeof got === "number" && typeof want === "number" ? near(got, want) : got === want;
  if (ok) { pass++; } else { fail++; console.error(`  ✗ ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); }
}
function group(name: string, fn: () => void) { console.log(`\n▸ ${name}`); fn(); }
const D = (s: string) => s.split(",").map((shift) => ({ shift }));

group("mill-wages: monthly engine", () => {
  const r = computeMonthly({ rate: 550, daysWorked: 19, ot: 3, esi: 200 });
  t("totWage", r.totWage, 10450); t("otWage", r.otWage, 138); t("gross", r.gross, 10588); t("net", r.net, 10200);
  t("incentive 19d=0", monthlyIncentive(19), 0);
  t("incentive 26d=390", monthlyIncentive(26), 390);
  t("incentive 27d=405", monthlyIncentive(27), 405);
  t("incentive 28d=840", monthlyIncentive(28), 840);
  t("incentive 31d=930", monthlyIncentive(31), 930);
  t("incentive 25d=0", monthlyIncentive(25), 0);
  const r2 = computeMonthly({ rate: 550, daysWorked: 28, ot: 9, esi: 200 });
  t("28d gross", r2.gross, 16653); t("28d net", r2.net, 16170);
});

group("mill-wages: weekly engine", () => {
  const a = computeWeekly({ rate: 365, days: D("D,D,D,D,A,D,D"), busFarePerDay: 0 });
  t("6d incen1=180", a.incen1, 180); t("6d net=2370", a.net, 2370);
  const b = computeWeekly({ rate: 365, days: D("D,A,D,D,A,D,D"), busFarePerDay: 0 });
  t("5d incen1=150", b.incen1, 150);
  const c = computeWeekly({ rate: 395, days: D("D,D,A,D,D,D,D") });   // Sunday absent
  t("sun-absent incen1=0", c.incen1, 0);
  const n = computeWeekly({ rate: 335, days: D("F,F,F,F,F,D,D") });
  t("5 nights incen2=50", n.incen2, 50); t("7d incen1=210", n.incen1, 210);
});

group("mill-wages: denominations", () => {
  const d = denominations(2450);
  t("2450 → 500s", d["500"], 4); t("2450 → 100s", d["100"], 4); t("2450 → 50s", d["50"], 1);
});

group("payroll: buildDailyPayslip uses mill engine", () => {
  const s = buildDailyPayslip({ ratePerDay: 550, daysWorked: 19, otHours: 3, statutory: true });
  t("daily net = 10200", s.netPay, 10200); t("daily gross = 10588", s.grossEarnings, 10588);
  const s0 = buildDailyPayslip({ ratePerDay: 0, daysWorked: 0, otHours: 0 });
  t("zero days net = 0", s0.netPay, 0);
  // monthSalary (History + Salary Record) must equal the register: SUMITHRA Aug.
  const ms = monthSalary({ category: "ODISHA", agentId: "AGT-GUNA" }, { daysWorked: 19, otHours: 3, rate: 550 }, { mess: 0, others: 0 });
  t("monthSalary net = 10200", ms.net, 10200); t("monthSalary otAmt = 138", ms.otAmt, 138);
  t("monthSalary zero days net = 0", monthSalary({ category: "ODISHA", salaryPerDay: 600 }, { daysWorked: 0, otHours: 0 }, { mess: 0, others: 0 }).net, 0);
  const sp = buildPayslip(26000, 0, 0, { pf: true, tds: false });
  t("monthly gross > 0", sp.grossEarnings > 0, true);
});

group("hr-master: shifts / categories / agents / incentives", () => {
  t("6 shifts", SHIFTS.length, 6);
  t("shift SH-A code = D", shiftById("SH-A")?.code, "D");
  t("shift SH-B code = H", shiftById("SH-B")?.code, "H");
  t("shift SH-C code = F", shiftById("SH-C")?.code, "F");
  t("category ODISHA label", categoryById("ODISHA")?.label, "Odisha Migrant");
  t("category CASUAL_LADIES label", categoryById("CASUAL_LADIES")?.label, "Casual Ladies");
  // Imported mill data stores the label, not the id — both must resolve.
  t("categoryById by label resolves id", categoryById("Odisha Migrant")?.id, "ODISHA");
  t("categoryById by label (Hostel Girls)", categoryById("Hostel Girls")?.id, "HOSTEL_GIRLS");
  t("categoryIdOf from label", categoryIdOf("Odisha Migrant"), "ODISHA");
  t("categoryIdOf from id", categoryIdOf("ODISHA"), "ODISHA");
  t("categoryIdOf unknown passes through", categoryIdOf("Mystery"), "Mystery");
  t("agents include Gunamani", allAgents().some((a) => a.name === "Gunamani"), true);
  t("agents include Rajesh", allAgents().some((a) => a.name === "Rajesh"), true);
  t("no dummy agent", allAgents().some((a) => a.name.includes("Bhagirathi")), false);
  t("agentById unknown = undefined", agentById("NOPE"), undefined);
});

group("hr-data: tenure / experience", () => {
  t("empty doj → '—'", tenure("").label, "—");
  t("invalid doj → '—'", tenure("not-a-date").label, "—");
  t("valid doj totalDays > 0", tenure("2020-01-01").totalDays > 0, true);
  t("totalExperience is number", typeof totalExperience({ doj: "2020-01-01", prevExpYears: 2 } as never), "number");
});

group("store helpers: month-aware attendance / deductions", () => {
  const att: AttendanceRecord[] = [
    { empId: "E1", month: "2026-10", daysWorked: 5, saturdaysWorked: 0, totalSaturdays: 4, absent: 0, leave: 0, lop: 0, otHours: 0, weekDaysWorked: [5, 0, 0, 0], rate: 610 },
    { empId: "E1", month: "2026-08", daysWorked: 27, saturdaysWorked: 0, totalSaturdays: 4, absent: 0, leave: 0, lop: 0, otHours: 2, weekDaysWorked: [8, 8, 8, 3], rate: 600 },
  ];
  t("attendanceFor default = current (Oct)", attendanceFor(att, "E1")?.daysWorked, 5);
  t("attendanceFor Aug", attendanceFor(att, "E1", "2026-08")?.daysWorked, 27);
  t("attendanceFor Aug rate", attendanceFor(att, "E1", "2026-08")?.rate, 600);
  t("attendanceFor missing month = undefined", attendanceFor(att, "E1", "2025-01"), undefined);
  const months = availableMonths(att);
  t("availableMonths has Aug", months.includes("2026-08"), true);
  t("availableMonths newest first", months[0] >= months[months.length - 1], true);
  t("monthLabel 2026-08", monthLabel("2026-08"), "August 2026");
  const ded = deductionFor([{ empId: "E1", month: "2026-08", mess: 500, others: 100, othersNote: "" }], "E1", "2026-08");
  t("deductionFor mess", ded.mess, 500);
  t("deductionFor missing = zeros", deductionFor([], "E1", "2026-08").mess, 0);
  t("workedUnit override", workedUnitFor([{ empId: "E1", date: "2026-10-07", status: "Present", unit: "Unit 2", source: "manual" }], "E1", "2026-10-07", "Unit 1"), "Unit 2");
  t("workedUnit fallback to master", workedUnitFor([], "E1", "2026-10-07", "Unit 1"), "Unit 1");
});

group("registers: rules decoded from ORISSA / HOSTEL / MONTHLY / mwages (Apr–Sep 2026)", () => {
  const mk = (codes: string, ot: Record<number, number> = {}) => codes.split("").map((c, i) => ({ shift: c === "." ? "" : c, ot: ot[i] ?? 0 }));
  // SUMITRA F3716 Sep: 20 × D + 1 × X, no OT → paid 14 days + 4 h OT (register DW 14, OT 4)
  const s1 = payDaysFromMarks(mk("D".repeat(20) + "X" + "A".repeat(9)));
  t("12h basis: 20D+1X → 14 days", s1.days, 14); t("12h basis: 20D+1X → 4h OT", s1.ot, 4);
  // OT on a 12h shift is true overtime, never converts (O3464: Y28 + 116 OT → 28 / 116)
  const s2 = payDaysFromMarks(mk("Y".repeat(28) + "AA", { 0: 58, 1: 58 }));
  t("12h OT stays OT: days", s2.days, 28); t("12h OT stays OT: hours", s2.ot, 116);
  // 8h shift + 4h OT on that day pools into a full 12h day
  const s3 = payDaysFromMarks(mk("YYYF", { 3: 4 }));
  t("8h + 4h OT = 1 day", s3.days, 4); t("…leaving 0 OT", s3.ot, 0);
  t("hostel: days = present", payDaysFromMarks(mk("DDDDA"), "hostel").days, 4);
  // NANDINI MUNDA F3671 Sep (hostel): 29 × 365 + 29 × 20 = 11165 → MROUND 11170
  t("hostel incentive 28+ = ×20", monthlyIncentive(29, "hostel"), 580);
  t("hostel incentive 26 = ×10", monthlyIncentive(26, "hostel"), 260);
  t("hostel net = 11170", computeMonthly({ rate: 365, daysWorked: 29, scheme: "hostel" }).net, 11170);
  t("hostel: no ESI/agent/OT", computeMonthly({ rate: 365, daysWorked: 29, ot: 10, scheme: "hostel" }).agentComm, 0);
  // Security G01 Apr: 30 × 450 + 22h × 450/8 = 14737.5 → 14738, exact net
  const g = computeMonthly({ rate: 450, daysWorked: 30, ot: 22, scheme: "staff" });
  t("staff OT at rate÷8 → gross 14738", g.gross, 14738); t("staff net exact", g.net, 14738);
  // A028 Sep apprentice: 23 × 450 = 10350, PM diff −1 → 10351 → MROUND 10350
  t("casual/apprentice MROUND 10", computeMonthly({ rate: 450, daysWorked: 23, others: -1, scheme: "casual" }).net, 10350);
  // direct hire: no ₹10/day agent cut (ORISSA AGENT column = 0)
  t("no agent → net 7680", computeMonthly({ rate: 550, daysWorked: 14, ot: 4, esi: 200, noAgent: true }).net, 7680);
  t("with agent → net 7540", computeMonthly({ rate: 550, daysWorked: 14, ot: 4, esi: 200 }).net, 7540);
  t("scheme from register src", schemeFromSource("HOSETL_GIRLS 2026-09"), "hostel");
});

group("roll numbers: mill token series", () => {
  t("A series keeps padding", nextToken("A", ["A028", "A165", "O1025"]), "A166");
  t("M series", nextToken("M", ["M01", "M07"]), "M08");
  t("SS series", nextToken("SS", ["SS30", "SS83", "S9"]), "SS84");
  t("C ignores CS tokens", nextToken("C", ["CS1", "C07"]), "C08");
  t("Odisha women use F", tokenPrefixFor("ODISHA", "Female"), "F");
  t("Odisha men use O", tokenPrefixFor("ODISHA", "Male"), "O");
});

group("advance never makes pay negative", () => {
  const e = { salaryPerDay: 600, category: "ODISHA" };
  const r = monthSalary(e, { daysWorked: 1, otHours: 0 }, { mess: 0, others: 0, adv: 500 });
  t("recovery capped at ₹400", r.adv, 400);
  t("net 0, not −100", r.net, 0);
  t("payslip line capped", buildDailyPayslip({ ratePerDay: 600, daysWorked: 1, advanceRecovery: 500 }).netPay, 0);
});

group("OT wages: register rates", () => {
  const rec = (otHours: number, rate: number) => ({ empId: "X", month: "2026-09", daysWorked: 26, saturdaysWorked: 0, totalSaturdays: 4, absent: 0, leave: 0, lop: 0, otHours, weekDaysWorked: [7, 7, 6, 6], rate });
  const emp = (category: string) => ({ id: "X", category, salaryPerDay: 600, shiftId: "A" }) as unknown as Parameters<typeof otRowFor>[0];
  t("Odisha ÷12 → ₹50/hr", otRowFor(emp("ODISHA"), rec(10, 600), 0).ratePerHour, 50);
  t("Odisha 10h → ₹500", otRowFor(emp("ODISHA"), rec(10, 600), 0).monthlyAmount, 500);
  t("staff ÷8 → ₹100/hr", otRowFor(emp("STAFF"), rec(4, 800), 0).monthlyAmount, 400);
  t("hostel pays no OT", otRowFor(emp("HOSTEL_GIRLS"), rec(5, 400), 0).monthlyAmount, 0);
});

console.log(`\n${"=".repeat(40)}\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

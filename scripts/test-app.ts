/**
 * App unit tests — pure-logic coverage for the wage engine, payroll, masters,
 * tenure and the month-aware store helpers. Run: npx tsx scripts/test-app.ts
 * No framework (assert-based), matching scripts/check-mill-wages.ts.
 */
import { computeMonthly, computeWeekly, monthlyIncentive, denominations } from "../src/lib/mill-wages";
import { buildDailyPayslip, buildPayslip } from "../src/lib/payroll";
import { SHIFTS, shiftById, categoryById, agentById, allAgents, computeIncentives } from "../src/lib/hr-master";
import { tenure, totalExperience } from "../src/lib/hr-data";
import { attendanceFor, deductionFor, availableMonths, monthLabel, workedUnitFor } from "../src/stores/hr";
import type { AttendanceRecord } from "../src/stores/hr";

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
  const s = buildDailyPayslip({ ratePerDay: 550, daysWorked: 19, otHours: 3, saturdaysWorked: 0, totalSaturdays: 4, statutory: true });
  t("daily net = 10200", s.netPay, 10200); t("daily gross = 10588", s.grossEarnings, 10588);
  const s0 = buildDailyPayslip({ ratePerDay: 0, daysWorked: 0, otHours: 0, saturdaysWorked: 0, totalSaturdays: 4 });
  t("zero days net = 0", s0.netPay, 0);
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
  t("agents include Gunamani", allAgents().some((a) => a.name === "Gunamani"), true);
  t("agents include Rajesh", allAgents().some((a) => a.name === "Rajesh"), true);
  t("no dummy agent", allAgents().some((a) => a.name.includes("Bhagirathi")), false);
  t("agentById unknown = undefined", agentById("NOPE"), undefined);
  const inc = computeIncentives(4, 4, 28);
  t("computeIncentives returns object", typeof inc === "object", true);
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

console.log(`\n${"=".repeat(40)}\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

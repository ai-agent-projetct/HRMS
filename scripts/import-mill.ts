/**
 * Loader: feeds the mill's real data into the database.
 * Run: SP=<scratchpad> npx tsx scripts/import-mill.ts
 *
 * Master = the 331 October on-roll (daily muster). Attendance + deductions +
 * advances span every month found in COTT20 (2020→2026) plus Sept weekly and
 * October musters. Each attendance row carries that month's day-wage rate, so
 * payroll is accurate per month. Advances (monthly recovery) are folded into
 * the deduction's "others" so net tallies with the register.
 * Keeps the HR login accounts.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "fs";
import { mapRowsToEmployees } from "@/lib/employee-io";
import { loadAll, saveAll } from "@/lib/db-repo";
import { getPool } from "@/lib/db";
import type { AttendanceRecord, MonthlyDeduction, Advance, DailyAttendance } from "@/stores/hr";

const SP = process.env.SP;
if (!SP) { console.error("Set SP=<scratchpad dir>"); process.exit(1); }
const read = (f: string) => JSON.parse(readFileSync(`${SP}/${f}`, "utf8"));

type EmpFeed = { tokenNo: string; name: string; gender: string; category: string; role: string; grade: string; fatherName: string; department: string; unit: string; agent: string; wageType: string; salaryPerDay: number; doj: string; aadhaar: string; esiNo: string; status: string; salutation: string; employmentType: string };
const splitWeeks = (t: number) => { const w = [0, 0, 0, 0]; let l = t; for (let i = 0; i < 4 && l > 0; i++) { w[i] = Math.min(8, l); l -= w[i]; } return w; };

async function main() {
  const empFeed: EmpFeed[] = read("m3_employees.json");
  const attFeed: { empId: string; month: string; daysWorked: number; otHours: number; rate: number }[] = read("m3_att.json");
  const dedFeed: { empId: string; month: string; mess: number; others: number }[] = read("m3_ded.json");
  const advFeed: { empId: string; month: string; amount: number; empName: string }[] = read("m3_adv.json");
  const octDaily: { empId: string; date: string; status: string }[] = read("m3_oct_daily.json");

  const rawRows = empFeed.map((e) => ({
    name: e.name, tokenNo: e.tokenNo, gender: e.gender, category: e.category,
    role: e.role, grade: e.grade, fatherName: e.fatherName,
    department: e.department, unit: e.unit, agentName: e.agent,
    wageType: "Daily",               // all 331 are daily-wage (register rate × days)
    salaryPerDay: e.salaryPerDay, doj: e.doj, aadhaar: e.aadhaar, esiNo: e.esiNo, status: e.status,
    salutation: e.salutation, employmentType: e.employmentType,
  }));

  const res = mapRowsToEmployees(rawRows, []);
  const employees = res.toUpsert;
  const idByToken = new Map<string, string>();
  empFeed.forEach((e, i) => { if (employees[i]) idByToken.set(e.tokenNo, employees[i].id); });
  const id = (tok: string) => idByToken.get(tok);

  // Advances → map (emp|month) → amount, folded into the month's "others".
  const advByKey = new Map<string, number>();
  for (const a of advFeed) advByKey.set(`${a.empId}|${a.month}`, (advByKey.get(`${a.empId}|${a.month}`) ?? 0) + a.amount);

  // Attendance: one row per worker-month, carrying that month's rate.
  // Dedupe by (emp, month) — a token can appear twice in a sheet; keep the row
  // with more days worked.
  const attByKey = new Map<string, AttendanceRecord>();
  for (const a of attFeed) {
    const i = id(a.empId); if (!i) continue;
    const k = `${i}|${a.month}`; const prev = attByKey.get(k);
    if (prev && prev.daysWorked >= a.daysWorked) continue;
    attByKey.set(k, { empId: i, month: a.month, daysWorked: a.daysWorked, saturdaysWorked: 0, totalSaturdays: 4, absent: 0, leave: 0, lop: 0, otHours: a.otHours, weekDaysWorked: splitWeeks(a.daysWorked), rate: a.rate || undefined });
  }
  const attendance = [...attByKey.values()];

  // Deductions: mess (canteen) + others (register OTH + ADV), per month. Deduped by (emp,month).
  const dedByKey = new Map<string, MonthlyDeduction>();
  for (const d of dedFeed) {
    const i = id(d.empId); if (!i) continue;
    const adv = advByKey.get(`${d.empId}|${d.month}`) ?? 0;
    const others = d.others + adv;
    if (d.mess === 0 && others === 0) continue;
    const k = `${i}|${d.month}`; const prev = dedByKey.get(k);
    dedByKey.set(k, { empId: i, month: d.month, mess: (prev?.mess ?? 0) + d.mess, others: (prev?.others ?? 0) + others, othersNote: adv ? "incl. advance recovery" : (d.others ? "register OTH" : "") });
  }
  // advance-only months (no mess/others row) still need the deduction
  for (const [key, amt] of advByKey) {
    const [tok, month] = key.split("|"); const i = id(tok); if (!i) continue;
    const k = `${i}|${month}`;
    if (dedByKey.has(k)) continue;
    dedByKey.set(k, { empId: i, month, mess: 0, others: amt, othersNote: "advance recovery" });
  }
  const deductions = [...dedByKey.values()];

  // October day-by-day marks.
  const dailyByKey = new Map<string, DailyAttendance>();
  for (const d of octDaily) {
    const i = id(d.empId); if (!i) continue;
    const k = `${i}|${d.date}`; const prev = dailyByKey.get(k);
    if (!prev || (prev.status !== "Present" && d.status === "Present")) dailyByKey.set(k, { empId: i, date: d.date, status: d.status as DailyAttendance["status"], source: "import" });
  }
  const daily = [...dailyByKey.values()];

  const state = await loadAll();
  state.employees = employees;
  state.attendance = attendance;
  state.dailyAttendance = daily;
  state.deductions = deductions;
  state.advances = [] as Advance[];   // register advances are monthly recoveries, folded into deductions above
  await saveAll(state);
  const months = [...new Set(attendance.map((a) => a.month))].sort();
  console.log(`✔ ${employees.length} employees | ${attendance.length} attendance rows across ${months.length} months (${months[0]}…${months[months.length - 1]}) | ${deductions.length} deductions | ${daily.length} Oct daily marks`);
  await getPool().end();
}
main().catch((e) => { console.error("Import failed:", e); process.exit(1); });

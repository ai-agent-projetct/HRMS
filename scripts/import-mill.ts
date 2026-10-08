/**
 * Loader: feeds the mill's real roster + multi-month attendance (extracted from
 * their Excel) into the database, through the app's defaulting importer.
 * Run: SP=<scratchpad> npx tsx scripts/import-mill.ts
 *
 * Sources (unified, deduped by token):
 *   - Aug-26 register  → employee master, Aug attendance (2026-08), deductions, advances
 *   - Sept weekly      → Sept attendance (2026-09)
 *   - Oct daily muster → October daily marks + summary (2026-10, the current month)
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
const attRec = (empId: string, month: string, daysWorked: number, otHours: number): AttendanceRecord => ({
  empId, month, daysWorked, saturdaysWorked: 0, totalSaturdays: 4, absent: 0, leave: 0, lop: 0, otHours, weekDaysWorked: splitWeeks(daysWorked),
});

async function main() {
  const empFeed: EmpFeed[] = read("e2_employees.json");
  const augAtt: { empId: string; daysWorked: number; otHours: number }[] = read("e2_att_aug.json");
  const sepAtt: { empId: string; daysWorked: number; otHours: number }[] = read("e2_att_sep.json");
  const octDaily: { empId: string; date: string; status: string }[] = read("e2_oct_daily.json");
  const dedFeed: { empId: string; mess: number; others: number }[] = read("e2_ded.json");
  const advFeed: { empId: string; empName: string; amount: number }[] = read("e2_adv.json");

  const rawRows = empFeed.map((e) => ({
    name: e.name, tokenNo: e.tokenNo, gender: e.gender, category: e.category,
    role: e.role, grade: e.grade, fatherName: e.fatherName,
    department: e.department, unit: e.unit, agentName: e.agent, wageType: e.wageType,
    salaryPerDay: e.salaryPerDay, doj: e.doj, aadhaar: e.aadhaar, esiNo: e.esiNo, status: e.status,
    salutation: e.salutation, employmentType: e.employmentType,
  }));

  const res = mapRowsToEmployees(rawRows, []);
  const employees = res.toUpsert;
  const idByToken = new Map<string, string>();
  empFeed.forEach((e, i) => { if (employees[i]) idByToken.set(e.tokenNo, employees[i].id); });
  const id = (tok: string) => idByToken.get(tok);

  // October monthly summary from the daily muster marks (Present per worker).
  const octDays = new Map<string, number>();
  const daily: DailyAttendance[] = [];
  for (const d of octDaily) {
    const i = id(d.empId); if (!i) continue;
    daily.push({ empId: i, date: d.date, status: d.status as DailyAttendance["status"], source: "import" });
    if (d.status === "Present") octDays.set(i, (octDays.get(i) ?? 0) + 1);
  }

  const attendance: AttendanceRecord[] = [];
  for (const a of augAtt) { const i = id(a.empId); if (i) attendance.push(attRec(i, "2026-08", a.daysWorked, a.otHours)); }
  for (const a of sepAtt) { const i = id(a.empId); if (i) attendance.push(attRec(i, "2026-09", a.daysWorked, a.otHours)); }
  for (const [i, days] of octDays) attendance.push(attRec(i, "2026-10", days, 0));

  const deductions: MonthlyDeduction[] = [];
  for (const d of dedFeed) { const i = id(d.empId); if (i && (d.mess || d.others)) deductions.push({ empId: i, month: "2026-08", mess: d.mess, others: d.others, othersNote: d.others ? "From register (OTH)" : "" }); }

  const advances: Advance[] = advFeed.map((a, k) => { const i = id(a.empId); return i ? { id: `ADV-${4000 + k}`, empId: i, empName: a.empName, date: "2026-08-01", amount: a.amount, reason: "Imported from register", monthlyRecovery: Math.min(a.amount, 2000), recovered: 0, status: "Active" as const } : null; }).filter(Boolean) as Advance[];

  const state = await loadAll();
  state.employees = employees;
  state.attendance = attendance;
  state.dailyAttendance = daily;   // October day-by-day muster marks (now DB-persisted)
  state.deductions = deductions;
  state.advances = advances;
  await saveAll(state);
  const octCount = [...octDays.values()].length;
  console.log(`✔ ${employees.length} employees | attendance: Aug ${augAtt.length}, Sep ${sepAtt.length}, Oct ${octCount} | ${daily.length} daily marks | ${deductions.length} deductions | ${advances.length} advances`);
  await getPool().end();
}
main().catch((e) => { console.error("Import failed:", e); process.exit(1); });

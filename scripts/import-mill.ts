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
  const augDaily: { empId: string; date: string; status: string }[] = read("e2_aug_daily.json");
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

  // Staff monthly salary (from "New Microsoft Excel Worksheet" STAFF sheet) —
  // matched by name so monthly staff have a real gross instead of 0.
  const normName = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const byName = new Map(employees.map((e) => [normName(e.name), e]));
  // Fallback: match on the longest name word (surname), which survives initial/
  // ordering differences between sheets; skip words that aren't unique.
  const longest = (name: string) => (name.toUpperCase().split(/[^A-Z]+/).filter((w) => w.length >= 4).sort((a, b) => b.length - a.length)[0] ?? "");
  const byLongest = new Map<string, typeof employees[number] | null>();
  for (const e of employees) { const w = longest(e.name); if (!w) continue; byLongest.set(w, byLongest.has(w) ? null : e); }
  const staffSalary: { name: string; doj: string | null; uan: string; monthlyGross: number }[] = read("e2_staff_salary.json");
  let staffMatched = 0;
  for (const s of staffSalary) {
    if (s.monthlyGross < 1000) continue;
    const e = byName.get(normName(s.name)) ?? byLongest.get(longest(s.name)) ?? undefined;
    if (!e) continue;
    e.monthlyGross = s.monthlyGross; e.ctc = s.monthlyGross * 13; e.wageType = "Monthly"; e.salaryPerDay = undefined;
    if (s.uan) e.uan = s.uan;
    if (!e.doj && s.doj) e.doj = s.doj;
    staffMatched++;
  }

  // October monthly summary from the daily muster marks (Present per worker).
  const octDays = new Map<string, number>();
  const daily: DailyAttendance[] = [];
  for (const d of octDaily) {
    const i = id(d.empId); if (!i) continue;
    daily.push({ empId: i, date: d.date, status: d.status as DailyAttendance["status"], source: "import" });
    if (d.status === "Present") octDays.set(i, (octDays.get(i) ?? 0) + 1);
  }
  // August day-by-day marks (calendar history; the Aug monthly summary comes from the register).
  for (const d of augDaily) {
    const i = id(d.empId); if (!i) continue;
    daily.push({ empId: i, date: d.date, status: d.status as DailyAttendance["status"], source: "import" });
  }

  const attendance: AttendanceRecord[] = [];
  for (const a of augAtt) { const i = id(a.empId); if (i) attendance.push(attRec(i, "2026-08", a.daysWorked, a.otHours)); }
  for (const a of sepAtt) { const i = id(a.empId); if (i) attendance.push(attRec(i, "2026-09", a.daysWorked, a.otHours)); }
  for (const [i, days] of octDays) attendance.push(attRec(i, "2026-10", days, 0));

  const deductions: MonthlyDeduction[] = [];
  for (const d of dedFeed) { const i = id(d.empId); if (i && (d.mess || d.others)) deductions.push({ empId: i, month: "2026-08", mess: d.mess, others: d.others, othersNote: d.others ? "From register (OTH)" : "" }); }

  const advances: Advance[] = advFeed.map((a, k) => { const i = id(a.empId); return i ? { id: `ADV-${4000 + k}`, empId: i, empName: a.empName, date: "2026-08-01", amount: a.amount, reason: "Imported from register", monthlyRecovery: Math.min(a.amount, 2000), recovered: 0, status: "Active" as const } : null; }).filter(Boolean) as Advance[];

  // Dedupe daily marks by (emp, date) — a worker can appear in both unit sheets
  // on a day; keep one, preferring Present over Absent.
  const dailyByKey = new Map<string, DailyAttendance>();
  for (const d of daily) {
    const k = `${d.empId}|${d.date}`;
    const prev = dailyByKey.get(k);
    if (!prev || (prev.status !== "Present" && d.status === "Present")) dailyByKey.set(k, d);
  }
  const dailyDeduped = [...dailyByKey.values()];

  const state = await loadAll();
  state.employees = employees;
  state.attendance = attendance;
  state.dailyAttendance = dailyDeduped;   // Aug + Oct day-by-day muster marks (DB-persisted)
  state.deductions = deductions;
  state.advances = advances;
  await saveAll(state);
  const octCount = [...octDays.values()].length;
  console.log(`✔ ${employees.length} employees | attendance: Aug ${augAtt.length}, Sep ${sepAtt.length}, Oct ${octCount} | ${dailyDeduped.length} daily marks | ${deductions.length} deductions | ${advances.length} advances | ${staffMatched} staff salaries`);
  await getPool().end();
}
main().catch((e) => { console.error("Import failed:", e); process.exit(1); });

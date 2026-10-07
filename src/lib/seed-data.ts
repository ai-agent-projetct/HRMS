/**
 * Server-safe seed builder — produces the initial HR state for loading into
 * MySQL (used by scripts/seed.ts and /api/seed). Mirrors the app's in-memory
 * seed so a fresh database matches the demo data.
 */

import { HR_EMPLOYEES, seedUnitFor, seedTrainingFor, type HrEmployee } from "@/lib/hr-data";
import type { HrState } from "@/lib/db-repo";
import type { AttendanceRecord, Advance, MonthlyDeduction, LeaveRequest, HrUserAccount } from "@/stores/hr";

// Baseline HR login accounts — one per role. Re-seeding resets logins to this
// set, the same way it resets employees/leave/advances to the demo baseline.
export const SEED_HR_USERS: HrUserAccount[] = [
  { id: "USR-1001", loginId: "admin", password: "Admin@2026", name: "System Admin", role: "Admin", active: true, createdAt: "01 Jan 2026, 09:00 am", createdBy: "System" },
  { id: "USR-1002", loginId: "anitha.hr", password: "Anitha@2026", name: "R. Anitha", role: "HR Manager", active: true, createdAt: "01 Jan 2026, 09:00 am", createdBy: "System" },
  { id: "USR-1003", loginId: "hrexec", password: "HrExec@2026", name: "M. Kalpana", role: "HR Executive", active: true, createdAt: "01 Jan 2026, 09:00 am", createdBy: "System" },
  { id: "USR-1004", loginId: "ceo", password: "Ceo@2026", name: "V. Rangarajan", role: "CEO", active: true, createdAt: "01 Jan 2026, 09:00 am", createdBy: "System" },
  // Retains edit rights after the go-live data lock (alongside the CEO).
  { id: "USR-1005", loginId: "superadmin", password: "Super@2026", name: "Super Admin", role: "Super Admin", active: true, createdAt: "01 Jan 2026, 09:00 am", createdBy: "System" },
];

export const CURRENT_MONTH = "2026-10";
const TOTAL_SATURDAYS = 4;

function splitWeeks(total: number): number[] {
  const w = [0, 0, 0, 0];
  let left = total;
  for (let i = 0; i < 4 && left > 0; i++) { w[i] = Math.min(7, left); left -= w[i]; }
  return w;
}

function seedAttendance(): AttendanceRecord[] {
  return HR_EMPLOYEES.map((e) => {
    let daysWorked: number, saturdaysWorked: number, absent: number, otHours: number;
    switch (e.conduct) {
      case "Absconded": daysWorked = 8; saturdaysWorked = 1; absent = 19; otHours = 0; break;
      case "Long Leave": daysWorked = 12; saturdaysWorked = 1; absent = 15; otHours = 0; break;
      case "Frequent Absent": daysWorked = 21; saturdaysWorked = 2; absent = 6; otHours = 2; break;
      case "Exited": daysWorked = 6; saturdaysWorked = 0; absent = 21; otHours = 0; break;
      default: daysWorked = e.wageType === "Daily" ? 28 : 27; saturdaysWorked = 4; absent = 0; otHours = e.wageType === "Daily" ? 10 : 0;
    }
    if (["EMP-1005", "EMP-1007"].includes(e.id)) { saturdaysWorked = 3; daysWorked = 26; }
    return { empId: e.id, month: CURRENT_MONTH, daysWorked, saturdaysWorked, totalSaturdays: TOTAL_SATURDAYS, absent, leave: e.leave.lopThisMonth, lop: e.leave.lopThisMonth, otHours, weekDaysWorked: splitWeeks(daysWorked) };
  });
}

function seedDeductions(): MonthlyDeduction[] {
  return HR_EMPLOYEES.filter((e) => ["HOSTEL_BOYS", "HOSTEL_GIRLS", "ODISHA"].includes(e.category))
    .map((e) => ({ empId: e.id, month: CURRENT_MONTH, mess: 2500, others: 0, othersNote: "" }));
}

// Go-live: the database seeds only the HR login accounts. Workforce, attendance,
// advances, leave and deductions are empty until the real roster is imported
// from the mill's Excel.
export function buildSeedState(): HrState {
  return {
    employees: [], attendance: [], dailyAttendance: [], advances: [], deductions: [],
    weeklyPaid: [], appraisals: [], leave: [], payslipLog: [], transfers: [], audit: [], recycleBin: [],
    hrUsers: SEED_HR_USERS,
  };
}

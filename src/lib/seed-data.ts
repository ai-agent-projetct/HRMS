/**
 * Server-safe seed builder — produces the initial HR state for loading into
 * MySQL (used by scripts/seed.ts and /api/seed). Mirrors the app's in-memory
 * seed so a fresh database matches the demo data.
 */

import { HR_EMPLOYEES, type HrEmployee } from "@/lib/hr-data";
import type { HrState } from "@/lib/db-repo";
import type { AttendanceRecord, Advance, MonthlyDeduction, LeaveRequest, HrUserAccount } from "@/stores/hr";

// Baseline HR login accounts — one per role. Re-seeding resets logins to this
// set, the same way it resets employees/leave/advances to the demo baseline.
export const SEED_HR_USERS: HrUserAccount[] = [
  { id: "USR-1001", loginId: "admin", password: "Admin@2026", name: "System Admin", role: "Admin", active: true, createdAt: "01 Jan 2026, 09:00 am", createdBy: "System" },
  { id: "USR-1002", loginId: "anitha.hr", password: "Anitha@2026", name: "R. Anitha", role: "HR Manager", active: true, createdAt: "01 Jan 2026, 09:00 am", createdBy: "System" },
  { id: "USR-1003", loginId: "hrexec", password: "HrExec@2026", name: "M. Kalpana", role: "HR Executive", active: true, createdAt: "01 Jan 2026, 09:00 am", createdBy: "System" },
  { id: "USR-1004", loginId: "ceo", password: "Ceo@2026", name: "V. Rangarajan", role: "CEO", active: true, createdAt: "01 Jan 2026, 09:00 am", createdBy: "System" },
];

export const CURRENT_MONTH = "2026-07";
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

const SEED_ADVANCES: Advance[] = [
  { id: "ADV-3001", empId: "EMP-1001", empName: "B. Santosh Behera", date: "2026-05-12", amount: 15000, reason: "Family — home travel", monthlyRecovery: 2500, recovered: 5000, status: "Active" },
  { id: "ADV-3002", empId: "EMP-0412", empName: "R. Muthukumar", date: "2026-06-02", amount: 10000, reason: "Medical", monthlyRecovery: 2000, recovered: 2000, status: "Active" },
  { id: "ADV-3003", empId: "EMP-1005", empName: "M. Arjun", date: "2026-06-20", amount: 8000, reason: "Festival advance", monthlyRecovery: 2000, recovered: 0, status: "Active" },
  { id: "ADV-3004", empId: "EMP-1002", empName: "P. Rajkishore Nayak", date: "2026-04-01", amount: 12000, reason: "Home construction", monthlyRecovery: 3000, recovered: 9000, status: "Active" },
];

const SEED_LEAVE: LeaveRequest[] = [
  { id: "LV-2201", empId: "EMP-0412", empName: "R. Muthukumar", type: "EL", from: "2026-07-22", to: "2026-07-24", days: 3, reason: "Family function", status: "Pending", appliedOn: "2026-07-17" },
  { id: "LV-2202", empId: "EMP-0467", empName: "S. Kavitha", type: "SL", from: "2026-07-16", to: "2026-07-16", days: 1, reason: "Fever", status: "Approved by Manager", appliedOn: "2026-07-16" },
  { id: "LV-2203", empId: "EMP-0299", empName: "P. Lakshmi", type: "CL", from: "2026-07-18", to: "2026-07-19", days: 2, reason: "Personal work", status: "Pending", appliedOn: "2026-07-17" },
  { id: "LV-2204", empId: "EMP-0733", empName: "S. Bharath", type: "LOP", from: "2026-07-14", to: "2026-07-14", days: 1, reason: "Unapproved absence", status: "Approved", appliedOn: "2026-07-15" },
  { id: "LV-2205", empId: "EMP-0388", empName: "V. Prakash", type: "EL", from: "2026-07-24", to: "2026-07-26", days: 3, reason: "Family function", status: "Approved", appliedOn: "2026-07-20" },
  { id: "LV-2206", empId: "EMP-0601", empName: "T. Ilango", type: "EL", from: "2026-07-25", to: "2026-07-27", days: 3, reason: "Medical — planned", status: "Approved", appliedOn: "2026-07-18" },
  { id: "LV-2207", empId: "EMP-1003", empName: "L. Sunita Pradhan", type: "SL", from: "2026-07-25", to: "2026-07-25", days: 1, reason: "Fever", status: "Approved", appliedOn: "2026-07-25" },
];

export function buildSeedState(): HrState {
  const employees: HrEmployee[] = HR_EMPLOYEES.map((e) => {
    if (e.id === "EMP-1004") return { ...e, salaryStatus: "On Hold", salaryStatusReason: "Absconded — final settlement pending" };
    if (e.id === "EMP-1010") return { ...e, salaryStatus: "Pending", salaryStatusReason: "Attendance shortfall — verifying days worked" };
    if (e.id === "EMP-0733") return { ...e, salaryStatus: "Pending", salaryStatusReason: "Bank account not yet submitted" };
    return e;
  });
  return {
    employees, attendance: seedAttendance(), advances: SEED_ADVANCES, deductions: seedDeductions(),
    weeklyPaid: [], appraisals: [], leave: SEED_LEAVE, payslipLog: [], transfers: [], audit: [], recycleBin: [],
    hrUsers: SEED_HR_USERS,
  };
}

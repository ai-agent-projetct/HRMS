"use client";

/**
 * HR portal store — separate login, leave workflow, payslip dispatch log and
 * salary bank-transfer batches. Persisted independently so
 * the HR portal has its own session, but the data (leave approvals, payroll
 * totals) is read by the main Admin/Accounts/CEO views too.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { HR_EMPLOYEES, type HrEmployee } from "@/lib/hr-data";
import { SEED_HR_USERS } from "@/lib/seed-data";

export type HrRole = "HR Manager" | "HR Executive" | "Manager" | "CEO" | "Admin";

export interface HrUser {
  name: string;
  role: HrRole;
  loginId: string;
}

/**
 * A named HR login account. Multiple HR staff sign in with their own
 * loginId/password so every change they make is attributed to them by
 * name, not a free-typed display name — see `withAudit`.
 *
 * Demo-grade auth: passwords are plain text and checked client-side (same
 * trust model the rest of this app already uses for salary/Aadhaar data).
 * Good enough for a pilot; not a substitute for real hashed, server-side
 * authentication before this ever holds a real workforce's data.
 */
export interface HrUserAccount {
  id: string;
  loginId: string;
  password: string;
  name: string;
  role: HrRole;
  active: boolean;
  createdAt: string;
  createdBy: string; // "by" of whoever created the account
}

/** Roles allowed to create/edit/deactivate HR login accounts. */
export const CAN_MANAGE_USERS_ROLES: HrRole[] = ["CEO", "Admin"];
export const canManageUsers = (role?: HrRole) => !!role && CAN_MANAGE_USERS_ROLES.includes(role);

export type LeaveType = "EL" | "CL" | "SL" | "LOP";
export interface LeaveRequest {
  id: string;
  empId: string;
  empName: string;
  type: LeaveType;
  from: string;
  to: string;
  days: number;
  reason: string;
  status: "Pending" | "Approved by Manager" | "Approved" | "Rejected";
  appliedOn: string;
}

export interface PayslipSend {
  id: string;
  empId: string;
  empName: string;
  channel: "WhatsApp" | "Email";
  month: string;
  netPay: number;
  at: string;
}

export interface TransferBatch {
  id: string;
  month: string;
  count: number;
  total: number;
  bankFile: string;
  status: "Draft" | "Sent to Bank" | "Processed";
  at: string;
}

/** The payroll month the portal is operating on. */
export const CURRENT_MONTH = "2026-07";
export const CURRENT_MONTH_LABEL = "July 2026";

/** Monthly attendance summary — the basis for day-wage pay & incentives. */
export interface AttendanceRecord {
  empId: string;
  month: string;          // YYYY-MM
  daysWorked: number;
  saturdaysWorked: number;
  totalSaturdays: number;
  absent: number;
  leave: number;
  lop: number;
  otHours: number;
  weekDaysWorked: number[]; // days worked in each of the 4 weeks
  /**
   * Shift assigned per calendar week-row of the muster (Sun–Sat rows of the
   * month grid, index 0 = the row containing the 1st). Rotating shifts change
   * week to week; setting Monday's shift sets the whole row, since that's the
   * unit HR marks it in. `undefined`/missing index → falls back to the
   * employee's default shift. Distinct from `weekDaysWorked`'s payroll-week
   * buckets (which split the month into quarters, not calendar rows).
   */
  weekShiftIds?: (string | null)[];
}

/** The date the portal treats as "today" for the AI daily briefing. */
export const TODAY = "2026-07-25";

/** Which calendar week-row (Sun–Sat) of `month`'s grid a date falls in. */
export function weekRowOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const firstDow = new Date(y, m - 1, 1).getDay();
  return Math.floor((firstDow + d - 1) / 7);
}

/** The calendar week-row TODAY falls in — the row the attendance table edits by default. */
export const CURRENT_WEEK_ROW = weekRowOf(TODAY);

/** Status for a single employee-day in the attendance register. */
export type AttendanceStatus = "Present" | "Absent" | "Leave" | "Holiday";

/** One employee-day punch record — the source of truth for the monthly summary. */
export interface DailyAttendance {
  empId: string;
  date: string;          // YYYY-MM-DD
  status: AttendanceStatus;
  otHours?: number;
  source: "import" | "manual";
}

/** Salary advance with a monthly recovery plan (deducted from pay). */
export interface Advance {
  id: string;
  empId: string;
  empName: string;
  date: string;
  amount: number;
  reason: string;
  monthlyRecovery: number;
  recovered: number;      // cumulative recovered
  status: "Active" | "Cleared";
}

/** Per-month mess bill & other deductions for a worker. */
export interface MonthlyDeduction {
  empId: string;
  month: string;
  mess: number;
  others: number;
  othersNote: string;
}

/** An audit-trail entry — who changed what, and when. */
export interface AuditEntry {
  id: string;
  at: string;
  by: string;       // "Name (Role)" of the logged-in user
  module: string;   // e.g. "Advances", "Appraisals"
  action: string;   // short verb phrase
  detail: string;   // human-readable specifics
  empId?: string;   // affected employee, if any
}

/** A soft-deleted record held in the recycle bin until restored or purged. */
export interface RecycleEntry {
  id: string;                              // bin entry id
  type: "employee" | "advance" | "leave"; // source collection
  label: string;                           // display title
  sub?: string;                            // secondary line
  data: unknown;                           // the original record, for restore
  deletedBy: string;                       // "Name (Role)"
  deletedAt: string;
}

/** Roles allowed to permanently delete (purge) from the recycle bin. */
export const CAN_PURGE_ROLES: HrRole[] = ["CEO", "Admin"];
export const canPurge = (role?: HrRole) => !!role && CAN_PURGE_ROLES.includes(role);

/** A finalised performance appraisal for an employee in a cycle. */
export interface AppraisalRecord {
  empId: string;
  cycle: string;
  productivity: number;
  quality: number;
  attendance: number;
  discipline: number;
  teamwork: number;
  overall: number;
  incrementPct: number;
  note: string;
  finalizedOn: string;
}

const SEED_LEAVE: LeaveRequest[] = [
  { id: "LV-2201", empId: "EMP-0412", empName: "R. Muthukumar", type: "EL", from: "2026-07-22", to: "2026-07-24", days: 3, reason: "Family function", status: "Pending", appliedOn: "2026-07-17" },
  { id: "LV-2202", empId: "EMP-0467", empName: "S. Kavitha", type: "SL", from: "2026-07-16", to: "2026-07-16", days: 1, reason: "Fever", status: "Approved by Manager", appliedOn: "2026-07-16" },
  { id: "LV-2203", empId: "EMP-0299", empName: "P. Lakshmi", type: "CL", from: "2026-07-18", to: "2026-07-19", days: 2, reason: "Personal work", status: "Pending", appliedOn: "2026-07-17" },
  { id: "LV-2204", empId: "EMP-0733", empName: "S. Bharath", type: "LOP", from: "2026-07-14", to: "2026-07-14", days: 1, reason: "Unapproved absence", status: "Approved", appliedOn: "2026-07-15" },
  // On leave TODAY (25 Jul) — drives the AI coverage / auto-assignment engine.
  { id: "LV-2205", empId: "EMP-0388", empName: "V. Prakash", type: "EL", from: "2026-07-24", to: "2026-07-26", days: 3, reason: "Family function", status: "Approved", appliedOn: "2026-07-20" },
  { id: "LV-2206", empId: "EMP-0601", empName: "T. Ilango", type: "EL", from: "2026-07-25", to: "2026-07-27", days: 3, reason: "Medical — planned", status: "Approved", appliedOn: "2026-07-18" },
  { id: "LV-2207", empId: "EMP-1003", empName: "L. Sunita Pradhan", type: "SL", from: "2026-07-25", to: "2026-07-25", days: 1, reason: "Fever", status: "Approved", appliedOn: "2026-07-25" },
];

let seq = 5000;
const uid = (p: string) => `${p}${(seq++).toString(36)}`;
const nowStr = () => new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Prepend an audit entry (capturing the current login) to the trail. */
function withAudit(s: { user: HrUser | null; audit: AuditEntry[] }, module: string, action: string, detail: string, empId?: string): AuditEntry[] {
  const by = s.user ? `${s.user.name} · ${s.user.loginId} (${s.user.role})` : "System";
  return [{ id: uid("AUD-"), at: nowStr(), by, module, action, detail, empId }, ...s.audit].slice(0, 800);
}

/** Checks loginId/password against the account directory — active accounts only. Login IDs are matched case-insensitively. */
export function authenticateHrUser(list: HrUserAccount[], loginId: string, password: string): { ok: true; account: HrUserAccount } | { ok: false; error: string } {
  const account = list.find((u) => u.loginId.toLowerCase() === loginId.trim().toLowerCase());
  if (!account) return { ok: false, error: "No account with that login ID." };
  if (!account.active) return { ok: false, error: "This account has been deactivated — contact your Admin." };
  if (account.password !== password) return { ok: false, error: "Incorrect password." };
  return { ok: true, account };
}

// July 2026 has 4 Saturdays (4th, 11th, 18th, 25th).
const TOTAL_SATURDAYS = 4;

/** Deterministic July-2026 attendance seed, shaped by each worker's conduct. */
function seedAttendance(): AttendanceRecord[] {
  return HR_EMPLOYEES.map((e) => {
    let daysWorked: number, saturdaysWorked: number, absent: number, otHours: number;
    switch (e.conduct) {
      case "Absconded": daysWorked = 8; saturdaysWorked = 1; absent = 19; otHours = 0; break;
      case "Long Leave": daysWorked = 12; saturdaysWorked = 1; absent = 15; otHours = 0; break;
      case "Frequent Absent": daysWorked = 21; saturdaysWorked = 2; absent = 6; otHours = 2; break;
      case "Exited": daysWorked = 6; saturdaysWorked = 0; absent = 21; otHours = 0; break;
      default: // Proper
        daysWorked = e.wageType === "Daily" ? 28 : 27;
        saturdaysWorked = 4; absent = 0; otHours = e.wageType === "Daily" ? 10 : 0;
    }
    // A couple of proper workers just miss a Saturday, to show partial Inc-1.
    if (["EMP-1005", "EMP-1007"].includes(e.id)) { saturdaysWorked = 3; daysWorked = 26; }
    // Split the month's days across 4 weeks (max 7 each).
    const weekDaysWorked = splitWeeks(daysWorked);
    return {
      empId: e.id, month: CURRENT_MONTH, daysWorked, saturdaysWorked,
      totalSaturdays: TOTAL_SATURDAYS, absent, leave: e.leave.lopThisMonth, lop: e.leave.lopThisMonth, otHours,
      weekDaysWorked,
    };
  });
}

/** Distribute total days worked across 4 weeks (≤7/week). */
function splitWeeks(total: number): number[] {
  const w = [0, 0, 0, 0];
  let left = total;
  for (let i = 0; i < 4 && left > 0; i++) { w[i] = Math.min(7, left); left -= w[i]; }
  return w;
}

const isSaturdayDate = (date: string) => new Date(`${date}T00:00:00`).getDay() === 6;

/**
 * Rebuilds the monthly AttendanceRecord for one employee from the day-level
 * register. Returns null when the employee has no day records for the month —
 * callers then leave the existing monthly summary untouched.
 */
function summaryFromDaily(daily: DailyAttendance[], empId: string): AttendanceRecord | null {
  const days = daily.filter((d) => d.empId === empId && d.date.startsWith(CURRENT_MONTH));
  if (days.length === 0) return null;
  let daysWorked = 0, saturdaysWorked = 0, absent = 0, leaveCount = 0, otHours = 0;
  const weekDaysWorked = [0, 0, 0, 0];
  for (const d of days) {
    if (d.status === "Present") {
      daysWorked += 1;
      otHours += d.otHours ?? 0;
      if (isSaturdayDate(d.date)) saturdaysWorked += 1;
      weekDaysWorked[Math.min(3, Math.floor((Number(d.date.slice(8, 10)) - 1) / 7))] += 1;
    } else if (d.status === "Absent") {
      absent += 1;
    } else if (d.status === "Leave") {
      leaveCount += 1;
    }
  }
  return {
    empId, month: CURRENT_MONTH, daysWorked, saturdaysWorked,
    totalSaturdays: TOTAL_SATURDAYS, absent, leave: leaveCount, lop: leaveCount, otHours, weekDaysWorked,
  };
}

/** Merges a recomputed monthly summary back into the attendance list. */
function upsertSummary(list: AttendanceRecord[], sum: AttendanceRecord): AttendanceRecord[] {
  const i = list.findIndex((a) => a.empId === sum.empId && a.month === CURRENT_MONTH);
  if (i >= 0) { const next = [...list]; next[i] = { ...next[i], ...sum }; return next; }
  return [...list, sum];
}

/** Mess bills for hostel/Odisha residents; others start at zero. */
function seedDeductions(): MonthlyDeduction[] {
  return HR_EMPLOYEES.filter((e) => ["HOSTEL_BOYS", "HOSTEL_GIRLS", "ODISHA"].includes(e.category)).map((e) => ({
    empId: e.id, month: CURRENT_MONTH, mess: 2500, others: 0, othersNote: "",
  }));
}

const SEED_ADVANCES: Advance[] = [
  { id: "ADV-3001", empId: "EMP-1001", empName: "B. Santosh Behera", date: "2026-05-12", amount: 15000, reason: "Family — home travel", monthlyRecovery: 2500, recovered: 5000, status: "Active" },
  { id: "ADV-3002", empId: "EMP-0412", empName: "R. Muthukumar", date: "2026-06-02", amount: 10000, reason: "Medical", monthlyRecovery: 2000, recovered: 2000, status: "Active" },
  { id: "ADV-3003", empId: "EMP-1005", empName: "M. Arjun", date: "2026-06-20", amount: 8000, reason: "Festival advance", monthlyRecovery: 2000, recovered: 0, status: "Active" },
  { id: "ADV-3004", empId: "EMP-1002", empName: "P. Rajkishore Nayak", date: "2026-04-01", amount: 12000, reason: "Home construction", monthlyRecovery: 3000, recovered: 9000, status: "Active" },
];

interface HrState {
  user: HrUser | null;
  employees: HrEmployee[];
  leave: LeaveRequest[];
  payslipLog: PayslipSend[];
  transfers: TransferBatch[];
  attendance: AttendanceRecord[];
  dailyAttendance: DailyAttendance[];
  advances: Advance[];
  deductions: MonthlyDeduction[];
  weeklyPaid: string[]; // keys: `${empId}|${month}|W${weekIdx}`
  appraisals: AppraisalRecord[];
  audit: AuditEntry[];
  recycleBin: RecycleEntry[];
  hrUsers: HrUserAccount[];

  login: (u: HrUser) => void;
  logout: () => void;
  addHrUser: (a: { loginId: string; password: string; name: string; role: HrRole }) => { ok: true } | { ok: false; error: string };
  updateHrUser: (id: string, patch: Partial<Pick<HrUserAccount, "name" | "role" | "loginId" | "active">>) => { ok: true } | { ok: false; error: string };
  resetHrUserPassword: (id: string, newPassword: string) => void;
  deleteHrUser: (id: string) => { ok: true } | { ok: false; error: string };
  updateEmployee: (id: string, patch: Partial<HrEmployee>) => void;
  updateHealth: (id: string, patch: Partial<HrEmployee["health"]>) => void;
  setConduct: (id: string, conduct: HrEmployee["conduct"]) => void;
  setSalaryStatus: (id: string, status: NonNullable<HrEmployee["salaryStatus"]>, reason?: string) => void;
  setAttendance: (empId: string, patch: Partial<AttendanceRecord>) => void;
  setWeekShift: (empId: string, weekRow: number, shiftId: string) => void;
  applyDailyAttendance: (records: DailyAttendance[]) => void;
  markAttendanceDay: (empId: string, date: string, status: AttendanceStatus, otHours?: number) => void;
  clearAttendanceDay: (empId: string, date: string) => void;
  addAdvance: (a: Omit<Advance, "id" | "recovered" | "status">) => void;
  recoverAdvance: (id: string, amount: number) => void;
  editAdvance: (id: string, patch: Partial<Pick<Advance, "amount" | "monthlyRecovery" | "reason">>) => void;
  reverseAdvance: (id: string, amount?: number) => void;
  setDeduction: (empId: string, patch: Partial<Omit<MonthlyDeduction, "empId" | "month">>) => void;
  markWeeklyPaid: (empId: string, weekIdx: number, paid: boolean) => void;
  setAppraisal: (rec: AppraisalRecord) => void;
  applyLeave: (l: Omit<LeaveRequest, "id" | "appliedOn" | "status">) => void;
  advanceLeave: (id: string, decision: "approve" | "reject", by: HrRole) => void;
  logPayslip: (s: Omit<PayslipSend, "id" | "at">) => void;
  addTransfer: (t: Omit<TransferBatch, "id" | "at">) => void;
  setTransferStatus: (id: string, status: TransferBatch["status"]) => void;
  logAudit: (module: string, action: string, detail: string, empId?: string) => void;
  deleteEmployee: (id: string) => void;
  deleteAdvance: (id: string) => void;
  deleteLeave: (id: string) => void;
  restoreFromBin: (binId: string) => void;
  purgeFromBin: (binId: string) => void;
  reset: () => void;
}

const seed = () => ({
  employees: HR_EMPLOYEES.map((e) => {
    if (e.id === "EMP-1004") return { ...e, salaryStatus: "On Hold" as const, salaryStatusReason: "Absconded — final settlement pending" };
    if (e.id === "EMP-1010") return { ...e, salaryStatus: "Pending" as const, salaryStatusReason: "Attendance shortfall — verifying days worked" };
    if (e.id === "EMP-0733") return { ...e, salaryStatus: "Pending" as const, salaryStatusReason: "Bank account not yet submitted" };
    return e;
  }),
  leave: [...SEED_LEAVE],
  payslipLog: [] as PayslipSend[],
  transfers: [] as TransferBatch[],
  attendance: seedAttendance(),
  dailyAttendance: [] as DailyAttendance[],
  advances: [...SEED_ADVANCES],
  deductions: seedDeductions(),
  weeklyPaid: [] as string[],
  appraisals: [] as AppraisalRecord[],
  audit: [] as AuditEntry[],
  recycleBin: [] as RecycleEntry[],
  hrUsers: [...SEED_HR_USERS],
});

export const useHr = create<HrState>()(
  persist(
    (set, get) => ({
      user: null,
      ...seed(),

      login: (u) => set({ user: u }),
      logout: () => set({ user: null }),

      addHrUser: ({ loginId, password, name, role }) => {
        const trimmed = loginId.trim();
        if (!trimmed || !password || !name.trim()) return { ok: false, error: "Login ID, password and name are all required." };
        if (get().hrUsers.some((u) => u.loginId.toLowerCase() === trimmed.toLowerCase())) return { ok: false, error: "That login ID is already in use." };
        set((s) => ({
          hrUsers: [...s.hrUsers, { id: uid("USR-"), loginId: trimmed, password, name: name.trim(), role, active: true, createdAt: nowStr(), createdBy: s.user ? `${s.user.name} (${s.user.role})` : "System" }],
          audit: withAudit(s, "Users & Access", "Created login", `${trimmed} — ${name.trim()} (${role})`),
        }));
        return { ok: true };
      },

      updateHrUser: (id, patch) => {
        if (patch.loginId) {
          const trimmed = patch.loginId.trim();
          if (!trimmed) return { ok: false, error: "Login ID can't be empty." };
          if (get().hrUsers.some((u) => u.id !== id && u.loginId.toLowerCase() === trimmed.toLowerCase())) return { ok: false, error: "That login ID is already in use." };
        }
        const target = get().hrUsers.find((u) => u.id === id);
        if (!target) return { ok: false, error: "Account not found." };
        if (patch.active === false && target.role === "Admin" && get().hrUsers.filter((u) => u.role === "Admin" && u.active).length <= 1) {
          return { ok: false, error: "Can't deactivate the last active Admin account." };
        }
        set((s) => ({
          hrUsers: s.hrUsers.map((u) => (u.id === id ? { ...u, ...patch, loginId: patch.loginId?.trim() ?? u.loginId } : u)),
          audit: withAudit(s, "Users & Access", "Updated login", `${target.loginId}: ${Object.keys(patch).join(", ")}`),
        }));
        return { ok: true };
      },

      resetHrUserPassword: (id, newPassword) =>
        set((s) => {
          const target = s.hrUsers.find((u) => u.id === id);
          return {
            hrUsers: s.hrUsers.map((u) => (u.id === id ? { ...u, password: newPassword } : u)),
            audit: withAudit(s, "Users & Access", "Reset password", `${target?.loginId ?? id}`),
          };
        }),

      deleteHrUser: (id) => {
        const target = get().hrUsers.find((u) => u.id === id);
        if (!target) return { ok: false, error: "Account not found." };
        if (target.role === "Admin" && get().hrUsers.filter((u) => u.role === "Admin").length <= 1) {
          return { ok: false, error: "Can't delete the last Admin account." };
        }
        if (get().user?.loginId === target.loginId) return { ok: false, error: "Can't delete the account you're signed in as." };
        set((s) => ({
          hrUsers: s.hrUsers.filter((u) => u.id !== id),
          audit: withAudit(s, "Users & Access", "Deleted login", `${target.loginId} — ${target.name} (${target.role})`),
        }));
        return { ok: true };
      },

      updateEmployee: (id, patch) =>
        set((s) => ({ employees: s.employees.map((e) => (e.id === id ? { ...e, ...patch } : e)), audit: withAudit(s, "Employees", "Updated employee", `${id}: ${Object.keys(patch).join(", ")}`, id) })),

      updateHealth: (id, patch) =>
        set((s) => ({ employees: s.employees.map((e) => (e.id === id ? { ...e, health: { ...e.health, ...patch } } : e)), audit: withAudit(s, "Health Check", "Updated health record", `${id}: ${Object.keys(patch ?? {}).join(", ")}`, id) })),

      setConduct: (id, conduct) =>
        set((s) => ({ employees: s.employees.map((e) => (e.id === id ? { ...e, conduct } : e)), audit: withAudit(s, "Agents & Commission", "Set conduct", `${id} → ${conduct}`, id) })),

      setAttendance: (empId, patch) =>
        set((s) => {
          const audit = withAudit(s, "Attendance & Shifts", "Edited attendance", `${empId}: ${Object.entries(patch).map(([k, v]) => `${k}=${v}`).join(", ")}`, empId);
          const exists = s.attendance.some((a) => a.empId === empId && a.month === CURRENT_MONTH);
          if (exists) {
            return { attendance: s.attendance.map((a) => (a.empId === empId && a.month === CURRENT_MONTH ? { ...a, ...patch } : a)), audit };
          }
          return {
            attendance: [...s.attendance, { empId, month: CURRENT_MONTH, daysWorked: 0, saturdaysWorked: 0, totalSaturdays: TOTAL_SATURDAYS, absent: 0, leave: 0, lop: 0, otHours: 0, weekDaysWorked: [0, 0, 0, 0], ...patch }], audit,
          };
        }),

      setWeekShift: (empId, weekRow, shiftId) =>
        set((s) => {
          const audit = withAudit(s, "Attendance & Shifts", "Set week shift", `${empId}: week row ${weekRow + 1} → ${shiftId}`, empId);
          const exists = s.attendance.some((a) => a.empId === empId && a.month === CURRENT_MONTH);
          if (exists) {
            return {
              attendance: s.attendance.map((a) => {
                if (a.empId !== empId || a.month !== CURRENT_MONTH) return a;
                const weekShiftIds = [...(a.weekShiftIds ?? [])];
                weekShiftIds[weekRow] = shiftId;
                return { ...a, weekShiftIds };
              }),
              audit,
            };
          }
          const weekShiftIds: (string | null)[] = [];
          weekShiftIds[weekRow] = shiftId;
          return {
            attendance: [...s.attendance, { empId, month: CURRENT_MONTH, daysWorked: 0, saturdaysWorked: 0, totalSaturdays: TOTAL_SATURDAYS, absent: 0, leave: 0, lop: 0, otHours: 0, weekDaysWorked: [0, 0, 0, 0], weekShiftIds }],
            audit,
          };
        }),

      applyDailyAttendance: (records) =>
        set((s) => {
          if (records.length === 0) return {};
          const kept = s.dailyAttendance.filter((d) => !records.some((r) => r.empId === d.empId && r.date === d.date));
          const merged = [...kept, ...records];
          const affected = [...new Set(records.map((r) => r.empId))];
          let attendance = s.attendance;
          for (const empId of affected) {
            const sum = summaryFromDaily(merged, empId);
            if (sum) attendance = upsertSummary(attendance, sum);
          }
          const audit = withAudit(s, "Attendance & Shifts", "Imported daily attendance", `${records.length} day-records for ${affected.length} employees`);
          return { dailyAttendance: merged, attendance, audit };
        }),

      markAttendanceDay: (empId, date, status, otHours) =>
        set((s) => {
          const merged = [
            ...s.dailyAttendance.filter((d) => !(d.empId === empId && d.date === date)),
            { empId, date, status, otHours, source: "manual" as const },
          ];
          const sum = summaryFromDaily(merged, empId);
          const attendance = sum ? upsertSummary(s.attendance, sum) : s.attendance;
          const audit = withAudit(s, "Attendance & Shifts", "Marked attendance", `${empId} · ${date} → ${status}`, empId);
          return { dailyAttendance: merged, attendance, audit };
        }),

      clearAttendanceDay: (empId, date) =>
        set((s) => {
          const merged = s.dailyAttendance.filter((d) => !(d.empId === empId && d.date === date));
          const sum = summaryFromDaily(merged, empId);
          const attendance = sum
            ? upsertSummary(s.attendance, sum)
            : s.attendance.map((a) =>
                a.empId === empId && a.month === CURRENT_MONTH
                  ? { ...a, daysWorked: 0, saturdaysWorked: 0, absent: 0, leave: 0, lop: 0, otHours: 0, weekDaysWorked: [0, 0, 0, 0] }
                  : a
              );
          const audit = withAudit(s, "Attendance & Shifts", "Cleared attendance", `${empId} · ${date}`, empId);
          return { dailyAttendance: merged, attendance, audit };
        }),

      addAdvance: (a) =>
        set((s) => ({ advances: [{ ...a, id: uid("ADV-"), recovered: 0, status: "Active" }, ...s.advances], audit: withAudit(s, "Advances", "Booked advance", `${a.empName}: ₹${a.amount} @ ₹${a.monthlyRecovery}/mo`, a.empId) })),

      recoverAdvance: (id, amount) =>
        set((s) => ({
          advances: s.advances.map((a) => {
            if (a.id !== id) return a;
            const recovered = Math.min(a.amount, a.recovered + amount);
            return { ...a, recovered, status: recovered >= a.amount ? ("Cleared" as const) : ("Active" as const) };
          }),
          audit: withAudit(s, "Advances", "Recovered instalment", `${id}: ₹${amount}`, s.advances.find((a) => a.id === id)?.empId),
        })),

      editAdvance: (id, patch) =>
        set((s) => ({
          advances: s.advances.map((a) => {
            if (a.id !== id) return a;
            const merged = { ...a, ...patch };
            merged.recovered = Math.min(merged.recovered, merged.amount);
            merged.status = merged.recovered >= merged.amount ? "Cleared" : "Active";
            return merged;
          }),
          audit: withAudit(s, "Advances", "Edited advance", `${id}: ${Object.entries(patch).map(([k, v]) => `${k}=${v}`).join(", ")}`, s.advances.find((a) => a.id === id)?.empId),
        })),

      reverseAdvance: (id, amount) =>
        set((s) => ({
          advances: s.advances.map((a) => {
            if (a.id !== id) return a;
            const back = amount ?? a.monthlyRecovery; // reverse one instalment by default
            const recovered = Math.max(0, a.recovered - back);
            return { ...a, recovered, status: recovered >= a.amount ? ("Cleared" as const) : ("Active" as const) };
          }),
          audit: withAudit(s, "Advances", "Reversed instalment", `${id}`, s.advances.find((a) => a.id === id)?.empId),
        })),

      setSalaryStatus: (id, status, reason) =>
        set((s) => ({
          employees: s.employees.map((e) => (e.id === id ? { ...e, salaryStatus: status, salaryStatusReason: status === "Paid" ? undefined : reason } : e)),
          audit: withAudit(s, "Employees", "Set salary status", `${id} → ${status}${reason ? ` (${reason})` : ""}`, id),
        })),

      markWeeklyPaid: (empId, weekIdx, paid) =>
        set((s) => {
          const key = `${empId}|${CURRENT_MONTH}|W${weekIdx}`;
          return { weeklyPaid: paid ? [...new Set([...s.weeklyPaid, key])] : s.weeklyPaid.filter((k) => k !== key), audit: withAudit(s, "Weekly Wages", paid ? "Marked week paid" : "Marked week pending", `${empId} · W${weekIdx + 1}`, empId) };
        }),

      setAppraisal: (rec) =>
        set((s) => ({
          appraisals: [rec, ...s.appraisals.filter((a) => !(a.empId === rec.empId && a.cycle === rec.cycle))],
          audit: withAudit(s, "Appraisals", "Finalized appraisal", `${rec.empId}: overall ${rec.overall}/5, increment ${rec.incrementPct}%`, rec.empId),
        })),

      setDeduction: (empId, patch) =>
        set((s) => {
          const audit = withAudit(s, "Advances & Deductions", "Edited deduction", `${empId}: ${Object.entries(patch).map(([k, v]) => `${k}=${v}`).join(", ")}`, empId);
          const exists = s.deductions.some((d) => d.empId === empId && d.month === CURRENT_MONTH);
          if (exists) {
            return { deductions: s.deductions.map((d) => (d.empId === empId && d.month === CURRENT_MONTH ? { ...d, ...patch } : d)), audit };
          }
          return { deductions: [...s.deductions, { empId, month: CURRENT_MONTH, mess: 0, others: 0, othersNote: "", ...patch }], audit };
        }),

      applyLeave: (l) =>
        set((s) => ({
          leave: [{ ...l, id: uid("LV-"), status: "Pending", appliedOn: "2026-07-19" }, ...s.leave],
          audit: withAudit(s, "Leave", "Applied leave", `${l.empName}: ${l.type} ${l.from}→${l.to}`, l.empId),
        })),

      advanceLeave: (id, decision, by) =>
        set((s) => ({
          leave: s.leave.map((l) => {
            if (l.id !== id) return l;
            if (decision === "reject") return { ...l, status: "Rejected" as const };
            if (l.status === "Pending" && by === "Manager") return { ...l, status: "Approved by Manager" as const };
            return { ...l, status: "Approved" as const };
          }),
          audit: withAudit(s, "Leave", decision === "reject" ? "Rejected leave" : "Approved leave", `${id} by ${by}`, s.leave.find((l) => l.id === id)?.empId),
        })),

      logPayslip: (p) => set((s) => ({ payslipLog: [{ ...p, id: uid("PS-"), at: nowStr() }, ...s.payslipLog], audit: withAudit(s, "Payroll", "Sent payslip", `${p.empName} via ${p.channel} (${p.month})`, p.empId) })),

      addTransfer: (t) => set((s) => ({ transfers: [{ ...t, id: uid("BT-"), at: nowStr() }, ...s.transfers], audit: withAudit(s, "Bank Transfer", "Created batch", `${t.month}: ${t.count} beneficiaries, ₹${t.total}`) })),
      setTransferStatus: (id, status) => set((s) => ({ transfers: s.transfers.map((t) => (t.id === id ? { ...t, status } : t)), audit: withAudit(s, "Bank Transfer", "Batch status", `${id} → ${status}`) })),

      logAudit: (module, action, detail, empId) => set((s) => ({ audit: withAudit(s, module, action, detail, empId) })),

      deleteEmployee: (id) =>
        set((s) => {
          const e = s.employees.find((x) => x.id === id);
          if (!e) return {};
          const entry: RecycleEntry = { id: uid("BIN-"), type: "employee", label: e.name, sub: `${id} · ${e.role}`, data: e, deletedBy: s.user ? `${s.user.name} (${s.user.role})` : "System", deletedAt: nowStr() };
          return { employees: s.employees.filter((x) => x.id !== id), recycleBin: [entry, ...s.recycleBin], audit: withAudit(s, "Employees", "Deleted employee", `${e.name} (${id}) → recycle bin`, id) };
        }),

      deleteAdvance: (id) =>
        set((s) => {
          const a = s.advances.find((x) => x.id === id);
          if (!a) return {};
          const entry: RecycleEntry = { id: uid("BIN-"), type: "advance", label: `${a.empName} — ₹${a.amount}`, sub: `${a.reason} · ${a.date}`, data: a, deletedBy: s.user ? `${s.user.name} (${s.user.role})` : "System", deletedAt: nowStr() };
          return { advances: s.advances.filter((x) => x.id !== id), recycleBin: [entry, ...s.recycleBin], audit: withAudit(s, "Advances", "Deleted advance", `${id} → recycle bin`, a.empId) };
        }),

      deleteLeave: (id) =>
        set((s) => {
          const l = s.leave.find((x) => x.id === id);
          if (!l) return {};
          const entry: RecycleEntry = { id: uid("BIN-"), type: "leave", label: `${l.empName} — ${l.type}`, sub: `${l.from} → ${l.to}`, data: l, deletedBy: s.user ? `${s.user.name} (${s.user.role})` : "System", deletedAt: nowStr() };
          return { leave: s.leave.filter((x) => x.id !== id), recycleBin: [entry, ...s.recycleBin], audit: withAudit(s, "Leave", "Deleted leave", `${id} → recycle bin`, l.empId) };
        }),

      restoreFromBin: (binId) =>
        set((s) => {
          const entry = s.recycleBin.find((x) => x.id === binId);
          if (!entry) return {};
          const rest = s.recycleBin.filter((x) => x.id !== binId);
          const audit = withAudit(s, "Recycle Bin", "Restored", `${entry.type}: ${entry.label}`);
          if (entry.type === "employee") return { employees: [...s.employees, entry.data as HrEmployee], recycleBin: rest, audit };
          if (entry.type === "advance") return { advances: [entry.data as Advance, ...s.advances], recycleBin: rest, audit };
          return { leave: [entry.data as LeaveRequest, ...s.leave], recycleBin: rest, audit };
        }),

      purgeFromBin: (binId) =>
        set((s) => {
          if (!canPurge(s.user?.role)) return {}; // only CEO / Admin may permanently delete
          const entry = s.recycleBin.find((x) => x.id === binId);
          if (!entry) return {};
          return { recycleBin: s.recycleBin.filter((x) => x.id !== binId), audit: withAudit(s, "Recycle Bin", "Permanently deleted", `${entry.type}: ${entry.label}`) };
        }),

      reset: () => set(seed()),
    }),
    { name: "mehala-erp-hr-v4" }
  )
);

export function leaveStatusTone(status: LeaveRequest["status"]): "success" | "warning" | "danger" | "info" {
  if (status === "Approved") return "success";
  if (status === "Rejected") return "danger";
  if (status === "Approved by Manager") return "info";
  return "warning";
}

// ---- Selectors -------------------------------------------------------------

export function attendanceFor(list: AttendanceRecord[], empId: string): AttendanceRecord | undefined {
  return list.find((a) => a.empId === empId && a.month === CURRENT_MONTH);
}

/** The shift for a given calendar week-row — falls back to the employee's default shift if that week has no override. */
export function shiftForWeek(list: AttendanceRecord[], empId: string, weekRow: number, defaultShiftId: string): string {
  return attendanceFor(list, empId)?.weekShiftIds?.[weekRow] || defaultShiftId;
}

export function dailyFor(list: DailyAttendance[], empId: string, date: string): DailyAttendance | undefined {
  return list.find((d) => d.empId === empId && d.date === date);
}

export function attendanceStatusTone(status?: AttendanceStatus): "success" | "danger" | "info" | "warning" | "muted" {
  if (status === "Present") return "success";
  if (status === "Absent") return "danger";
  if (status === "Leave") return "info";
  if (status === "Holiday") return "warning";
  return "muted";
}

export function deductionFor(list: MonthlyDeduction[], empId: string): MonthlyDeduction {
  return list.find((d) => d.empId === empId && d.month === CURRENT_MONTH) ?? { empId, month: CURRENT_MONTH, mess: 0, others: 0, othersNote: "" };
}

/** Advance recovery to apply this month = min(monthlyRecovery, outstanding). */
export function advanceRecoveryFor(list: Advance[], empId: string): number {
  return list
    .filter((a) => a.empId === empId && a.status === "Active")
    .reduce((s, a) => s + Math.min(a.monthlyRecovery, a.amount - a.recovered), 0);
}

export function outstandingAdvance(list: Advance[], empId: string): number {
  return list
    .filter((a) => a.empId === empId && a.status === "Active")
    .reduce((s, a) => s + (a.amount - a.recovered), 0);
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface AdvanceProjection {
  remaining: number;
  perMonth: number;
  monthsLeft: number;
  completeLabel: string; // "Oct 2026" or "Cleared"
}

/** Projects when an advance finishes at its current monthly recovery rate. */
export function advanceProjection(a: Advance, fromYM: string = CURRENT_MONTH): AdvanceProjection {
  const remaining = Math.max(0, a.amount - a.recovered);
  const perMonth = Math.max(1, a.monthlyRecovery);
  const monthsLeft = a.status === "Cleared" || remaining === 0 ? 0 : Math.ceil(remaining / perMonth);
  const [y, m] = fromYM.split("-").map(Number);
  const idx = y * 12 + (m - 1) + Math.max(0, monthsLeft - 1);
  const completeLabel = monthsLeft === 0 ? "Cleared" : `${MONTHS_SHORT[idx % 12]} ${Math.floor(idx / 12)}`;
  return { remaining, perMonth, monthsLeft, completeLabel };
}

export function weeklyPaidKey(empId: string, weekIdx: number): string {
  return `${empId}|${CURRENT_MONTH}|W${weekIdx}`;
}
export function isWeeklyPaid(list: string[], empId: string, weekIdx: number): boolean {
  return list.includes(weeklyPaidKey(empId, weekIdx));
}

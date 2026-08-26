"use client";

/**
 * HR portal store — separate login, leave workflow, payslip dispatch log and
 * salary bank-transfer batches. Persisted independently so
 * the HR portal has its own session, but the data (leave approvals, payroll
 * totals) is read by the main Admin/Accounts/CEO views too.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { HR_EMPLOYEES, seedUnitFor, seedTrainingFor, type HrEmployee, type ExitRecord } from "@/lib/hr-data";
import { SEED_HR_USERS } from "@/lib/seed-data";
import { allCategories, allDepartments, type WorkerCategory } from "@/lib/hr-master";

export type HrRole = "HR Manager" | "HR Executive" | "Manager" | "CEO" | "Admin" | "Super Admin";

export const HR_ROLES: HrRole[] = ["HR Executive", "HR Manager", "Manager", "Admin", "CEO", "Super Admin"];

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
export const CAN_MANAGE_USERS_ROLES: HrRole[] = ["CEO", "Admin", "Super Admin"];
export const canManageUsers = (role?: HrRole) => !!role && CAN_MANAGE_USERS_ROLES.includes(role);

/** Roles allowed to bulk-import the employee master from Excel. */
export const CAN_IMPORT_ROLES: HrRole[] = ["CEO", "Admin", "Super Admin"];
export const canImportData = (role?: HrRole) => !!role && CAN_IMPORT_ROLES.includes(role);

/** Roles allowed to create / rename company units (branches). */
export const CAN_MANAGE_UNITS_ROLES: HrRole[] = ["CEO", "Admin", "Super Admin"];
export const canManageUnits = (role?: HrRole) => !!role && CAN_MANAGE_UNITS_ROLES.includes(role);

// ---- Go-live data lock ----------------------------------------------------
// Migration phase: Admin feeds the historical data and may edit everything.
// Once the data is verified and Admin confirms it, the master data is LOCKED —
// edit/delete controls disappear for everyone except CEO and Super Admin, so a
// figure that feeds salary / PF / ESI / OT / incentives / agent commission (and
// therefore a statutory return) can't be changed casually after go-live.

/** Roles that keep edit rights after the data has been locked. */
export const CAN_EDIT_LOCKED_ROLES: HrRole[] = ["CEO", "Super Admin"];
/** Roles that may edit master data during the (unlocked) data-feeding phase. */
export const CAN_EDIT_UNLOCKED_ROLES: HrRole[] = ["CEO", "Super Admin", "Admin", "HR Manager"];
/** Roles that may confirm-and-lock, or re-open, the master data. */
export const CAN_LOCK_ROLES: HrRole[] = ["CEO", "Super Admin", "Admin"];
export const canLockData = (role?: HrRole) => !!role && CAN_LOCK_ROLES.includes(role);

/**
 * May this user edit master data right now?
 * Unlocked (feeding phase) → Admin/HR Manager/CEO/Super Admin.
 * Locked (live)            → CEO / Super Admin only.
 */
export function canEditData(role: HrRole | undefined, locked: boolean): boolean {
  if (!role) return false;
  return locked ? CAN_EDIT_LOCKED_ROLES.includes(role) : CAN_EDIT_UNLOCKED_ROLES.includes(role);
}

export interface DataLock {
  locked: boolean;
  at?: string;
  by?: string;
  note?: string;
}

/**
 * Recording an exit or a re-join, and editing an already-recorded exit, is
 * restricted to CEO / Super Admin: it moves someone off the roll, changes the
 * on-roll report and drives the full-and-final settlement.
 */
export const CAN_MANAGE_EXITS_ROLES: HrRole[] = ["CEO", "Super Admin"];
export const canManageExits = (role?: HrRole) => !!role && CAN_MANAGE_EXITS_ROLES.includes(role);

/** Roles allowed to extend the master data (categories, departments, reports). */
export const CAN_MANAGE_MASTERS_ROLES: HrRole[] = ["CEO", "Admin", "Super Admin"];
export const canManageMasters = (role?: HrRole) => !!role && CAN_MANAGE_MASTERS_ROLES.includes(role);

/**
 * A report Admin/CEO builds in the app: pick the columns, pick who it covers,
 * save it, and it runs against live data — no code change needed.
 */
export type ReportScope = "all" | "category" | "unit" | "department" | "employees";

export interface CustomReport {
  id: string;
  name: string;
  description?: string;
  /** Column keys from REPORT_FIELDS, in the order they should appear. */
  fields: string[];
  scope: ReportScope;
  /** Category id / unit name / department name, or the employee ids for "employees". */
  scopeValues: string[];
  createdAt: string;
  createdBy: string;
}

/** The two branches Mehala runs today — seeded; Admin/CEO can add/rename more. */
export const SEED_UNITS = ["Unit 1", "Unit 2"];

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
  halfDays?: number;        // count of half-day marks (the daily report H column)
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

/**
 * OT edit lock: any user may edit OT within the current week (7 days of the
 * operational date); once that week has passed only Admin/CEO can change it.
 */
export const CAN_EDIT_LOCKED_OT_ROLES: HrRole[] = ["CEO", "Admin", "Super Admin"];
export function canEditOt(role?: HrRole): boolean {
  if (role && CAN_EDIT_LOCKED_OT_ROLES.includes(role)) return true;
  const ref = Date.parse(`${TODAY}T00:00:00`);
  const now = Date.now();
  return now >= ref && now - ref <= 7 * 24 * 60 * 60 * 1000;
}

/** Status for a single employee-day in the attendance register. */
/**
 * One day's mark. "Half Day" counts as 0.5 of a working day for pay and for the
 * daily report's H column — the mill marks it when a worker leaves mid-shift.
 */
export type AttendanceStatus = "Present" | "Half Day" | "Absent" | "Leave" | "Holiday";

/** Fraction of a working day each mark contributes to days-worked. */
export const DAY_CREDIT: Record<AttendanceStatus, number> = {
  Present: 1, "Half Day": 0.5, Absent: 0, Leave: 0, Holiday: 0,
};

/** One employee-day punch record — the source of truth for the monthly summary. */
export interface DailyAttendance {
  empId: string;
  date: string;          // YYYY-MM-DD
  status: AttendanceStatus;
  otHours?: number;
  source: "import" | "manual";
}

/**
 * A dated joining / re-joining / exit event. The on-roll daily report is built
 * from these: Closing = Opening + New Join + Re-join − Left, per category and
 * unit. Logged automatically whenever an employee is added or their status
 * changes to/from Exited, so the movement ledger can't drift from the master.
 */
export type MovementType = "New Join" | "Re-join" | "Left";

export interface Movement {
  id: string;
  empId: string;
  empName: string;
  type: MovementType;
  date: string;              // YYYY-MM-DD
  unit?: string;
  category: HrEmployee["category"];
  department?: string;
  note?: string;
  by?: string;
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
export const CAN_PURGE_ROLES: HrRole[] = ["CEO", "Admin", "Super Admin"];
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
  let halfDays = 0;
  for (const d of days) {
    const credit = DAY_CREDIT[d.status] ?? 0;
    if (credit > 0) {
      daysWorked += credit;
      otHours += d.otHours ?? 0;
      // A half day still counts as the Saturday having been worked.
      if (isSaturdayDate(d.date)) saturdaysWorked += 1;
      weekDaysWorked[Math.min(3, Math.floor((Number(d.date.slice(8, 10)) - 1) / 7))] += credit;
    } else if (d.status === "Absent") {
      absent += 1;
    } else if (d.status === "Leave") {
      leaveCount += 1;
    }
    if (d.status === "Half Day") halfDays += 1;
  }
  // Keep the stored figures to one decimal — half days make these fractional.
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return {
    empId, month: CURRENT_MONTH, daysWorked: r1(daysWorked), saturdaysWorked,
    totalSaturdays: TOTAL_SATURDAYS, absent, leave: leaveCount, lop: leaveCount, otHours,
    weekDaysWorked: weekDaysWorked.map(r1), halfDays,
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
  units: string[];
  dataLock: DataLock;
  movements: Movement[];
  customCategories: WorkerCategory[];
  departments: string[];
  reports: CustomReport[];

  login: (u: HrUser) => void;
  setDataLock: (locked: boolean, note?: string) => { ok: true } | { ok: false; error: string };
  addMovement: (m: Omit<Movement, "id" | "by">) => void;
  markLeft: (empId: string, exit: Omit<ExitRecord, "recordedBy" | "recordedAt">) => { ok: true } | { ok: false; error: string };
  markRejoin: (empId: string, rejoin: { rejoinDate: string; note?: string }) => { ok: true } | { ok: false; error: string };
  updateExit: (empId: string, patch: Partial<ExitRecord>) => { ok: true } | { ok: false; error: string };
  addCategory: (c: Omit<WorkerCategory, "id"> & { id?: string }) => { ok: true } | { ok: false; error: string };
  addDepartment: (name: string) => { ok: true } | { ok: false; error: string };
  saveReport: (r: Omit<CustomReport, "id" | "createdAt" | "createdBy"> & { id?: string }) => { ok: true } | { ok: false; error: string };
  deleteReport: (id: string) => void;
  logout: () => void;
  addHrUser: (a: { loginId: string; password: string; name: string; role: HrRole }) => { ok: true } | { ok: false; error: string };
  updateHrUser: (id: string, patch: Partial<Pick<HrUserAccount, "name" | "role" | "loginId" | "active">>) => { ok: true } | { ok: false; error: string };
  resetHrUserPassword: (id: string, newPassword: string) => void;
  deleteHrUser: (id: string) => { ok: true } | { ok: false; error: string };
  updateEmployee: (id: string, patch: Partial<HrEmployee>) => void;
  importEmployees: (emps: HrEmployee[]) => { added: number; updated: number };
  addUnit: (name: string) => { ok: true } | { ok: false; error: string };
  renameUnit: (oldName: string, newName: string) => { ok: true } | { ok: false; error: string };
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

/**
 * Bootstrap the movement ledger from what the master already knows: every
 * employee's date of joining is a "New Join", and anyone already Exited gets a
 * "Left" on their last recorded day. From go-live onwards the ledger grows from
 * real events instead.
 */
function seedMovements(): Movement[] {
  const out: Movement[] = [];
  let n = 1;
  for (const e of HR_EMPLOYEES) {
    if (e.doj) {
      out.push({ id: `MOV-${n++}`, empId: e.id, empName: e.name, type: "New Join", date: e.doj,
        unit: e.unit ?? seedUnitFor(e.id), category: e.category, department: e.department, by: "System (from DOJ)" });
    }
    if (e.status === "Exited") {
      out.push({ id: `MOV-${n++}`, empId: e.id, empName: e.name, type: "Left", date: TODAY,
        unit: e.unit ?? seedUnitFor(e.id), category: e.category, department: e.department, by: "System (status = Exited)" });
    }
  }
  return out;
}

const seed = () => ({
  employees: HR_EMPLOYEES.map((e) => {
    const withUnit = { ...e, unit: e.unit ?? seedUnitFor(e.id), training: e.training ?? seedTrainingFor(e.id, e.department) };
    if (e.id === "EMP-1004") return { ...withUnit, salaryStatus: "On Hold" as const, salaryStatusReason: "Absconded — final settlement pending" };
    if (e.id === "EMP-1010") return { ...withUnit, salaryStatus: "Pending" as const, salaryStatusReason: "Attendance shortfall — verifying days worked" };
    if (e.id === "EMP-0733") return { ...withUnit, salaryStatus: "Pending" as const, salaryStatusReason: "Bank account not yet submitted" };
    return withUnit;
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
  units: [...SEED_UNITS],
  dataLock: { locked: false } as DataLock,
  movements: seedMovements(),
  customCategories: [] as WorkerCategory[],
  departments: [] as string[],
  reports: [] as CustomReport[],
});

export const useHr = create<HrState>()(
  persist(
    (set, get) => ({
      user: null,
      ...seed(),

      login: (u) => set({ user: u }),
      logout: () => set({ user: null }),

      setDataLock: (locked, note) => {
        const role = get().user?.role;
        if (!canLockData(role)) return { ok: false, error: "Only Admin, CEO or Super Admin can lock or re-open the data." };
        // Re-opening locked data is the riskier direction — Admin fed it, but only
        // CEO / Super Admin may unfreeze figures that already back a filing.
        if (!locked && get().dataLock.locked && !CAN_EDIT_LOCKED_ROLES.includes(role!)) {
          return { ok: false, error: "Data is locked — only CEO or Super Admin can re-open it for editing." };
        }
        set((s) => ({
          dataLock: { locked, at: nowStr(), by: s.user ? `${s.user.name} (${s.user.role})` : "System", note },
          audit: withAudit(s, "Data Lock", locked ? "Locked master data" : "Re-opened master data", note ?? (locked ? "Go-live: data verified and frozen" : "Re-opened for correction")),
        }));
        return { ok: true };
      },

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
        set((s) => {
          const before = s.employees.find((e) => e.id === id);
          const employees = s.employees.map((e) => (e.id === id ? { ...e, ...patch } : e));
          const after = employees.find((e) => e.id === id);
          // A change of status to/from Exited is a movement — log it so the
          // on-roll report (Opening + New + Re-join − Left = Closing) balances.
          let movements = s.movements;
          if (before && after && patch.status && before.status !== after.status) {
            const type: MovementType | null =
              after.status === "Exited" ? "Left" : before.status === "Exited" ? "Re-join" : null;
            if (type) {
              movements = [...movements, {
                id: uid("MOV-"), empId: after.id, empName: after.name, type, date: TODAY,
                unit: after.unit, category: after.category, department: after.department,
                by: s.user ? `${s.user.name} (${s.user.role})` : "System", note: `Status ${before.status} → ${after.status}`,
              }];
            }
          }
          return { employees, movements, audit: withAudit(s, "Employees", "Updated employee", `${id}: ${Object.keys(patch).join(", ")}`, id) };
        }),

      importEmployees: (emps) => {
        const before = get().employees;
        const idx = new Map(before.map((e, i) => [e.id, i]));
        let added = 0, updated = 0;
        const newIds: string[] = [];
        const next = [...before];
        for (const e of emps) {
          const at = idx.get(e.id);
          if (at !== undefined) { next[at] = e; updated++; }
          else { idx.set(e.id, next.length); next.push(e); added++; newIds.push(e.id); }
        }
        // Reconcile the units master so any branch named in the sheet becomes a
        // selectable/filterable unit ("allocation never misses").
        set((s) => {
          const known = new Set(s.units.map((u) => u.toLowerCase()));
          const discovered: string[] = [];
          for (const e of emps) {
            const u = (e.unit ?? "").trim();
            if (u && !known.has(u.toLowerCase())) { known.add(u.toLowerCase()); discovered.push(u); }
          }
          const joined = next.filter((e) => newIds.includes(e.id));
          return {
            employees: next,
            units: discovered.length ? [...s.units, ...discovered] : s.units,
            movements: [...s.movements, ...joined.map((e) => ({
              id: uid("MOV-"), empId: e.id, empName: e.name, type: "New Join" as MovementType,
              date: e.doj || TODAY, unit: e.unit, category: e.category, department: e.department,
              by: s.user ? `${s.user.name} (${s.user.role})` : "System", note: "Bulk import",
            }))],
            audit: withAudit(s, "Employees", "Bulk import (Excel)", `${added} added, ${updated} updated (${emps.length} rows)${discovered.length ? `, ${discovered.length} new unit(s)` : ""}`),
          };
        });
        return { added, updated };
      },

      addMovement: (m) =>
        set((s) => ({
          movements: [...s.movements, { ...m, id: uid("MOV-"), by: s.user ? `${s.user.name} (${s.user.role})` : "System" }],
          audit: withAudit(s, "On-roll", m.type, `${m.empName} (${m.empId}) — ${m.date}${m.unit ? ` · ${m.unit}` : ""}`, m.empId),
        })),

      markLeft: (empId, exit) => {
        const st = get();
        if (!canManageExits(st.user?.role)) return { ok: false, error: "Only CEO or Super Admin can record an exit." };
        const e = st.employees.find((x) => x.id === empId);
        if (!e) return { ok: false, error: "Employee not found." };
        if (e.status === "Exited") return { ok: false, error: `${e.name} is already marked as left.` };
        const rec: ExitRecord = {
          ...exit,
          agentIdAtExit: exit.agentIdAtExit ?? e.agentId,
          recordedBy: st.user ? `${st.user.name} (${st.user.role})` : "System",
          recordedAt: nowStr(),
        };
        set((s) => ({
          employees: s.employees.map((x) => (x.id === empId
            ? { ...x, status: "Exited" as const, conduct: exit.reason === "Absconded" ? "Absconded" as const : x.conduct, exit: rec }
            : x)),
          // The movement ledger is what the on-roll report reconciles against.
          movements: [...s.movements, {
            id: uid("MOV-"), empId, empName: e.name, type: "Left" as MovementType, date: exit.exitDate,
            unit: e.unit, category: e.category, department: e.department,
            by: s.user ? `${s.user.name} (${s.user.role})` : "System",
            note: `${exit.reason}${exit.settled ? " · settled" : " · settlement pending"}`,
          }],
          audit: withAudit(s, "Employees", "Marked left", `${e.name} (${empId}) — ${exit.reason} on ${exit.exitDate}, ${exit.settled ? "settled" : "settlement pending"}`, empId),
        }));
        return { ok: true };
      },

      markRejoin: (empId, rejoin) => {
        const st = get();
        if (!canManageExits(st.user?.role)) return { ok: false, error: "Only CEO or Super Admin can record a re-join." };
        const e = st.employees.find((x) => x.id === empId);
        if (!e) return { ok: false, error: "Employee not found." };
        if (e.status !== "Exited") return { ok: false, error: `${e.name} is not marked as left.` };
        // An unsettled exit doesn't block a re-join — the UI warns first, and the
        // settlement stays visible in the exit history.
        set((s) => ({
          employees: s.employees.map((x) => (x.id === empId
            ? {
                ...x, status: "Active" as const, conduct: "Proper" as const, exit: undefined,
                rejoins: [...(x.rejoins ?? []), {
                  rejoinDate: rejoin.rejoinDate, previousExitDate: x.exit?.exitDate, note: rejoin.note,
                  recordedBy: s.user ? `${s.user.name} (${s.user.role})` : "System", recordedAt: nowStr(),
                }],
              }
            : x)),
          movements: [...s.movements, {
            id: uid("MOV-"), empId, empName: e.name, type: "Re-join" as MovementType, date: rejoin.rejoinDate,
            unit: e.unit, category: e.category, department: e.department,
            by: s.user ? `${s.user.name} (${s.user.role})` : "System",
            note: rejoin.note ?? `Re-joined (previously left ${e.exit?.exitDate ?? "—"})`,
          }],
          audit: withAudit(s, "Employees", "Marked re-join", `${e.name} (${empId}) — re-joined ${rejoin.rejoinDate}`, empId),
        }));
        return { ok: true };
      },

      updateExit: (empId, patch) => {
        const st = get();
        if (!canManageExits(st.user?.role)) return { ok: false, error: "Only CEO or Super Admin can edit an exit record." };
        const e = st.employees.find((x) => x.id === empId);
        if (!e?.exit) return { ok: false, error: "No exit record to edit." };
        set((s) => ({
          employees: s.employees.map((x) => (x.id === empId && x.exit ? { ...x, exit: { ...x.exit, ...patch } } : x)),
          audit: withAudit(s, "Employees", "Edited exit record", `${e.name} (${empId}): ${Object.keys(patch).join(", ")}`, empId),
        }));
        return { ok: true };
      },

      addCategory: (c) => {
        const label = c.label.trim();
        if (!label) return { ok: false, error: "Category name is required." };
        const id = (c.id?.trim() || label.toUpperCase().replace(/[^A-Z0-9]+/g, "_")).replace(/^_+|_+$/g, "");
        if (!id) return { ok: false, error: "Could not derive a code for that name." };
        if (allCategories().some((x) => x.id === id || x.label.toLowerCase() === label.toLowerCase()))
          return { ok: false, error: "A category with that name or code already exists." };
        set((s) => ({
          customCategories: [...s.customCategories, { ...c, id, label }],
          audit: withAudit(s, "Masters", "Created worker category", `${label} (${id}) — ${c.wageType}, PF/ESI ${c.statutory ? "yes" : "no"}`),
        }));
        return { ok: true };
      },

      addDepartment: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return { ok: false, error: "Department name is required." };
        if (allDepartments().some((d) => d.toLowerCase() === trimmed.toLowerCase()))
          return { ok: false, error: "That department already exists." };
        set((s) => ({
          departments: [...s.departments, trimmed],
          audit: withAudit(s, "Masters", "Created department", trimmed),
        }));
        return { ok: true };
      },

      saveReport: (r) => {
        const name = r.name.trim();
        if (!name) return { ok: false, error: "Report name is required." };
        if (r.fields.length === 0) return { ok: false, error: "Pick at least one column." };
        if (r.scope !== "all" && r.scopeValues.length === 0) return { ok: false, error: "Pick at least one value for the chosen scope." };
        set((s) => {
          const existing = r.id ? s.reports.find((x) => x.id === r.id) : undefined;
          const rec: CustomReport = {
            ...r, name, id: existing?.id ?? uid("RPT-"),
            createdAt: existing?.createdAt ?? nowStr(),
            createdBy: existing?.createdBy ?? (s.user ? `${s.user.name} (${s.user.role})` : "System"),
          };
          return {
            reports: existing ? s.reports.map((x) => (x.id === rec.id ? rec : x)) : [...s.reports, rec],
            audit: withAudit(s, "Reports", existing ? "Updated report" : "Created report", `${name} — ${r.fields.length} column(s), scope ${r.scope}`),
          };
        });
        return { ok: true };
      },

      deleteReport: (id) =>
        set((s) => {
          const r = s.reports.find((x) => x.id === id);
          return { reports: s.reports.filter((x) => x.id !== id), audit: withAudit(s, "Reports", "Deleted report", r?.name ?? id) };
        }),

      addUnit: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return { ok: false, error: "Unit name can't be empty." };
        if (get().units.some((u) => u.toLowerCase() === trimmed.toLowerCase())) return { ok: false, error: "That unit already exists." };
        set((s) => ({ units: [...s.units, trimmed], audit: withAudit(s, "Units & Branches", "Created unit", trimmed) }));
        return { ok: true };
      },

      renameUnit: (oldName, newName) => {
        const trimmed = newName.trim();
        if (!trimmed) return { ok: false, error: "Unit name can't be empty." };
        if (!get().units.some((u) => u === oldName)) return { ok: false, error: "Unit not found." };
        if (get().units.some((u) => u.toLowerCase() === trimmed.toLowerCase() && u !== oldName)) return { ok: false, error: "Another unit already has that name." };
        set((s) => ({
          units: s.units.map((u) => (u === oldName ? trimmed : u)),
          employees: s.employees.map((e) => (e.unit === oldName ? { ...e, unit: trimmed } : e)),
          audit: withAudit(s, "Units & Branches", "Renamed unit", `${oldName} → ${trimmed}`),
        }));
        return { ok: true };
      },

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
    {
      name: "mehala-erp-hr-v4",
      version: 2,
      // v0 → v1: company units — backfill a branch on every employee.
      // v1 → v2: cross-skill training — backfill so the redeployment AI has data,
      //          and introduce the go-live data lock (defaults to unlocked).
      migrate: (persisted, _version) => {
        const st = persisted as Partial<HrState> | undefined;
        if (!st) return st as unknown as HrState;
        if (!Array.isArray(st.units) || st.units.length === 0) st.units = [...SEED_UNITS];
        if (!st.dataLock) st.dataLock = { locked: false };
        if (Array.isArray(st.employees)) st.employees = st.employees.map((e) => ({
          ...e,
          unit: e.unit ?? seedUnitFor(e.id),
          training: e.training ?? seedTrainingFor(e.id, e.department),
        }));
        return st as HrState;
      },
    }
  )
);

/**
 * The one hook every screen uses to decide whether to render its edit / delete
 * controls. Before go-live (unlocked) Admin & HR Manager can edit everything;
 * after Admin confirms the data, only CEO / Super Admin can.
 */
export function useCanEdit(): boolean {
  const role = useHr((s) => s.user?.role);
  const locked = useHr((s) => s.dataLock.locked);
  return canEditData(role, locked);
}

/** True once the master data has been confirmed and frozen for go-live. */
export function useDataLocked(): boolean {
  return useHr((s) => s.dataLock.locked);
}

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

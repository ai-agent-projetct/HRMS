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

export type HrRole = "HR Manager" | "HR Executive" | "Manager" | "CEO" | "Admin";

export interface HrUser {
  name: string;
  role: HrRole;
}

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
}

/** The date the portal treats as "today" for the AI daily briefing. */
export const TODAY = "2026-07-25";

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
  const by = s.user ? `${s.user.name} (${s.user.role})` : "System";
  return [{ id: uid("AUD-"), at: nowStr(), by, module, action, detail, empId }, ...s.audit].slice(0, 800);
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
  advances: Advance[];
  deductions: MonthlyDeduction[];
  weeklyPaid: string[]; // keys: `${empId}|${month}|W${weekIdx}`
  appraisals: AppraisalRecord[];
  audit: AuditEntry[];

  login: (u: HrUser) => void;
  logout: () => void;
  updateEmployee: (id: string, patch: Partial<HrEmployee>) => void;
  updateHealth: (id: string, patch: Partial<HrEmployee["health"]>) => void;
  setConduct: (id: string, conduct: HrEmployee["conduct"]) => void;
  setSalaryStatus: (id: string, status: NonNullable<HrEmployee["salaryStatus"]>, reason?: string) => void;
  setAttendance: (empId: string, patch: Partial<AttendanceRecord>) => void;
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
  advances: [...SEED_ADVANCES],
  deductions: seedDeductions(),
  weeklyPaid: [] as string[],
  appraisals: [] as AppraisalRecord[],
  audit: [] as AuditEntry[],
});

export const useHr = create<HrState>()(
  persist(
    (set) => ({
      user: null,
      ...seed(),

      login: (u) => set({ user: u }),
      logout: () => set({ user: null }),

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

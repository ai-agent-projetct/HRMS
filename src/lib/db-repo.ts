/**
 * Data-access layer between the LoomHR app model and MySQL.
 *
 * loadAll()/saveAll() move the whole HR state to and from the database;
 * individual loaders power the API. Full-state save uses delete-then-insert
 * per collection (the dataset is small) so it always matches the app exactly.
 */

import { getPool, query } from "@/lib/db";
import { SCHEMA } from "@/lib/db-schema";
import type { HrEmployee } from "@/lib/hr-data";
import type {
  AttendanceRecord, Advance, MonthlyDeduction, AppraisalRecord, LeaveRequest, PayslipSend, TransferBatch, AuditEntry,
} from "@/stores/hr";

export interface HrState {
  employees: HrEmployee[];
  attendance: AttendanceRecord[];
  advances: Advance[];
  deductions: MonthlyDeduction[];
  weeklyPaid: string[];
  appraisals: AppraisalRecord[];
  leave: LeaveRequest[];
  payslipLog: PayslipSend[];
  transfers: TransferBatch[];
  audit: AuditEntry[];
}

const j = (v: unknown) => (v == null ? null : JSON.stringify(v));
const p = <T,>(v: unknown, fallback: T): T => {
  if (v == null) return fallback;
  if (typeof v === "object") return v as T;
  try { return JSON.parse(String(v)) as T; } catch { return fallback; }
};

export async function ensureSchema(): Promise<void> {
  for (const stmt of SCHEMA) await query(stmt);
}

// ---- Employees ------------------------------------------------------------

function empToRow(e: HrEmployee): Record<string, unknown> {
  return {
    id: e.id, salutation: e.salutation, name: e.name, gender: e.gender, dob: e.dob, blood_group: e.bloodGroup,
    role: e.role, department: e.department, section: e.section ?? null, grade: e.grade, reports_to: e.reportsTo,
    employment_type: e.employmentType, status: e.status, doj: e.doj, prev_exp_years: e.prevExpYears, prev_exp_detail: e.prevExpDetail,
    phone: e.phone, alt_phone: e.altPhone, email: e.email, address: e.address, temporary_address: e.temporaryAddress ?? null,
    accommodation: e.accommodation ?? null, emergency_contact: e.emergencyContact, emergency_phone: e.emergencyPhone ?? null,
    qualification: e.qualification, institution: e.institution, pass_year: e.passYear,
    aadhaar: e.aadhaar, pan: e.pan, uan: e.uan, esi_no: e.esiNo, monthly_gross: e.monthlyGross, ctc: e.ctc,
    wage_type: e.wageType, category: e.category, category_other: e.categoryOther ?? null, shift_id: e.shiftId,
    salary_per_day: e.salaryPerDay ?? null, agent_id: e.agentId ?? null, conduct: e.conduct,
    pf_applicable: e.pfApplicable ? 1 : 0, tds_applicable: e.tdsApplicable ? 1 : 0,
    salary_status: e.salaryStatus ?? "Paid", salary_status_reason: e.salaryStatusReason ?? null,
    token_no: e.tokenNo ?? null, dept_code: e.deptCode ?? null, pf_code: e.pfCode ?? null,
    statement: j(e.statement), health: j(e.health), documents: j(e.documents),
    salary_history: j(e.salaryHistory), bank_history: j(e.bankHistory), leave_bal: j(e.leave),
  };
}

function rowToEmp(r: Record<string, unknown>): HrEmployee {
  const s = (k: string) => (r[k] == null ? undefined : String(r[k]));
  const n = (k: string) => Number(r[k] ?? 0);
  return {
    id: String(r.id), salutation: s("salutation") ?? "", name: String(r.name), gender: (s("gender") as HrEmployee["gender"]) ?? "Male",
    dob: s("dob") ?? "", bloodGroup: s("blood_group") ?? "—",
    role: s("role") ?? "", department: s("department") ?? "", section: s("section"), grade: s("grade") ?? "", reportsTo: s("reports_to") ?? "—",
    employmentType: (s("employment_type") as HrEmployee["employmentType"]) ?? "Experienced", status: (s("status") as HrEmployee["status"]) ?? "Active",
    doj: s("doj") ?? "", prevExpYears: n("prev_exp_years"), prevExpDetail: s("prev_exp_detail") ?? "",
    phone: s("phone") ?? "—", altPhone: s("alt_phone") ?? "—", email: s("email") ?? "—", address: s("address") ?? "—",
    temporaryAddress: s("temporary_address"), accommodation: s("accommodation"), emergencyContact: s("emergency_contact") ?? "—", emergencyPhone: s("emergency_phone"),
    qualification: s("qualification") ?? "—", institution: s("institution") ?? "—", passYear: n("pass_year"),
    aadhaar: s("aadhaar") ?? "—", pan: s("pan") ?? "—", uan: s("uan") ?? "—", esiNo: s("esi_no") ?? "—",
    monthlyGross: n("monthly_gross"), ctc: n("ctc"),
    wageType: (s("wage_type") as HrEmployee["wageType"]) ?? "Monthly", category: (s("category") as HrEmployee["category"]) ?? "PERMANENT",
    categoryOther: s("category_other"), shiftId: s("shift_id") ?? "SH-G", salaryPerDay: r.salary_per_day == null ? undefined : n("salary_per_day"),
    agentId: s("agent_id"), conduct: (s("conduct") as HrEmployee["conduct"]) ?? "Proper",
    pfApplicable: !!Number(r.pf_applicable), tdsApplicable: !!Number(r.tds_applicable),
    salaryStatus: s("salary_status") as HrEmployee["salaryStatus"], salaryStatusReason: s("salary_status_reason"),
    tokenNo: s("token_no"), deptCode: s("dept_code"), pfCode: s("pf_code"),
    statement: p(r.statement, undefined), health: p(r.health, undefined),
    documents: p(r.documents, []), salaryHistory: p(r.salary_history, []), bankHistory: p(r.bank_history, []),
    leave: p(r.leave_bal, { el: 0, cl: 0, sl: 0, lopThisMonth: 0 }),
  };
}

async function replaceAll(table: string, cols: string[], rows: Record<string, unknown>[]) {
  const pool = getPool();
  await pool.query(`DELETE FROM ${table}`);
  if (!rows.length) return;
  const placeholders = "(" + cols.map(() => "?").join(",") + ")";
  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const sql = `INSERT INTO ${table} (${cols.join(",")}) VALUES ${chunk.map(() => placeholders).join(",")}`;
    const params = chunk.flatMap((row) => cols.map((c) => row[c] ?? null));
    await pool.query(sql, params);
  }
}

// ---- Full-state save / load -----------------------------------------------

export async function saveAll(st: HrState): Promise<void> {
  await ensureSchema();
  const empCols = Object.keys(empToRow(st.employees[0] ?? ({ id: "x" } as HrEmployee)));
  await replaceAll("employees", empCols, st.employees.map(empToRow));
  await replaceAll("attendance", ["emp_id", "month", "days_worked", "saturdays_worked", "total_saturdays", "absent", "leaves", "lop", "ot_hours", "week_days_worked"],
    st.attendance.map((a) => ({ emp_id: a.empId, month: a.month, days_worked: a.daysWorked, saturdays_worked: a.saturdaysWorked, total_saturdays: a.totalSaturdays, absent: a.absent, leaves: a.leave, lop: a.lop, ot_hours: a.otHours, week_days_worked: j(a.weekDaysWorked) })));
  await replaceAll("advances", ["id", "emp_id", "emp_name", "date", "amount", "reason", "monthly_recovery", "recovered", "status"],
    st.advances.map((a) => ({ id: a.id, emp_id: a.empId, emp_name: a.empName, date: a.date, amount: a.amount, reason: a.reason, monthly_recovery: a.monthlyRecovery, recovered: a.recovered, status: a.status })));
  await replaceAll("monthly_deductions", ["emp_id", "month", "mess", "others", "others_note"],
    st.deductions.map((d) => ({ emp_id: d.empId, month: d.month, mess: d.mess, others: d.others, others_note: d.othersNote })));
  await replaceAll("weekly_payments", ["emp_id", "month", "week_idx"],
    st.weeklyPaid.map((k) => { const [emp_id, month, w] = k.split("|"); return { emp_id, month, week_idx: Number(String(w).replace("W", "")) }; }));
  await replaceAll("appraisals", ["emp_id", "cycle", "productivity", "quality", "attendance", "discipline", "teamwork", "overall", "increment_pct", "note", "finalized_on"],
    st.appraisals.map((a) => ({ emp_id: a.empId, cycle: a.cycle, productivity: a.productivity, quality: a.quality, attendance: a.attendance, discipline: a.discipline, teamwork: a.teamwork, overall: a.overall, increment_pct: a.incrementPct, note: a.note, finalized_on: a.finalizedOn })));
  await replaceAll("leave_requests", ["id", "emp_id", "emp_name", "type", "from_date", "to_date", "days", "reason", "status", "applied_on"],
    st.leave.map((l) => ({ id: l.id, emp_id: l.empId, emp_name: l.empName, type: l.type, from_date: l.from, to_date: l.to, days: l.days, reason: l.reason, status: l.status, applied_on: l.appliedOn })));
  await replaceAll("payslip_log", ["id", "emp_id", "emp_name", "channel", "month", "net_pay"],
    st.payslipLog.map((x) => ({ id: x.id, emp_id: x.empId, emp_name: x.empName, channel: x.channel, month: x.month, net_pay: x.netPay })));
  await replaceAll("transfer_batches", ["id", "month", "count", "total", "bank_file", "status"],
    st.transfers.map((t) => ({ id: t.id, month: t.month, count: t.count, total: t.total, bank_file: t.bankFile, status: t.status })));
  await replaceAll("audit_log", ["id", "at", "by_user", "module", "action", "detail", "emp_id"],
    (st.audit ?? []).slice(0, 800).map((a) => ({ id: a.id, at: a.at, by_user: a.by, module: a.module, action: a.action, detail: a.detail?.slice(0, 400), emp_id: a.empId ?? null })));
}

export async function loadAll(): Promise<HrState> {
  await ensureSchema();
  const employees = (await query("SELECT * FROM employees ORDER BY id")).map(rowToEmp);
  const attendance = (await query<Record<string, unknown>>("SELECT * FROM attendance")).map((a) => ({ empId: String(a.emp_id), month: String(a.month), daysWorked: Number(a.days_worked), saturdaysWorked: Number(a.saturdays_worked), totalSaturdays: Number(a.total_saturdays), absent: Number(a.absent), leave: Number(a.leaves), lop: Number(a.lop), otHours: Number(a.ot_hours), weekDaysWorked: p(a.week_days_worked, [0, 0, 0, 0]) }));
  const advances = (await query<Record<string, unknown>>("SELECT * FROM advances")).map((a) => ({ id: String(a.id), empId: String(a.emp_id), empName: String(a.emp_name), date: String(a.date), amount: Number(a.amount), reason: String(a.reason ?? ""), monthlyRecovery: Number(a.monthly_recovery), recovered: Number(a.recovered), status: a.status as Advance["status"] }));
  const deductions = (await query<Record<string, unknown>>("SELECT * FROM monthly_deductions")).map((d) => ({ empId: String(d.emp_id), month: String(d.month), mess: Number(d.mess), others: Number(d.others), othersNote: String(d.others_note ?? "") }));
  const weeklyPaid = (await query<Record<string, unknown>>("SELECT * FROM weekly_payments")).map((w) => `${w.emp_id}|${w.month}|W${w.week_idx}`);
  const appraisals = (await query<Record<string, unknown>>("SELECT * FROM appraisals")).map((a) => ({ empId: String(a.emp_id), cycle: String(a.cycle), productivity: Number(a.productivity), quality: Number(a.quality), attendance: Number(a.attendance), discipline: Number(a.discipline), teamwork: Number(a.teamwork), overall: Number(a.overall), incrementPct: Number(a.increment_pct), note: String(a.note ?? ""), finalizedOn: String(a.finalized_on ?? "") }));
  const leave = (await query<Record<string, unknown>>("SELECT * FROM leave_requests")).map((l) => ({ id: String(l.id), empId: String(l.emp_id), empName: String(l.emp_name), type: l.type as LeaveRequest["type"], from: String(l.from_date), to: String(l.to_date), days: Number(l.days), reason: String(l.reason ?? ""), status: l.status as LeaveRequest["status"], appliedOn: String(l.applied_on) }));
  const payslipLog = (await query<Record<string, unknown>>("SELECT * FROM payslip_log")).map((x) => ({ id: String(x.id), empId: String(x.emp_id), empName: String(x.emp_name), channel: x.channel as PayslipSend["channel"], month: String(x.month), netPay: Number(x.net_pay), at: String(x.sent_at ?? "") }));
  const transfers = (await query<Record<string, unknown>>("SELECT * FROM transfer_batches")).map((t) => ({ id: String(t.id), month: String(t.month), count: Number(t.count), total: Number(t.total), bankFile: String(t.bank_file), status: t.status as TransferBatch["status"], at: String(t.created_at ?? "") }));
  const audit = (await query<Record<string, unknown>>("SELECT * FROM audit_log ORDER BY id DESC")).map((a) => ({ id: String(a.id), at: String(a.at), by: String(a.by_user), module: String(a.module), action: String(a.action), detail: String(a.detail ?? ""), empId: a.emp_id ? String(a.emp_id) : undefined }));
  return { employees, attendance, advances, deductions, weeklyPaid, appraisals, leave, payslipLog, transfers, audit };
}

export async function counts(): Promise<Record<string, number>> {
  await ensureSchema();
  const tables = ["employees", "attendance", "advances", "monthly_deductions", "weekly_payments", "appraisals", "leave_requests", "payslip_log", "transfer_batches", "audit_log"];
  const out: Record<string, number> = {};
  for (const t of tables) { const r = await query<{ c: number }>(`SELECT COUNT(*) AS c FROM ${t}`); out[t] = Number(r[0]?.c ?? 0); }
  return out;
}

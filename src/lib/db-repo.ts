/**
 * Data-access layer between the LoomHR app model and MySQL.
 *
 * loadAll()/saveAll() move the whole HR state to and from the database;
 * individual loaders power the API. Full-state save uses delete-then-insert
 * per collection (the dataset is small) so it always matches the app exactly.
 */

import { getPool, query } from "@/lib/db";
import { SCHEMA, MIGRATIONS, TYPE_FIXES } from "@/lib/db-schema";
import { hashPassword, isHashed } from "@/lib/password";
import { SEED_HR_USERS } from "@/lib/seed-data";
import type { HrEmployee } from "@/lib/hr-data";
import type { Agent } from "@/lib/hr-master";
import type {
  AttendanceRecord, DailyAttendance, Advance, MonthlyDeduction, AppraisalRecord, LeaveRequest, PayslipSend, TransferBatch, AuditEntry, RecycleEntry, HrUserAccount, DataLock,
} from "@/stores/hr";

export interface HrState {
  employees: HrEmployee[];
  attendance: AttendanceRecord[];
  dailyAttendance: DailyAttendance[];
  advances: Advance[];
  deductions: MonthlyDeduction[];
  weeklyPaid: string[];
  appraisals: AppraisalRecord[];
  leave: LeaveRequest[];
  payslipLog: PayslipSend[];
  transfers: TransferBatch[];
  audit: AuditEntry[];
  recycleBin: RecycleEntry[];
  hrUsers: HrUserAccount[];
  dataLock?: DataLock;
  customAgents?: Agent[];
}

const j = (v: unknown) => (v == null ? null : JSON.stringify(v));
const p = <T,>(v: unknown, fallback: T): T => {
  if (v == null) return fallback;
  if (typeof v === "object") return v as T;
  try { return JSON.parse(String(v)) as T; } catch { return fallback; }
};

/** One-off column widenings (see TYPE_FIXES). Safe to re-run. */
export async function applyTypeFixes(): Promise<void> {
  await ensureSchema();
  for (const stmt of TYPE_FIXES) await query(stmt);
}

export async function ensureSchema(): Promise<void> {
  for (const stmt of SCHEMA) await query(stmt);
  for (const stmt of MIGRATIONS) {
    try { await query(stmt); } catch { /* older MySQL without IF NOT EXISTS on ADD COLUMN — column likely already applied elsewhere or will no-op */ }
  }
}

// ---- Employees ------------------------------------------------------------

function empToRow(e: HrEmployee): Record<string, unknown> {
  return {
    id: e.id, salutation: e.salutation, name: e.name, father_name: e.fatherName ?? null, gender: e.gender, dob: e.dob, blood_group: e.bloodGroup,
    role: e.role, department: e.department, section: e.section ?? null, grade: e.grade, reports_to: e.reportsTo,
    employment_type: e.employmentType, status: e.status, doj: e.doj, prev_exp_years: e.prevExpYears, prev_exp_detail: e.prevExpDetail,
    phone: e.phone, alt_phone: e.altPhone, email: e.email, address: e.address, temporary_address: e.temporaryAddress ?? null,
    unit: e.unit ?? null, location: e.location ?? null,
    accommodation: e.accommodation ?? null, emergency_contact: e.emergencyContact, emergency_phone: e.emergencyPhone ?? null,
    qualification: e.qualification, institution: e.institution, pass_year: e.passYear,
    aadhaar: e.aadhaar, pan: e.pan, uan: e.uan, esi_no: e.esiNo, monthly_gross: e.monthlyGross, ctc: e.ctc,
    wage_type: e.wageType, category: e.category, category_other: e.categoryOther ?? null, shift_id: e.shiftId,
    salary_per_day: e.salaryPerDay ?? null, agent_id: e.agentId ?? null, referred_by: e.referredBy ?? null, conduct: e.conduct,
    pf_applicable: e.pfApplicable ? 1 : 0, tds_applicable: e.tdsApplicable ? 1 : 0,
    salary_status: e.salaryStatus ?? "Paid", salary_status_reason: e.salaryStatusReason ?? null,
    token_no: e.tokenNo ?? null, dept_code: e.deptCode ?? null, pf_code: e.pfCode ?? null,
    bank_name: e.bankName ?? null, bank_branch: e.bankBranch ?? null, bank_account: e.bankAccount ?? null, bank_ifsc: e.bankIfsc ?? null,
    statement: j(e.statement), health: j(e.health), training: j(e.training), exit_record: j(e.exit), rejoins: j(e.rejoins), documents: j(e.documents),
    salary_history: j(e.salaryHistory), bank_history: j(e.bankHistory), leave_bal: j(e.leave),
  };
}

function rowToEmp(r: Record<string, unknown>): HrEmployee {
  const s = (k: string) => (r[k] == null ? undefined : String(r[k]));
  const n = (k: string) => Number(r[k] ?? 0);
  return {
    id: String(r.id), salutation: s("salutation") ?? "", name: String(r.name), fatherName: s("father_name"), gender: (s("gender") as HrEmployee["gender"]) ?? "Male",
    dob: s("dob") ?? "", bloodGroup: s("blood_group") ?? "—",
    role: s("role") ?? "", department: s("department") ?? "", section: s("section"), grade: s("grade") ?? "", reportsTo: s("reports_to") ?? "—",
    employmentType: (s("employment_type") as HrEmployee["employmentType"]) ?? "Experienced", status: (s("status") as HrEmployee["status"]) ?? "Active",
    doj: s("doj") ?? "", prevExpYears: n("prev_exp_years"), prevExpDetail: s("prev_exp_detail") ?? "",
    phone: s("phone") ?? "—", altPhone: s("alt_phone") ?? "—", email: s("email") ?? "—", address: s("address") ?? "—",
    temporaryAddress: s("temporary_address"), unit: s("unit"), location: s("location"), accommodation: s("accommodation"), emergencyContact: s("emergency_contact") ?? "—", emergencyPhone: s("emergency_phone"),
    qualification: s("qualification") ?? "—", institution: s("institution") ?? "—", passYear: n("pass_year"),
    aadhaar: s("aadhaar") ?? "—", pan: s("pan") ?? "—", uan: s("uan") ?? "—", esiNo: s("esi_no") ?? "—",
    monthlyGross: n("monthly_gross"), ctc: n("ctc"),
    wageType: (s("wage_type") as HrEmployee["wageType"]) ?? "Monthly", category: (s("category") as HrEmployee["category"]) ?? "PERMANENT",
    categoryOther: s("category_other"), shiftId: s("shift_id") ?? "SH-G", salaryPerDay: r.salary_per_day == null ? undefined : n("salary_per_day"),
    agentId: s("agent_id"), referredBy: s("referred_by"), conduct: (s("conduct") as HrEmployee["conduct"]) ?? "Proper",
    pfApplicable: !!Number(r.pf_applicable), tdsApplicable: !!Number(r.tds_applicable),
    salaryStatus: s("salary_status") as HrEmployee["salaryStatus"], salaryStatusReason: s("salary_status_reason"),
    tokenNo: s("token_no"), deptCode: s("dept_code"), pfCode: s("pf_code"),
    bankName: s("bank_name"), bankBranch: s("bank_branch"), bankAccount: s("bank_account"), bankIfsc: s("bank_ifsc"),
    statement: p(r.statement, undefined), health: p(r.health, undefined),
    training: p(r.training, undefined), exit: p(r.exit_record, undefined), rejoins: p(r.rejoins, undefined),
    documents: p(r.documents, []), salaryHistory: p(r.salary_history, []), bankHistory: p(r.bank_history, []),
    leave: p(r.leave_bal, { el: 0, cl: 0, sl: 0, lopThisMonth: 0 }),
  };
}

const TRANSIENT = new Set(["ECONNRESET", "PROTOCOL_CONNECTION_LOST", "ETIMEDOUT", "EPIPE", "ECONNREFUSED"]);

/**
 * Replace a table's rows in ONE transaction: a dropped connection (TiDB
 * Serverless closes long-running ones) rolls back to the old rows instead of
 * leaving the table half-written. Transient network errors retry.
 */
async function replaceAll(table: string, cols: string[], all: Record<string, unknown>[]) {
  // A repeated id (older clients reused ids after a reload) must not fail the whole save — keep the first.
  const seen = new Set<unknown>();
  const rows = cols[0] === "id" ? all.filter((r) => !seen.has(r.id) && !!seen.add(r.id)) : all;
  const placeholders = "(" + cols.map(() => "?").join(",") + ")";
  const chunkSize = 200;
  for (let attempt = 1; ; attempt++) {
    const conn = await getPool().getConnection();
    let fatal = false;
    try {
      await conn.beginTransaction();
      await conn.query(`DELETE FROM ${table}`);
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const sql = `INSERT INTO ${table} (${cols.join(",")}) VALUES ${chunk.map(() => placeholders).join(",")}`;
        await conn.query(sql, chunk.flatMap((row) => cols.map((c) => row[c] ?? null)));
      }
      await conn.commit();
      return;
    } catch (e) {
      fatal = !!(e as { fatal?: boolean }).fatal;
      if (!fatal) { try { await conn.rollback(); } catch { /* connection already gone */ } }
      const code = (e as { code?: string }).code ?? "";
      if (attempt >= 4 || !TRANSIENT.has(code)) throw e;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    } finally {
      if (fatal) conn.destroy(); else conn.release();
    }
  }
}

// ---- App settings: the go-live data lock -----------------------------------
// The lock lives server-side so it is the same for every machine, and so a
// stale tab can't push over master data that has been frozen for filing.

const LOCK_KEY = "data_lock";

export async function loadDataLock(): Promise<DataLock> {
  try {
    const rows = await query<Record<string, unknown>>("SELECT v FROM app_settings WHERE k = ?", [LOCK_KEY]);
    return p(rows[0]?.v, { locked: false } as DataLock);
  } catch {
    return { locked: false };
  }
}

export async function saveDataLock(lock: DataLock): Promise<void> {
  await query("INSERT INTO app_settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)", [LOCK_KEY, JSON.stringify(lock)]);
}

// Agents added at runtime live in app_settings as JSON so every machine sees them.
const AGENTS_KEY = "custom_agents";
async function loadCustomAgents(): Promise<Agent[]> {
  try {
    const rows = await query<Record<string, unknown>>("SELECT v FROM app_settings WHERE k = ?", [AGENTS_KEY]);
    return p(rows[0]?.v, [] as Agent[]);
  } catch {
    return [];
  }
}
async function saveCustomAgents(list: Agent[]): Promise<void> {
  await query("INSERT INTO app_settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)", [AGENTS_KEY, JSON.stringify(list)]);
}

// ---- Full-state save / load -----------------------------------------------

export type DayKey = { empId: string; date: string };
/** A save carries only the collections that changed; day marks may come as a delta. */
export type SaveState = Partial<HrState> & { dailyDelta?: { upsert: DailyAttendance[]; remove: DayKey[] } };

const DAILY_COLS = ["emp_id", "date", "status", "ot_hours", "unit", "source", "shift"];
const dailyRow = (d: DailyAttendance) => ({ emp_id: d.empId, date: d.date, status: d.status, ot_hours: d.otHours ?? 0, unit: d.unit ?? null, source: d.source, shift: d.shift ?? null });

/** Apply changed / removed day marks in one transaction (no full rewrite). */
async function applyDailyDelta(delta: { upsert: DailyAttendance[]; remove: DayKey[] }) {
  if (!delta.upsert.length && !delta.remove.length) return;
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const gone = [...delta.remove, ...delta.upsert.map((d) => ({ empId: d.empId, date: d.date }))];
    for (let i = 0; i < gone.length; i += 300) {
      const c = gone.slice(i, i + 300);
      await conn.query(`DELETE FROM daily_attendance WHERE (emp_id, date) IN (${c.map(() => "(?,?)").join(",")})`, c.flatMap((k) => [k.empId, k.date]));
    }
    const ph = "(" + DAILY_COLS.map(() => "?").join(",") + ")";
    for (let i = 0; i < delta.upsert.length; i += 200) {
      const c = delta.upsert.slice(i, i + 200).map(dailyRow);
      await conn.query(`INSERT INTO daily_attendance (${DAILY_COLS.join(",")}) VALUES ${c.map(() => ph).join(",")}`, c.flatMap((r) => DAILY_COLS.map((k) => (r as Record<string, unknown>)[k] ?? null)));
    }
    await conn.commit();
  } catch (e) {
    try { await conn.rollback(); } catch { /* connection gone */ }
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * Save the collections present in `st` (absent ones are left as they are in
 * the database). Each table is replaced atomically; day marks can arrive as a
 * delta so an attendance click doesn't rewrite the whole month register.
 */
export async function saveAll(st: SaveState): Promise<void> {
  await ensureSchema();
  if (st.dataLock) await saveDataLock(st.dataLock);
  if (st.customAgents) await saveCustomAgents(st.customAgents);
  if (st.employees) {
    const empCols = Object.keys(empToRow(st.employees[0] ?? ({ id: "x" } as HrEmployee)));
    await replaceAll("employees", empCols, st.employees.map(empToRow));
  }
  if (st.attendance)
    await replaceAll("attendance", ["emp_id", "month", "days_worked", "saturdays_worked", "total_saturdays", "absent", "leaves", "lop", "ot_hours", "week_days_worked", "week_shift_ids", "rate", "paid"],
      st.attendance.map((a) => ({ emp_id: a.empId, month: a.month, days_worked: a.daysWorked, saturdays_worked: a.saturdaysWorked, total_saturdays: a.totalSaturdays, absent: a.absent, leaves: a.leave, lop: a.lop, ot_hours: a.otHours, week_days_worked: j(a.weekDaysWorked), week_shift_ids: j(a.weekShiftIds ?? []), rate: a.rate ?? null, paid: j(a.paid) })));
  if (st.dailyDelta) await applyDailyDelta(st.dailyDelta);
  else if (Array.isArray(st.dailyAttendance)) await replaceAll("daily_attendance", DAILY_COLS, st.dailyAttendance.map(dailyRow));
  if (st.advances)
    await replaceAll("advances", ["id", "emp_id", "emp_name", "date", "amount", "reason", "monthly_recovery", "recovered", "status"],
      st.advances.map((a) => ({ id: a.id, emp_id: a.empId, emp_name: a.empName, date: a.date, amount: a.amount, reason: a.reason, monthly_recovery: a.monthlyRecovery, recovered: a.recovered, status: a.status })));
  if (st.deductions)
    await replaceAll("monthly_deductions", ["emp_id", "month", "mess", "others", "others_note", "adv", "pm_diff"],
      st.deductions.map((d) => ({ emp_id: d.empId, month: d.month, mess: d.mess, others: d.others, others_note: d.othersNote, adv: d.adv ?? null, pm_diff: d.pmDiff ?? null })));
  if (st.weeklyPaid)
    await replaceAll("weekly_payments", ["emp_id", "month", "week_idx"],
      st.weeklyPaid.map((k) => { const [emp_id, month, w] = k.split("|"); return { emp_id, month, week_idx: Number(String(w).replace("W", "")) }; }));
  if (st.appraisals)
    await replaceAll("appraisals", ["emp_id", "cycle", "productivity", "quality", "attendance", "discipline", "teamwork", "overall", "increment_pct", "note", "study", "finalized_on"],
      st.appraisals.map((a) => ({ emp_id: a.empId, cycle: a.cycle, productivity: a.productivity, quality: a.quality, attendance: a.attendance, discipline: a.discipline, teamwork: a.teamwork, overall: a.overall, increment_pct: a.incrementPct, note: a.note, study: a.study ?? "", finalized_on: a.finalizedOn })));
  if (st.leave)
    await replaceAll("leave_requests", ["id", "emp_id", "emp_name", "type", "from_date", "to_date", "days", "reason", "status", "applied_on"],
      st.leave.map((l) => ({ id: l.id, emp_id: l.empId, emp_name: l.empName, type: l.type, from_date: l.from, to_date: l.to, days: l.days, reason: l.reason, status: l.status, applied_on: l.appliedOn })));
  if (st.payslipLog)
    await replaceAll("payslip_log", ["id", "emp_id", "emp_name", "channel", "month", "net_pay"],
      st.payslipLog.map((x) => ({ id: x.id, emp_id: x.empId, emp_name: x.empName, channel: x.channel, month: x.month, net_pay: x.netPay })));
  if (st.transfers)
    await replaceAll("transfer_batches", ["id", "month", "count", "total", "bank_file", "status"],
      st.transfers.map((t) => ({ id: t.id, month: t.month, count: t.count, total: t.total, bank_file: t.bankFile, status: t.status })));
  if (st.audit)
    await replaceAll("audit_log", ["id", "at", "by_user", "module", "action", "detail", "emp_id"],
      st.audit.slice(0, 800).map((a) => ({ id: a.id, at: a.at, by_user: a.by, module: a.module, action: a.action, detail: a.detail?.slice(0, 400), emp_id: a.empId ?? null })));
  if (st.recycleBin)
    await replaceAll("recycle_bin", ["id", "type", "label", "sub", "data", "deleted_by", "deleted_at"],
      st.recycleBin.map((r) => ({ id: r.id, type: r.type, label: r.label, sub: r.sub ?? null, data: j(r.data), deleted_by: r.deletedBy, deleted_at: r.deletedAt })));
  if (st.hrUsers) {
    // Clients never hold the stored hash (loadAll blanks it): a blank password
    // keeps the stored one; a new / reset plaintext one is hashed here.
    const stored = new Map((await query<{ id: string; password: string }>("SELECT id, password FROM hr_users")).map((r) => [String(r.id), String(r.password)]));
    const pw = (id: string, p: string) => (!p ? stored.get(id) ?? "" : isHashed(p) ? p : hashPassword(p));
    await replaceAll("hr_users", ["id", "login_id", "password", "name", "role", "active", "created_at", "created_by"],
      st.hrUsers.map((u) => ({ id: u.id, login_id: u.loginId, password: pw(u.id, u.password), name: u.name, role: u.role, active: u.active ? 1 : 0, created_at: u.createdAt, created_by: u.createdBy })));
  }
}

export async function loadAll(): Promise<HrState> {
  await ensureSchema();
  const employees = (await query("SELECT * FROM employees ORDER BY id")).map(rowToEmp);
  const attendance = (await query<Record<string, unknown>>("SELECT * FROM attendance")).map((a) => ({ empId: String(a.emp_id), month: String(a.month), daysWorked: Number(a.days_worked), saturdaysWorked: Number(a.saturdays_worked), totalSaturdays: Number(a.total_saturdays), absent: Number(a.absent), leave: Number(a.leaves), lop: Number(a.lop), otHours: Number(a.ot_hours), weekDaysWorked: p(a.week_days_worked, [0, 0, 0, 0]), weekShiftIds: p(a.week_shift_ids, [] as (string | null)[]), rate: a.rate == null ? undefined : Number(a.rate), paid: p(a.paid, undefined) }));

  const dailyAttendance = (await query<Record<string, unknown>>("SELECT * FROM daily_attendance")).map((d) => ({ empId: String(d.emp_id), date: String(d.date), status: String(d.status) as DailyAttendance["status"], otHours: d.ot_hours == null ? undefined : Number(d.ot_hours), unit: d.unit == null ? undefined : String(d.unit), shift: d.shift == null ? undefined : String(d.shift), source: (String(d.source) === "manual" ? "manual" : "import") as DailyAttendance["source"] }));
  const advances = (await query<Record<string, unknown>>("SELECT * FROM advances")).map((a) => ({ id: String(a.id), empId: String(a.emp_id), empName: String(a.emp_name), date: String(a.date), amount: Number(a.amount), reason: String(a.reason ?? ""), monthlyRecovery: Number(a.monthly_recovery), recovered: Number(a.recovered), status: a.status as Advance["status"] }));
  const deductions = (await query<Record<string, unknown>>("SELECT * FROM monthly_deductions")).map((d) => ({ empId: String(d.emp_id), month: String(d.month), mess: Number(d.mess), others: Number(d.others), othersNote: String(d.others_note ?? ""), adv: d.adv == null ? undefined : Number(d.adv), pmDiff: d.pm_diff == null ? undefined : Number(d.pm_diff) }));
  const weeklyPaid = (await query<Record<string, unknown>>("SELECT * FROM weekly_payments")).map((w) => `${w.emp_id}|${w.month}|W${w.week_idx}`);
  const appraisals = (await query<Record<string, unknown>>("SELECT * FROM appraisals")).map((a) => ({ empId: String(a.emp_id), cycle: String(a.cycle), productivity: Number(a.productivity), quality: Number(a.quality), attendance: Number(a.attendance), discipline: Number(a.discipline), teamwork: Number(a.teamwork), overall: Number(a.overall), incrementPct: Number(a.increment_pct), note: String(a.note ?? ""), study: String(a.study ?? ""), finalizedOn: String(a.finalized_on ?? "") }));
  const leave = (await query<Record<string, unknown>>("SELECT * FROM leave_requests")).map((l) => ({ id: String(l.id), empId: String(l.emp_id), empName: String(l.emp_name), type: l.type as LeaveRequest["type"], from: String(l.from_date), to: String(l.to_date), days: Number(l.days), reason: String(l.reason ?? ""), status: l.status as LeaveRequest["status"], appliedOn: String(l.applied_on) }));
  const payslipLog = (await query<Record<string, unknown>>("SELECT * FROM payslip_log")).map((x) => ({ id: String(x.id), empId: String(x.emp_id), empName: String(x.emp_name), channel: x.channel as PayslipSend["channel"], month: String(x.month), netPay: Number(x.net_pay), at: String(x.sent_at ?? "") }));
  const transfers = (await query<Record<string, unknown>>("SELECT * FROM transfer_batches")).map((t) => ({ id: String(t.id), month: String(t.month), count: Number(t.count), total: Number(t.total), bankFile: String(t.bank_file), status: t.status as TransferBatch["status"], at: String(t.created_at ?? "") }));
  const audit = (await query<Record<string, unknown>>("SELECT * FROM audit_log ORDER BY id DESC")).map((a) => ({ id: String(a.id), at: String(a.at), by: String(a.by_user), module: String(a.module), action: String(a.action), detail: String(a.detail ?? ""), empId: a.emp_id ? String(a.emp_id) : undefined }));
  const recycleBin = (await query<Record<string, unknown>>("SELECT * FROM recycle_bin")).map((r) => ({ id: String(r.id), type: r.type as RecycleEntry["type"], label: String(r.label), sub: r.sub ? String(r.sub) : undefined, data: p(r.data, {}), deletedBy: String(r.deleted_by), deletedAt: String(r.deleted_at) }));
  const hrUsers = (await query<Record<string, unknown>>("SELECT * FROM hr_users")).map((u) => ({ id: String(u.id), loginId: String(u.login_id), password: "", name: String(u.name), role: u.role as HrUserAccount["role"], active: !!Number(u.active), createdAt: String(u.created_at ?? ""), createdBy: String(u.created_by ?? "") }));
  const dataLock = await loadDataLock();
  const customAgents = await loadCustomAgents();
  return { employees, attendance, dailyAttendance, advances, deductions, weeklyPaid, appraisals, leave, payslipLog, transfers, audit, recycleBin, hrUsers, dataLock, customAgents };
}

export async function counts(): Promise<Record<string, number>> {
  await ensureSchema();
  const tables = ["employees", "attendance", "daily_attendance", "advances", "monthly_deductions", "weekly_payments", "appraisals", "leave_requests", "payslip_log", "transfer_batches", "audit_log", "recycle_bin", "hr_users"];
  const out: Record<string, number> = {};
  for (const t of tables) { const r = await query<{ c: number }>(`SELECT COUNT(*) AS c FROM ${t}`); out[t] = Number(r[0]?.c ?? 0); }
  return out;
}

/** One account with its stored hash, for server-side login. Seeds the default accounts into an empty table. */
export async function findLogin(loginId: string): Promise<{ account: HrUserAccount; hash: string } | null> {
  await ensureSchema();
  const [{ n }] = await query<{ n: number }>("SELECT COUNT(*) AS n FROM hr_users");
  if (Number(n) === 0) await saveAll({ hrUsers: SEED_HR_USERS });
  const [u] = await query<Record<string, unknown>>("SELECT * FROM hr_users WHERE LOWER(login_id) = LOWER(?)", [loginId.trim()]);
  if (!u) return null;
  return {
    hash: String(u.password),
    account: { id: String(u.id), loginId: String(u.login_id), password: "", name: String(u.name), role: u.role as HrUserAccount["role"], active: !!Number(u.active), createdAt: String(u.created_at ?? ""), createdBy: String(u.created_by ?? "") },
  };
}

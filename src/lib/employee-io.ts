"use client";

/**
 * Employee import / export schema — the SINGLE source of truth shared by the
 * Excel export, the downloadable template and the bulk-import parser, so a file
 * exported from the app re-imports cleanly with nothing lost.
 *
 * `EMPLOYEE_COLUMNS` defines every column (header + key). `employeeToRow` flattens
 * an employee to that shape for export. `mapRowsToEmployees` resolves uploaded
 * rows back into full employee records (matching category/shift/agent by name,
 * upserting by Emp ID), ready for the store's `importEmployees`.
 */

import type { ExcelColumn } from "@/lib/excel";
import type { HrEmployee, EmpDocument, EmpStatus, EmpType, DocType } from "@/lib/hr-data";
import { GARMENT_ROLES } from "@/lib/hr-data";
import {
  WORKER_CATEGORIES, categoryById, SHIFTS, shiftById, AGENTS, agentById,
  CONDUCT_STATUSES, type WorkerCategoryId, type ConductStatus, type WageType,
} from "@/lib/hr-master";

/** Full column list (order = export column order). Header text is what the user sees in Excel. */
export const EMPLOYEE_COLUMNS: ExcelColumn[] = [
  { header: "Emp ID", key: "id", width: 12 },
  { header: "Salutation", key: "salutation" },
  { header: "Name", key: "name", width: 22 },
  { header: "Gender", key: "gender" },
  { header: "DOB", key: "dob" },
  { header: "Blood Group", key: "bloodGroup" },
  { header: "Category", key: "category", width: 16 },
  { header: "Category (Other)", key: "categoryOther", width: 16 },
  { header: "Role", key: "role", width: 20 },
  { header: "Department", key: "department", width: 16 },
  { header: "Section", key: "section", width: 16 },
  { header: "Grade", key: "grade" },
  { header: "Reports To", key: "reportsTo", width: 16 },
  { header: "Shift", key: "shift" },
  { header: "Employment Type", key: "employmentType" },
  { header: "Status", key: "status" },
  { header: "Date of Joining", key: "doj", width: 14 },
  { header: "Company Branch", key: "unit", width: 14 },
  { header: "Location", key: "location", width: 16 },
  { header: "Agent", key: "agent", width: 20 },
  { header: "Conduct", key: "conduct" },
  { header: "Wage Type", key: "wageType" },
  { header: "Monthly Gross", key: "monthlyGross", width: 14 },
  { header: "Salary Per Day", key: "salaryPerDay", width: 14 },
  { header: "CTC", key: "ctc", width: 12 },
  { header: "PF/ESI Applicable", key: "pfApplicable", width: 16 },
  { header: "TDS Applicable", key: "tdsApplicable", width: 14 },
  { header: "Salary Status", key: "salaryStatus", width: 14 },
  { header: "Salary Status Reason", key: "salaryStatusReason", width: 24 },
  { header: "Token No", key: "tokenNo", width: 12 },
  { header: "Dept Code", key: "deptCode", width: 12 },
  { header: "PF Code", key: "pfCode", width: 18 },
  { header: "Aadhaar No", key: "aadhaar", width: 18 },
  { header: "PAN No", key: "pan", width: 14 },
  { header: "UAN (PF)", key: "uan", width: 16 },
  { header: "ESI No", key: "esiNo", width: 14 },
  { header: "Phone", key: "phone", width: 16 },
  { header: "Alt Phone", key: "altPhone", width: 16 },
  { header: "Email", key: "email", width: 24 },
  { header: "Permanent Address", key: "address", width: 30 },
  { header: "Temporary Address", key: "temporaryAddress", width: 30 },
  { header: "Accommodation", key: "accommodation", width: 18 },
  { header: "Emergency Contact", key: "emergencyContact", width: 24 },
  { header: "Emergency Phone", key: "emergencyPhone", width: 16 },
  { header: "Qualification", key: "qualification", width: 18 },
  { header: "Institution", key: "institution", width: 18 },
  { header: "Pass Year", key: "passYear" },
  { header: "Prev Exp (yrs)", key: "prevExpYears" },
  { header: "Prev Exp Detail", key: "prevExpDetail", width: 26 },
  { header: "Bank Name", key: "bankName", width: 16 },
  { header: "Bank Branch", key: "bankBranch", width: 16 },
  { header: "Bank Account No", key: "bankAccount", width: 20 },
  { header: "Bank IFSC", key: "bankIfsc", width: 14 },
  { header: "Leave EL", key: "leaveEl" },
  { header: "Leave CL", key: "leaveCl" },
  { header: "Leave SL", key: "leaveSl" },
  { header: "LOP This Month", key: "leaveLop" },
];

/** Column names that identify the header row inside a titled export. */
export const EMPLOYEE_HEADER_HINTS = ["Emp ID", "Name"];

const UPLOAD_DOC_TYPES: DocType[] = ["Aadhaar", "PAN", "Degree Certificate", "Experience Certificate", "Bank Passbook", "Photo"];
const EMP_STATUSES: EmpStatus[] = ["Active", "On Notice", "Probation", "Exited"];
const SALARY_STATUSES = ["Paid", "Pending", "On Hold"] as const;

const norm = (s: string) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** The current (active) bank on file — top-level fields first, else the "Current" history row. */
function currentBankOf(e: HrEmployee): { name: string; branch: string; account: string; ifsc: string } {
  const active = [...e.bankHistory].reverse().find((b) => b.to === "Current") ?? e.bankHistory.at(-1);
  return {
    name: e.bankName ?? active?.bank ?? "",
    branch: e.bankBranch ?? "",
    account: e.bankAccount ?? active?.account ?? "",
    ifsc: e.bankIfsc ?? active?.ifsc ?? "",
  };
}

/** Flatten an employee into a row keyed by EMPLOYEE_COLUMNS keys (for export / template). */
export function employeeToRow(e: HrEmployee): Record<string, unknown> {
  const cat = categoryById(e.category);
  const sh = shiftById(e.shiftId);
  const agent = agentById(e.agentId);
  const bank = currentBankOf(e);
  return {
    id: e.id,
    salutation: e.salutation,
    name: e.name,
    gender: e.gender,
    dob: e.dob,
    bloodGroup: e.bloodGroup,
    category: e.category === "MC_OTHERS" && e.categoryOther ? e.categoryOther : cat?.label ?? e.category,
    categoryOther: e.categoryOther ?? "",
    role: e.role,
    department: e.department,
    section: e.section ?? "",
    grade: e.grade,
    reportsTo: e.reportsTo,
    shift: sh ? sh.code : e.shiftId,
    employmentType: e.employmentType,
    status: e.status,
    doj: e.doj,
    unit: e.unit ?? "",
    location: e.location ?? "",
    agent: agent ? agent.name : "",
    conduct: e.conduct,
    wageType: e.wageType,
    monthlyGross: e.monthlyGross,
    salaryPerDay: e.salaryPerDay ?? "",
    ctc: e.ctc,
    pfApplicable: (e.pfApplicable ?? cat?.statutory) ? "Yes" : "No",
    tdsApplicable: e.tdsApplicable ? "Yes" : "No",
    salaryStatus: e.salaryStatus ?? "Paid",
    salaryStatusReason: e.salaryStatusReason ?? "",
    tokenNo: e.tokenNo ?? "",
    deptCode: e.deptCode ?? "",
    pfCode: e.pfCode ?? "",
    aadhaar: e.aadhaar,
    pan: e.pan,
    uan: e.uan,
    esiNo: e.esiNo,
    phone: e.phone,
    altPhone: e.altPhone,
    email: e.email,
    address: e.address,
    temporaryAddress: e.temporaryAddress ?? "",
    accommodation: e.accommodation ?? "",
    emergencyContact: e.emergencyContact,
    emergencyPhone: e.emergencyPhone ?? "",
    qualification: e.qualification,
    institution: e.institution,
    passYear: e.passYear || "",
    prevExpYears: e.prevExpYears,
    prevExpDetail: e.prevExpDetail,
    bankName: bank.name,
    bankBranch: bank.branch,
    bankAccount: bank.account,
    bankIfsc: bank.ifsc,
    leaveEl: e.leave.el,
    leaveCl: e.leave.cl,
    leaveSl: e.leave.sl,
    leaveLop: e.leave.lopThisMonth,
  };
}

// ---- Header → key resolution (tolerant of aliases / old export headers) ----
const NORM_TO_KEY: Record<string, string> = {};
for (const c of EMPLOYEE_COLUMNS) NORM_TO_KEY[norm(c.header)] = c.key;
const ALIASES: Record<string, string> = {
  employeeid: "id", empno: "id", tokenno: "tokenNo", token: "tokenNo",
  dateofbirth: "dob", dob: "dob",
  doj: "doj", dateofjoin: "doj", dateofjoining: "doj",
  type: "employmentType", emptype: "employmentType",
  panno: "pan", pancard: "pan", pancardno: "pan",
  aadharno: "aadhaar", aadhar: "aadhaar", aadharcard: "aadhaar", aadhaarcard: "aadhaar", uidno: "aadhaar",
  uanpf: "uan", uanno: "uan", pfuan: "uan",
  esinumber: "esiNo",
  monthlygross: "monthlyGross", grosssalary: "monthlyGross", gross: "monthlyGross",
  perday: "salaryPerDay", salaryday: "salaryPerDay", wageperday: "salaryPerDay",
  pfesi: "pfApplicable", pf: "pfApplicable", pfapplicable: "pfApplicable",
  tds: "tdsApplicable",
  bank: "bankName", bankaccount: "bankAccount", accountno: "bankAccount", accno: "bankAccount", acno: "bankAccount", account: "bankAccount",
  branch: "bankBranch", ifsc: "bankIfsc", ifsccode: "bankIfsc",
  agentname: "agent", through: "agent",
  place: "location", nativeplace: "location", area: "location",
  unit: "unit", companyunit: "unit", companybranch: "unit", branchunit: "unit",
  el: "leaveEl", cl: "leaveCl", sl: "leaveSl", lop: "leaveLop", lopthismonth: "leaveLop",
  prevexp: "prevExpYears", prevexpyrs: "prevExpYears", previousexperience: "prevExpYears",
  reportsto: "reportsTo", manager: "reportsTo",
};
const NORMS_BY_KEY: Record<string, string[]> = {};
for (const [n, k] of Object.entries({ ...ALIASES, ...NORM_TO_KEY })) (NORMS_BY_KEY[k] ??= []).push(n);

function rowLookup(raw: Record<string, string | number>): Record<string, string> {
  const m: Record<string, string> = {};
  for (const [h, v] of Object.entries(raw)) m[norm(h)] = String(v ?? "").trim();
  return m;
}
function pick(lk: Record<string, string>, key: string): string {
  for (const n of NORMS_BY_KEY[key] ?? []) { const v = lk[n]; if (v !== undefined && v !== "") return v; }
  return "";
}

// ---- Value resolvers ------------------------------------------------------
function resolveCategory(label: string): { id: WorkerCategoryId; other?: string } {
  if (!label) return { id: "PERMANENT" };
  const n = norm(label);
  const byLabel = WORKER_CATEGORIES.find((c) => norm(c.label) === n);
  if (byLabel) return { id: byLabel.id };
  const byId = WORKER_CATEGORIES.find((c) => norm(c.id) === n);
  if (byId) return { id: byId.id };
  return { id: "MC_OTHERS", other: label }; // unknown → custom label under MC & Others
}
function resolveShift(v: string): string | undefined {
  if (!v) return undefined;
  const n = norm(v);
  return SHIFTS.find((s) => norm(s.code) === n || norm(s.id) === n || norm(s.name) === n || norm(`${s.code}${s.name}`) === n)?.id;
}
function resolveAgent(v: string): string | undefined {
  if (!v) return undefined;
  const n = norm(v);
  return AGENTS.find((a) => norm(a.name) === n || norm(a.id) === n)?.id;
}
function findByNorm<T extends string>(list: readonly T[], v: string): T | undefined {
  const n = norm(v);
  return list.find((x) => norm(x) === n);
}
function yesNo(v: string): boolean | undefined {
  if (!v) return undefined;
  const n = norm(v);
  if (["yes", "y", "true", "1", "applicable"].includes(n)) return true;
  if (["no", "n", "false", "0", "notapplicable", "na", "exempt"].includes(n)) return false;
  return undefined;
}
function toInt(v: string): number | undefined {
  if (v === "" || v === undefined) return undefined;
  const num = Number(String(v).replace(/[^0-9.-]/g, ""));
  return isNaN(num) ? undefined : Math.round(num);
}
function wageTypeOf(v: string): WageType | undefined {
  const n = norm(v);
  if (n.startsWith("month")) return "Monthly";
  if (n.startsWith("week")) return "Weekly";
  if (n.startsWith("dai") || n === "day") return "Daily";
  return undefined;
}

function defaultEmployee(id: string, name: string): HrEmployee {
  return {
    id, salutation: "Mr.", name, gender: "Male", dob: "1995-01-01", bloodGroup: "—",
    role: GARMENT_ROLES[0] as string, department: "", grade: "W1", reportsTo: "—",
    employmentType: "Fresher" as EmpType, status: "Probation", doj: "", prevExpYears: 0, prevExpDetail: "Fresher",
    phone: "", altPhone: "—", email: "", address: "—", emergencyContact: "—",
    qualification: "—", institution: "—", passYear: 0,
    aadhaar: "—", pan: "—", uan: "—", esiNo: "—",
    monthlyGross: 0, ctc: 0, wageType: "Monthly", category: "PERMANENT",
    shiftId: "SH-A", conduct: "Proper", pfApplicable: true, tdsApplicable: false,
    documents: [], salaryHistory: [], bankHistory: [], leave: { el: 0, cl: 0, sl: 0, lopThisMonth: 0 },
  };
}

/** Overlay all provided cells of a row onto a base record (existing employee or a fresh template). */
function upsertFromRow(base: HrEmployee, lk: Record<string, string>, isNew: boolean): HrEmployee {
  const e: HrEmployee = { ...base, leave: { ...base.leave } };
  const s = (key: string) => pick(lk, key);
  const str = (key: string, field: keyof HrEmployee) => { const v = s(key); if (v !== "") (e as unknown as Record<string, unknown>)[field] = v; };

  str("name", "name");
  str("salutation", "salutation");
  const g = s("gender"); if (g) e.gender = /^f/i.test(g) ? "Female" : "Male";
  str("dob", "dob");
  str("bloodGroup", "bloodGroup");

  const cat = s("category");
  if (cat) { const r = resolveCategory(cat); e.category = r.id; if (r.other) e.categoryOther = r.other; }
  const catOther = s("categoryOther"); if (catOther) e.categoryOther = catOther;

  str("role", "role");
  str("department", "department");
  str("section", "section");
  str("grade", "grade");
  str("reportsTo", "reportsTo");
  const sh = resolveShift(s("shift")); if (sh) e.shiftId = sh;
  const et = s("employmentType"); if (et) e.employmentType = /^exp/i.test(et) ? "Experienced" : "Fresher";
  const st = findByNorm(EMP_STATUSES, s("status")); if (st) e.status = st;
  str("doj", "doj");
  str("unit", "unit");
  str("location", "location");
  const ag = resolveAgent(s("agent")); if (ag) e.agentId = ag;
  const cond = findByNorm(CONDUCT_STATUSES, s("conduct")); if (cond) e.conduct = cond as ConductStatus;

  const wt = wageTypeOf(s("wageType")); if (wt) e.wageType = wt;
  const mg = toInt(s("monthlyGross")); if (mg !== undefined) e.monthlyGross = mg;
  const spd = toInt(s("salaryPerDay")); if (spd !== undefined) e.salaryPerDay = spd;
  const ctc = toInt(s("ctc")); if (ctc !== undefined) e.ctc = ctc;
  const pf = yesNo(s("pfApplicable")); if (pf !== undefined) e.pfApplicable = pf;
  const tds = yesNo(s("tdsApplicable")); if (tds !== undefined) e.tdsApplicable = tds;
  const ss = findByNorm(SALARY_STATUSES, s("salaryStatus")); if (ss) e.salaryStatus = ss;
  str("salaryStatusReason", "salaryStatusReason");
  str("tokenNo", "tokenNo");
  str("deptCode", "deptCode");
  str("pfCode", "pfCode");

  str("aadhaar", "aadhaar");
  str("pan", "pan");
  str("uan", "uan");
  str("esiNo", "esiNo");

  str("phone", "phone");
  str("altPhone", "altPhone");
  str("email", "email");
  str("address", "address");
  str("temporaryAddress", "temporaryAddress");
  str("accommodation", "accommodation");
  str("emergencyContact", "emergencyContact");
  str("emergencyPhone", "emergencyPhone");

  str("qualification", "qualification");
  str("institution", "institution");
  const py = toInt(s("passYear")); if (py !== undefined) e.passYear = py;
  const pe = toInt(s("prevExpYears")); if (pe !== undefined) e.prevExpYears = pe;
  str("prevExpDetail", "prevExpDetail");

  // Bank — top-level + mirror into the "Current" bankHistory row so the detail view shows it.
  const bn = s("bankName"), bb = s("bankBranch"), ba = s("bankAccount"), bi = s("bankIfsc");
  if (bn) e.bankName = bn;
  if (bb) e.bankBranch = bb;
  if (ba) e.bankAccount = ba;
  if (bi) e.bankIfsc = bi;
  if (bn || ba || bi) {
    const entry = { bank: e.bankName ?? "—", account: e.bankAccount ?? "—", ifsc: e.bankIfsc ?? "—", from: e.doj || "—", to: "Current" };
    const hist = [...e.bankHistory];
    const curIdx = hist.findIndex((h) => h.to === "Current");
    if (curIdx >= 0) hist[curIdx] = { ...hist[curIdx], ...entry }; else hist.push(entry);
    e.bankHistory = hist;
  }

  const el = toInt(s("leaveEl")); if (el !== undefined) e.leave.el = el;
  const cl = toInt(s("leaveCl")); if (cl !== undefined) e.leave.cl = cl;
  const sl = toInt(s("leaveSl")); if (sl !== undefined) e.leave.sl = sl;
  const lop = toInt(s("leaveLop")); if (lop !== undefined) e.leave.lopThisMonth = lop;

  if (isNew) {
    if (!s("salutation")) e.salutation = e.gender === "Female" ? "Ms." : "Mr.";
    if (!e.email) e.email = e.name ? `${e.name.toLowerCase().replace(/[^a-z]/g, ".")}@company.in` : "";
    if (e.salaryHistory.length === 0)
      e.salaryHistory = [{ fy: "2026-27", monthlyGross: e.monthlyGross, annualPaid: 0, bank: e.bankName ?? "—", account: e.bankAccount ?? "—", creditedDay: "7th of month" }];
    if (e.documents.length === 0)
      e.documents = UPLOAD_DOC_TYPES.map((t): EmpDocument => ({ type: t, number: "—", submitted: false, verified: false }));
  }
  return e;
}

export type ImportRowStatus = "new" | "update" | "duplicate";

export interface EmployeeImportRow {
  id: string;
  name: string;
  status: ImportRowStatus;
  category: string;
  role: string;
  department: string;
  unit: string;
  wageType: string;
  /** For a duplicate: which existing employee it matched, and on which identifier(s). */
  duplicateOf?: { id: string; name: string; on: string };
  employee?: HrEmployee;
  error?: string;
}

export interface EmployeeImportResult {
  rows: EmployeeImportRow[];
  toUpsert: HrEmployee[];         // new + updates (safe to apply)
  duplicateUpserts: HrEmployee[]; // duplicates, resolved as NEW records — only applied if the user proceeds
  newCount: number;
  updateCount: number;
  duplicateCount: number;
  skipped: number;
}

/** Cap so a giant file can't freeze the browser — comfortably above the "up to 500" ask. */
export const MAX_IMPORT_ROWS = 1000;

const nz = (v: string) => norm(v); // normalized; placeholders like "—" collapse to ""

/**
 * A row with a blank/unknown Emp ID that nonetheless matches an existing person
 * on a strong identifier is a duplicate (the same person being re-added). Emp ID
 * itself is matched via the update path, so here we key off Aadhaar / PAN / Phone.
 */
function findDuplicate(
  existing: HrEmployee[], phone: string, aadhaar: string, pan: string
): { emp: HrEmployee; on: string } | undefined {
  const nPh = nz(phone), nAa = nz(aadhaar), nPa = nz(pan);
  if (!nPh && !nAa && !nPa) return undefined; // nothing to match on
  for (const e of existing) {
    const matches: string[] = [];
    if (nAa && nz(e.aadhaar) === nAa) matches.push("Aadhaar");
    if (nPa && nz(e.pan) === nPa) matches.push("PAN");
    if (nPh && nz(e.phone) === nPh) matches.push("Phone");
    if (matches.length) return { emp: e, on: matches.join(" + ") };
  }
  return undefined;
}

/**
 * Resolve parsed sheet rows into upsertable employee records.
 *  - Emp ID matches an existing employee → update (edits flow through).
 *  - Blank/new Emp ID but Aadhaar/PAN/Phone matches an existing person → duplicate
 *    (excluded from `toUpsert`; the UI warns and can include via `duplicateUpserts`).
 *  - Otherwise → new (a fresh EMP-#### id is allocated).
 */
export function mapRowsToEmployees(rawRows: Record<string, string | number>[], existing: HrEmployee[]): EmployeeImportResult {
  const byId = new Map(existing.map((e) => [e.id.toUpperCase(), e]));
  let nextNum = existing.reduce((m, e) => { const n = parseInt(e.id.replace(/\D/g, ""), 10); return isNaN(n) ? m : Math.max(m, n); }, 900) + 1;
  const usedNew = new Set<string>();
  const allocId = (): string => {
    let cand = `EMP-${String(nextNum).padStart(4, "0")}`;
    while (byId.has(cand) || usedNew.has(cand)) { nextNum++; cand = `EMP-${String(nextNum).padStart(4, "0")}`; }
    usedNew.add(cand); nextNum++;
    return cand;
  };

  const rows: EmployeeImportRow[] = [];
  const toUpsert: HrEmployee[] = [];
  const duplicateUpserts: HrEmployee[] = [];
  let newCount = 0, updateCount = 0, duplicateCount = 0, skipped = 0;

  const summary = (e: HrEmployee) => ({
    category: e.category === "MC_OTHERS" && e.categoryOther ? e.categoryOther : categoryById(e.category)?.label ?? e.category,
    role: e.role, department: e.department, unit: e.unit ?? "—",
    wageType: e.wageType === "Monthly" ? "Monthly" : `${e.wageType} · ₹${e.salaryPerDay ?? "—"}/day`,
  });

  for (const raw of rawRows.slice(0, MAX_IMPORT_ROWS)) {
    const lk = rowLookup(raw);
    const name = pick(lk, "name");
    const rawId = pick(lk, "id").toUpperCase();

    if (!name && !rawId) { skipped++; continue; } // blank line

    const existingEmp = rawId ? byId.get(rawId) : undefined;

    if (!existingEmp && !name) { // an ID we don't know, with no name to create from → can't act
      skipped++;
      rows.push({ id: rawId || "—", name: "", status: "new", category: "", role: "", department: "", unit: "", wageType: "", error: "No name — skipped" });
      continue;
    }

    // Existing Emp ID → update in place (this is how edits round-trip).
    if (existingEmp) {
      const employee = upsertFromRow(existingEmp, lk, false);
      employee.id = existingEmp.id;
      updateCount++;
      toUpsert.push(employee);
      rows.push({ id: employee.id, name: employee.name, status: "update", ...summary(employee), employee });
      continue;
    }

    // No Emp ID match → check whether this person already exists (duplicate).
    const dup = findDuplicate(existing, pick(lk, "phone"), pick(lk, "aadhaar"), pick(lk, "pan"));
    if (dup) {
      const employee = upsertFromRow(defaultEmployee(allocId(), name), lk, true);
      duplicateCount++;
      duplicateUpserts.push(employee);
      rows.push({
        id: employee.id, name: employee.name, status: "duplicate", ...summary(employee),
        duplicateOf: { id: dup.emp.id, name: dup.emp.name, on: dup.on },
        employee,
      });
      continue;
    }

    // Genuinely new.
    const employee = upsertFromRow(defaultEmployee(allocId(), name), lk, true);
    newCount++;
    toUpsert.push(employee);
    rows.push({ id: employee.id, name: employee.name, status: "new", ...summary(employee), employee });
  }

  return { rows, toUpsert, duplicateUpserts, newCount, updateCount, duplicateCount, skipped };
}

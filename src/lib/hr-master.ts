/**
 * HR master configuration for a textile spinning mill (sample company data).
 *
 * Derived from the company's own payroll workbook: 6 running shifts, the worker
 * category ledger (permanent / apprentice / hostel / casual / Odisha migrant …),
 * the mill sections/designations, labour agents who supply workers on
 * commission, and the two attendance incentive schemes.
 *
 * These are the "database that can be seen and downloaded" — every list here is
 * surfaced on the Masters page and exportable to Excel.
 */

// ---- Shifts ---------------------------------------------------------------
// 6 shifts run across the mill. A/B/C = 8-hour rotating spinning shifts,
// D/E = 12-hour continuous shifts, GEN = general 9-to-5 for staff & offices.

export interface Shift {
  id: string;
  code: string;
  name: string;
  time: string;
  hours: number;
  kind: "Rotating" | "Continuous" | "General";
  color: string; // tailwind text/bg token base
}

// Shift codes (per mill definition). Internal ids stay SH-* so existing
// employee.shiftId assignments and imported data keep working — only the
// displayed code/name/time changed. The time windows are unchanged from the
// old A–E scheme, so the relabel is 1:1: A→D, B→H, C→F, D→X, E→Y, G→G.
export const SHIFTS: Shift[] = [
  { id: "SH-A", code: "D", name: "Day Shift", time: "7:00 AM – 3:00 PM", hours: 8, kind: "Rotating", color: "emerald" },
  { id: "SH-B", code: "H", name: "Half Night", time: "3:00 PM – 11:00 PM", hours: 8, kind: "Rotating", color: "amber" },
  { id: "SH-C", code: "F", name: "Full Night", time: "11:00 PM – 7:00 AM", hours: 8, kind: "Rotating", color: "indigo" },
  { id: "SH-D", code: "X", name: "Day Shift (12 hr)", time: "7:00 AM – 7:00 PM", hours: 12, kind: "Continuous", color: "sky" },
  { id: "SH-E", code: "Y", name: "Night (12 hr)", time: "7:00 PM – 7:00 AM", hours: 12, kind: "Continuous", color: "violet" },
  { id: "SH-G", code: "G", name: "General Shift", time: "8:00 AM – 5:30 PM", hours: 8, kind: "General", color: "slate" },
];

export const shiftById = (id?: string) => SHIFTS.find((s) => s.id === id);

// ---- Worker categories ----------------------------------------------------
// The category ledger from the mill workbook. Drives statutory treatment,
// hostel/mess linkage and casual vs permanent day-wage handling.

export type BuiltInCategoryId =
  | "PERMANENT" | "SEMISTAFF" | "STAFF" | "APPRENTICE"
  | "HOSTEL_BOYS" | "HOSTEL_GIRLS"
  | "CASUAL_GENTS" | "CASUAL_LADIES"
  | "ODISHA" | "UNIT_CHANGE" | "MC_OTHERS"
  | "SECURITY" | "DRIVER" | "MESS" | "CASUAL";

/** Built-in ids keep autocomplete; `string` admits categories Admin creates. */
export type WorkerCategoryId = BuiltInCategoryId | (string & {});

export interface WorkerCategory {
  id: WorkerCategoryId;
  label: string;
  wageType: "Monthly" | "Daily";
  gender?: "Male" | "Female";
  hostel: boolean;     // lives in company hostel → mess bill applies
  statutory: boolean;  // PF/ESI applicable
  note: string;
}

export const WORKER_CATEGORIES: WorkerCategory[] = [
  { id: "PERMANENT", label: "Permanent", wageType: "Monthly", hostel: false, statutory: true, note: "Confirmed on rolls — full statutory cover" },
  { id: "STAFF", label: "Staff", wageType: "Monthly", hostel: false, statutory: true, note: "Office / supervisory monthly staff" },
  { id: "SEMISTAFF", label: "Semi-Staff", wageType: "Monthly", hostel: false, statutory: true, note: "Semi-supervisory monthly grade" },
  { id: "APPRENTICE", label: "Apprentice", wageType: "Monthly", hostel: false, statutory: false, note: "Under NAPS/ITI apprenticeship — stipend basis" },
  { id: "HOSTEL_BOYS", label: "Hostel Boys", wageType: "Daily", gender: "Male", hostel: true, statutory: true, note: "Resident male workers — mess bill deducted" },
  { id: "HOSTEL_GIRLS", label: "Hostel Girls", wageType: "Daily", gender: "Female", hostel: true, statutory: true, note: "Resident female workers — mess bill deducted" },
  { id: "CASUAL_GENTS", label: "Casual Gents", wageType: "Daily", gender: "Male", hostel: false, statutory: false, note: "Casual male labour — paid per day" },
  { id: "CASUAL_LADIES", label: "Casual Ladies", wageType: "Daily", gender: "Female", hostel: false, statutory: false, note: "Casual female labour — paid per day" },
  { id: "ODISHA", label: "Odisha Migrant", wageType: "Daily", hostel: true, statutory: true, note: "Inter-state migrant workers (via agents) — hostel & mess" },
  { id: "UNIT_CHANGE", label: "Unit Change", wageType: "Monthly", hostel: false, statutory: true, note: "Transferred from / to another company unit" },
  { id: "MC_OTHERS", label: "MC & Others", wageType: "Monthly", hostel: false, statutory: true, note: "Maintenance contract & miscellaneous engagements" },
  // Monthly staff sheets in MONTHLY.xls — paid days × W/D, OT at W/D ÷ 8.
  { id: "SECURITY", label: "Security", wageType: "Daily", hostel: false, statutory: false, note: "Security guards (SEC-1 G-series, SEC-2 contract) — OT at rate ÷ 8" },
  { id: "DRIVER", label: "Driver", wageType: "Daily", hostel: false, statutory: false, note: "Drivers — days × rate + OT (rate ÷ 8) + food" },
  { id: "MESS", label: "Mess / Canteen", wageType: "Daily", gender: "Female", hostel: false, statutory: false, note: "Mess & canteen staff — days × rate" },
  { id: "CASUAL", label: "Casual", wageType: "Daily", hostel: false, statutory: false, note: "Local casuals — days × rate + allowance + attendance incentive" },
];

/**
 * Categories and departments Admin/CEO create at runtime.
 *
 * These live in the store (persisted, synced to MySQL), but every screen and
 * export reads them through `categoryById()` / `allCategories()`. A module-level
 * registry the store pushes into keeps that working everywhere without threading
 * a hook through ~15 call sites — `<MasterDataSync />` in the portal layout is
 * what keeps it in step.
 */
let CUSTOM_CATEGORIES: WorkerCategory[] = [];
let CUSTOM_DEPARTMENTS: string[] = [];

export function setCustomCategories(list: WorkerCategory[]) { CUSTOM_CATEGORIES = list; }
export function setCustomDepartments(list: string[]) { CUSTOM_DEPARTMENTS = list; }

/** Built-in categories plus everything Admin has added. */
export function allCategories(): WorkerCategory[] {
  return [...WORKER_CATEGORIES, ...CUSTOM_CATEGORIES];
}
export function customCategories(): WorkerCategory[] { return CUSTOM_CATEGORIES; }
export function allDepartments(): string[] {
  return [...new Set([...MILL_SECTIONS, ...CUSTOM_DEPARTMENTS])];
}
export function customDepartments(): string[] { return CUSTOM_DEPARTMENTS; }

// Resolve by id OR label (case-insensitive): imported mill data stores the
// human label ("Odisha Migrant") in e.category, not the id ("ODISHA"), so a
// strict id match would return undefined everywhere and break every filter and
// statutory lookup. Matching either keeps old and new data working.
/**
 * Roll-number (token) series per category, as the mill issues them: O1025
 * Odisha men, F3716 women (Odisha + hostel share the F series), P038
 * permanent, SS30 semi-staff, A028 apprentice, G01 security, D02 driver,
 * M01 mess, C01 casual.
 */
const TOKEN_PREFIX: Record<string, string> = {
  ODISHA: "O", HOSTEL_GIRLS: "F", HOSTEL_BOYS: "H", PERMANENT: "P", SEMISTAFF: "SS", STAFF: "ST",
  APPRENTICE: "A", SECURITY: "G", DRIVER: "D", MESS: "M", CASUAL: "C", CASUAL_GENTS: "C", CASUAL_LADIES: "C",
  UNIT_CHANGE: "U", MC_OTHERS: "MC",
};
export function tokenPrefixFor(categoryId: string, gender?: string): string {
  if (categoryId === "ODISHA" && gender === "Female") return "F";
  return TOKEN_PREFIX[categoryId] ?? "E";
}
/** Next free token in a series, keeping its zero-padding (A028 → A166, M01 → M08). */
export function nextToken(prefix: string, ids: string[]): string {
  const re = new RegExp(`^${prefix}(\\d+)$`);
  let max = 0, width = 0;
  for (const id of ids) {
    const m = re.exec(id);
    if (m) { max = Math.max(max, Number(m[1])); width = Math.max(width, m[1].length); }
  }
  return prefix + String(max + 1).padStart(width || 2, "0");
}

export const categoryById = (id?: WorkerCategoryId) => {
  if (!id) return undefined;
  const key = String(id).trim().toLowerCase();
  return allCategories().find((c) => c.id.toLowerCase() === key || c.label.toLowerCase() === key);
};

/** Canonical category id for a stored value (id or label); raw value if unknown. */
export function categoryIdOf(value?: WorkerCategoryId): string {
  return categoryById(value)?.id ?? String(value ?? "");
}

// ---- Mill sections / designations -----------------------------------------
// The department/section list the mill runs its wage sheet against.

export const MILL_SECTIONS = [
  "Staff Salary", "Bale Contract", "Blow Room", "Carding", "Cleaning (CLG)",
  "Doffing Contract", "Ring Frame", "Auto Coner", "Preparatory", "Quality",
  "Fitter / Electrician", "Welder & Plumber", "Security", "Driver",
  "Scavengers", "Gardener", "General Workers", "Stores", "Packing",
] as const;

export const WORKER_DESIGNATIONS = [
  "Doffer", "Tenter", "Sider", "Bale Breaker", "Card Tenter", "Coner Tenter",
  "Cleaner", "Fitter", "Electrician", "Welder", "Plumber", "Security Guard",
  "Driver", "Scavenger", "Gardener", "Helper", "General Worker", "Loader",
] as const;

// ---- Labour agents (contractors) ------------------------------------------
// Agents supply workers (esp. Odisha migrants & hostel labour) and earn a
// per-worker monthly commission — but only while the worker attends properly.

export interface Agent {
  id: string;
  name: string;
  phone: string;
  place: string;
  commissionPerWorker: number; // ₹ per eligible worker per month
  active: boolean;
}

// The mill's real labour agents. Mill and Family hires are direct (no agent).
// Commission is ₹10 per day worked (withheld on the wage sheet); the per-worker
// figure here is a configurable default the mill can set from Masters.
export const AGENTS: Agent[] = [
  { id: "AGT-GUNA", name: "Gunamani", phone: "", place: "", commissionPerWorker: 0, active: true },
  { id: "AGT-RAJESH", name: "Rajesh", phone: "", place: "", commissionPerWorker: 0, active: true },
];

// Agents the mill adds at runtime (e.g. Gunamani, Rajesh — and any new agent
// who joins later). Mirrors the custom-category pattern: the store owns the
// list and pushes it here via setCustomAgents() so agentById/allAgents resolve
// everywhere without each call site needing the store.
let CUSTOM_AGENTS: Agent[] = [];
export function setCustomAgents(list: Agent[]) { CUSTOM_AGENTS = list; }
export function customAgents(): Agent[] { return CUSTOM_AGENTS; }
/** Built-in agents plus everything added at runtime. A runtime entry with a
 *  built-in's id overrides it (that's how an edited rate/phone is stored). */
export function allAgents(): Agent[] {
  const overridden = new Set(CUSTOM_AGENTS.map((a) => a.id));
  return [...AGENTS.filter((a) => !overridden.has(a.id)), ...CUSTOM_AGENTS];
}

export const agentById = (id?: string) =>
  CUSTOM_AGENTS.find((a) => a.id === id) ?? AGENTS.find((a) => a.id === id);

/** Mill rule: agent earns ₹10 per day the worker attends unless a rate is set. */
export const DEFAULT_AGENT_RATE_PER_DAY = 10;
export const agentRatePerDay = (a?: Agent) => (a && a.commissionPerWorker > 0 ? a.commissionPerWorker : DEFAULT_AGENT_RATE_PER_DAY);

// ---- Commission eligibility -----------------------------------------------
// A worker's attendance conduct decides whether their agent earns commission.

export type ConductStatus = "Proper" | "Absconded" | "Long Leave" | "Frequent Absent" | "Exited";

export const CONDUCT_STATUSES: ConductStatus[] = ["Proper", "Absconded", "Long Leave", "Frequent Absent", "Exited"];

/** Agent is paid only when the worker's conduct is "Proper". */
export function commissionEligible(conduct: ConductStatus): boolean {
  return conduct === "Proper";
}

// ---- Operational units (for the AI command centre) ------------------------
// The mill is run as a set of units. Every section maps to a unit; the AI
// briefing reports headcount, coverage and production risk per unit.

export type UnitId =
  | "Production" | "Dyeing" | "Quality" | "Packing" | "Maintenance"
  | "Stores" | "Sales & Marketing" | "Admin & HR" | "Support";

export interface Unit {
  id: UnitId;
  label: string;
  critical: boolean;   // production-critical → coverage gaps flagged hard
  minStrengthPct: number; // % of assigned staff that must be present
}

export const UNITS: Unit[] = [
  { id: "Production", label: "Production (Spinning)", critical: true, minStrengthPct: 85 },
  { id: "Dyeing", label: "Dyeing", critical: true, minStrengthPct: 80 },
  { id: "Quality", label: "Quality", critical: true, minStrengthPct: 75 },
  { id: "Packing", label: "Packing", critical: false, minStrengthPct: 70 },
  { id: "Maintenance", label: "Maintenance & Machinery", critical: true, minStrengthPct: 70 },
  { id: "Stores", label: "Stores", critical: false, minStrengthPct: 60 },
  { id: "Sales & Marketing", label: "Sales & Marketing", critical: false, minStrengthPct: 60 },
  { id: "Admin & HR", label: "Admin & HR", critical: false, minStrengthPct: 50 },
  { id: "Support", label: "Support Services", critical: false, minStrengthPct: 60 },
];

export const unitInfo = (id: UnitId) => UNITS.find((u) => u.id === id)!;

/** Maps a section/department/role to an operational unit. */
export function unitOf(department: string, role?: string): UnitId {
  const d = (department + " " + (role ?? "")).toLowerCase();
  if (/(dye|dyeing)/.test(d)) return "Dyeing";
  if (/(quality|checker|checking)/.test(d)) return "Quality";
  if (/(pack)/.test(d)) return "Packing";
  if (/(fitter|electric|welder|plumber|maintenance|machinery|engineer)/.test(d)) return "Maintenance";
  if (/(store|bale)/.test(d)) return "Stores";
  if (/(sales|marketing)/.test(d)) return "Sales & Marketing";
  if (/(hr|human resources|accounts|finance|admin|office)/.test(d)) return "Admin & HR";
  if (/(security|driver|scavenger|gardener|clean|clg|house)/.test(d)) return "Support";
  // Spinning line: blow room, carding, ring frame, auto coner, doffing, preparatory, general workers…
  return "Production";
}

// ---- Payroll calendar (weekly wages) --------------------------------------
// Wages can run Monthly, Weekly or Daily. Weekly workers are paid each week
// on days-worked × rate; the month is split into weeks for the weekly sheet.

export type WageType = "Monthly" | "Weekly" | "Daily";

// Weeks of the current calendar month (1–7, 8–14, 15–21, 22–end).
const _wkNow = new Date();
const _wkMon = _wkNow.toLocaleDateString("en-IN", { month: "short" });
const _wkEnd = new Date(_wkNow.getFullYear(), _wkNow.getMonth() + 1, 0).getDate();
export const WEEK_LABELS = [
  `Week 1 (1–7 ${_wkMon})`, `Week 2 (8–14 ${_wkMon})`, `Week 3 (15–21 ${_wkMon})`, `Week 4 (22–${_wkEnd} ${_wkMon})`,
] as const;

export const CURRENT_WEEK_INDEX = Math.min(3, Math.floor((_wkNow.getDate() - 1) / 7));

// ---- Daily performance ----------------------------------------------------
// Attendance-based performance (see perfOf in hr-ai.ts) — no production feed exists.

export interface Performance {
  efficiency: number;   // %
  output: number;       // units / pieces / kg for the day
  rating: "Excellent" | "Good" | "Average" | "Low";
  onLeave: boolean;
}


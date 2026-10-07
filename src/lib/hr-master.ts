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
  | "ODISHA" | "UNIT_CHANGE" | "MC_OTHERS";

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

export const categoryById = (id?: WorkerCategoryId) =>
  WORKER_CATEGORIES.find((c) => c.id === id) ?? CUSTOM_CATEGORIES.find((c) => c.id === id);

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
/** Built-in agents plus everything added at runtime. */
export function allAgents(): Agent[] { return [...AGENTS, ...CUSTOM_AGENTS]; }

export const agentById = (id?: string) =>
  AGENTS.find((a) => a.id === id) ?? CUSTOM_AGENTS.find((a) => a.id === id);

// ---- Attendance-based incentive schemes -----------------------------------
// Scheme 1 — "Saturday incentive": paid per Saturday actually worked; a worker
//   who works *every* Saturday in the month is fully eligible.
// Scheme 2 — "28-day incentive": a flat monthly reward for working 28+ days.

export const INCENTIVE = {
  perSaturday: 150,       // ₹ per Saturday worked (Scheme 1)
  fullMonthDays: 28,      // days worked to qualify for Scheme 2
  fullMonthAmount: 1000,  // ₹ flat (Scheme 2)
} as const;

// ---- Overtime -------------------------------------------------------------
// OT is paid at TWICE the ordinary rate (Factories Act 1948 s.59); the ordinary
// hourly rate = wage-per-day / 8. Single source of truth — the wage statement
// (payroll.ts) and the O.T Wages Report both price overtime from here, so a
// worker's OT can never come out different in two places.
export const OT_RATE_MULTIPLIER = 2;
export const OT_STD_HOURS_PER_DAY = 8;

/** OT rate per hour for a worker from day-wage (falls back to monthly/26). */
export function otRatePerHour(salaryPerDay?: number, monthlyGross?: number): number {
  const perDay = salaryPerDay && salaryPerDay > 0 ? salaryPerDay : monthlyGross ? monthlyGross / 26 : 0;
  return Math.round((perDay / OT_STD_HOURS_PER_DAY) * OT_RATE_MULTIPLIER);
}

export interface IncentiveResult {
  inc1Eligible: boolean;   // worked every Saturday
  inc1Amount: number;      // perSaturday × saturdays worked
  inc2Eligible: boolean;   // worked ≥ 28 days
  inc2Amount: number;
  total: number;
}

export function computeIncentives(
  saturdaysWorked: number,
  totalSaturdays: number,
  daysWorked: number
): IncentiveResult {
  const inc1Amount = saturdaysWorked * INCENTIVE.perSaturday;
  const inc1Eligible = totalSaturdays > 0 && saturdaysWorked >= totalSaturdays;
  const inc2Eligible = daysWorked >= INCENTIVE.fullMonthDays;
  const inc2Amount = inc2Eligible ? INCENTIVE.fullMonthAmount : 0;
  return { inc1Eligible, inc1Amount, inc2Eligible, inc2Amount, total: inc1Amount + inc2Amount };
}

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

export const WEEK_LABELS = [
  "Week 1 (1–7 Jul)",
  "Week 2 (8–14 Jul)",
  "Week 3 (15–21 Jul)",
  "Week 4 (22–31 Jul)",
] as const;

export const CURRENT_WEEK_INDEX = 3; // week of 25 Jul 2026 (today)

// ---- Daily performance ----------------------------------------------------
// A deterministic daily performance score per worker, so the AI can rank
// output and flag under-performers without a live MES feed.

export interface Performance {
  efficiency: number;   // %
  output: number;       // units / pieces / kg for the day
  rating: "Excellent" | "Good" | "Average" | "Low";
  onLeave: boolean;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function dailyPerformance(empId: string, conduct: ConductStatus, daysWorked: number, onLeave: boolean): Performance {
  const base = 72 + (hash(empId) % 26); // 72–97 baseline
  let eff = base;
  if (conduct !== "Proper") eff -= 22;
  if (daysWorked < 20) eff -= 8;
  if (onLeave) eff = 0;
  eff = Math.max(0, Math.min(100, eff));
  const output = onLeave ? 0 : Math.round(eff * (3 + (hash(empId + "o") % 6))); // scaled
  const rating: Performance["rating"] = onLeave ? "Low" : eff >= 90 ? "Excellent" : eff >= 78 ? "Good" : eff >= 65 ? "Average" : "Low";
  return { efficiency: eff, output, rating, onLeave };
}

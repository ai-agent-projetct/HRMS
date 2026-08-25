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

export const SHIFTS: Shift[] = [
  { id: "SH-A", code: "A", name: "First Shift", time: "7:00 AM – 3:00 PM", hours: 8, kind: "Rotating", color: "emerald" },
  { id: "SH-B", code: "B", name: "Second Shift", time: "3:00 PM – 11:00 PM", hours: 8, kind: "Rotating", color: "amber" },
  { id: "SH-C", code: "C", name: "Night Shift", time: "11:00 PM – 7:00 AM", hours: 8, kind: "Rotating", color: "indigo" },
  { id: "SH-D", code: "D", name: "Day (12 hr)", time: "7:00 AM – 7:00 PM", hours: 12, kind: "Continuous", color: "sky" },
  { id: "SH-E", code: "E", name: "Night (12 hr)", time: "7:00 PM – 7:00 AM", hours: 12, kind: "Continuous", color: "violet" },
  { id: "SH-G", code: "G", name: "General", time: "8:00 AM – 5:00 PM", hours: 8, kind: "General", color: "slate" },
];

export const shiftById = (id?: string) => SHIFTS.find((s) => s.id === id);

// ---- Worker categories ----------------------------------------------------
// The category ledger from the mill workbook. Drives statutory treatment,
// hostel/mess linkage and casual vs permanent day-wage handling.

export type WorkerCategoryId =
  | "PERMANENT" | "SEMISTAFF" | "STAFF" | "APPRENTICE"
  | "HOSTEL_BOYS" | "HOSTEL_GIRLS"
  | "CASUAL_GENTS" | "CASUAL_LADIES"
  | "ODISHA" | "UNIT_CHANGE" | "MC_OTHERS";

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

export const categoryById = (id?: WorkerCategoryId) => WORKER_CATEGORIES.find((c) => c.id === id);

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

export const AGENTS: Agent[] = [
  { id: "AGT-01", name: "Bhagirathi Labour Supply", phone: "+91 90409 11223", place: "Ganjam, Odisha", commissionPerWorker: 600, active: true },
  { id: "AGT-02", name: "Sri Murugan Manpower", phone: "+91 98942 55110", place: "Tiruppur, TN", commissionPerWorker: 500, active: true },
  { id: "AGT-03", name: "Jagannath Migrant Services", phone: "+91 90738 44119", place: "Cuttack, Odisha", commissionPerWorker: 650, active: true },
  { id: "AGT-04", name: "Amma Casual Contractors", phone: "+91 90031 77220", place: "Erode, TN", commissionPerWorker: 400, active: true },
];

export const agentById = (id?: string) => AGENTS.find((a) => a.id === id);

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
// OT is paid at 1.5× the normal hourly rate (hourly = wage-per-day / 8).
// ponytail: 1.5× constant — bump to 2× here if the mill pays double for OT.
export const OT_RATE_MULTIPLIER = 1.5;
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

/**
 * Mill wage / incentive / OT engine — a faithful reproduction of the formulas
 * the mill runs in its Excel workbooks (COTT20-2026.xls monthly register and
 * WEEKLY-SEP-26.xlsx weekly sheets), so the app's figures tally with theirs
 * when they feed a month of attendance.
 *
 * Decoded from the live sheets (every rule below is verified against real rows —
 * see scripts/check-mill-wages.ts):
 *
 * SHIFT MARKS (per day): D Day · H Half-night · F Full-night · X Day-12h ·
 * Y Night-12h · G General · A (or blank) Absent. These are the same codes the
 * app uses (src/lib/hr-master SHIFTS).
 *
 * WEEKLY (Fri→Thu, day-wage / casual workers):
 *   WKD        = count of D+H+F+G marks in the week
 *   nights     = count of H+F
 *   T.WAGES    = rate × WKD
 *   OT amount  = (rate / 8) × ΣOT-hours            [weekly OT basis = 8h]
 *   INCEN-1    = (Sunday not absent ? 1 : 0) × (WKD ≥ 5 ? ratePerDay : 0) × WKD
 *                ratePerDay default ₹30  → 5 days = 150, 6 = 180. Sunday is
 *                compulsory: a Sunday "A" cancels the whole incentive.
 *   INCEN-2    = nights × nightRate (default ₹10)  [casual-ladies H/F incentive]
 *   BUS FARE   = busFarePerDay × WKD
 *   GROSS      = T.WAGES + OT + INCEN-1 + INCEN-2 + BUS FARE
 *   NET        = MROUND(GROSS − mess − adv − others, 10)
 *
 * MONTHLY (permanent / monthly register):
 *   T.WAGE     = ROUND(rate × daysWorked, 0)
 *   OT wage    = ROUNDUP((rate / 12) × OT-hours, 0) [monthly OT basis = 12h]
 *   INCENTIVE  = daysWorked 26–27 → ×15 ; 28–31 → ×30 ; else 0
 *   GROSS      = ROUNDUP(T.WAGE + OT + INCENTIVE, 0)
 *   AGENT comm = daysWorked × 10   (withheld from net — only when the worker
 *                came through an agent; MILL/direct hires have none)
 *   NET        = MROUND(GROSS − ESI − adv − others − canteen − agentComm, 10)
 *   ROUND-OFF  = NET − (GROSS − ESI − adv − others − canteen − agentComm)
 *
 * HOSTEL GIRLS register (HOSETL_GIRLS.xlsx, verified 491/491 rows Apr–Sep 2026):
 *   paid days  = days present (8-hour shifts), no OT, no ESI, no agent cut
 *   INCENTIVE  = 26–27 days → ×10 ; 28–31 → ×20
 *   NET        = MROUND(GROSS − adv − PM-diff − others − canteen, 10)
 *                (PM DIF = last month's round-off carried forward; kept in "others")
 *
 * ODISHA pay days from the daily muster (12-hour basis, see payDaysFromMarks):
 *   X/Y (12h shift) = 1 day, OT on that day is true overtime.
 *   D/H/F/G (8h) + OT logged on 8h / non-shift days pool together and convert
 *   to days in 12h blocks; the remainder joins overtime. Reproduces the paid
 *   DW+OT exactly for ~90% of workers; the rest are clerk adjustments (±1 day
 *   ↔ ±12h OT), which the app lets HR override per month.
 */

/**
 * odisha  — ORISSA_SALARY register (12h basis, OT rate÷12, ₹15/₹30 incentive, ₹10/day agent, MROUND 10)
 * hostel  — HOSETL_GIRLS register (days present, ₹10/₹20 incentive, no OT/ESI/agent, MROUND 10)
 * staff   — MONTHLY.xls Security / Driver / Mess / Semi-staff: days × rate + OT at rate÷8, exact net
 * casual  — Casual sheet & apprentice statements: as staff, net MROUND 10
 */
export type WageScheme = "odisha" | "hostel" | "staff" | "casual";

export type ShiftMark = "D" | "H" | "F" | "X" | "Y" | "G" | "A" | "";

// Excel helpers.
const roundUp0 = (n: number) => Math.ceil(n - 1e-9);      // ROUNDUP(x, 0)
const round0 = (n: number) => Math.round(n);               // ROUND(x, 0)
const mround = (v: number, m: number) => Math.round(v / m) * m; // MROUND

const norm = (m: ShiftMark | string) => String(m ?? "").trim().toUpperCase();

// ---------------------------------------------------------------- Weekly ----
export interface WeeklyDay { shift: ShiftMark | string; ot?: number }
export interface WeeklyInput {
  rate: number;
  /** 7 marks, Friday→Thursday. Index 2 is Sunday (the compulsory day). */
  days: WeeklyDay[];
  busFarePerDay?: number;
  mess?: number;
  adv?: number;
  others?: number;
  /** INCEN-1 ₹/day — mill default 30, editable. */
  attIncRatePerDay?: number;
  /** INCEN-2 ₹/night (H or F) — mill default 10, editable. */
  nightRate?: number;
}
export interface WeeklyResult {
  D: number; H: number; F: number; G: number;
  nights: number; wkd: number; absent: number; sundayWorked: boolean;
  totWages: number; otHrs: number; otAmt: number;
  incen1: number; incen2: number; busFare: number;
  gross: number; net: number;
}

export function computeWeekly(inp: WeeklyInput): WeeklyResult {
  const attRate = inp.attIncRatePerDay ?? 30;
  const nightRate = inp.nightRate ?? 10;
  const count = (c: string) => inp.days.filter((d) => norm(d.shift) === c).length;
  const D = count("D"), H = count("H"), F = count("F"), G = count("G");
  const wkd = D + H + F + G;
  const nights = H + F;
  const absent = count("A");
  const sundayMark = norm(inp.days[2]?.shift ?? "");
  const z = sundayMark === "A" ? 0 : 1;                 // Z = IF(SUN="A",0,1)
  const aa = wkd >= 5 ? attRate : 0;                    // AA = IF(WKD>=5,rate,0)
  const totWages = inp.rate * wkd;                      // AD = rate × WKD
  const otHrs = inp.days.reduce((s, d) => s + (d.ot ?? 0), 0);
  const otAmt = (inp.rate / 8) * otHrs;                 // AF (not rounded)
  const incen1 = z * aa * wkd;                          // AG
  const incen2 = nights * nightRate;                    // AH
  const busFare = (inp.busFarePerDay ?? 0) * wkd;       // AI
  const gross = totWages + otAmt + incen1 + incen2 + busFare; // AJ
  const net = mround(gross - (inp.mess ?? 0) - (inp.adv ?? 0) - (inp.others ?? 0), 10); // AN
  return { D, H, F, G, nights, wkd, absent, sundayWorked: z === 1, totWages, otHrs, otAmt, incen1, incen2, busFare, gross, net };
}

/** Monthly attendance incentive (register column R), by total days worked. */
export function monthlyIncentive(daysWorked: number, scheme: WageScheme = "odisha"): number {
  const n = daysWorked;
  if (scheme === "staff" || scheme === "casual") return 0;
  const [low, high] = scheme === "hostel" ? [10, 20] : [15, 30];
  if (n === 26 || n === 27) return n * low;
  if (n >= 28 && n <= 31) return n * high;
  return 0;
}

const H8 = new Set(["D", "H", "F", "G"]);
const H12 = new Set(["X", "Y"]);

/**
 * Paid days + OT hours for one month from daily shift marks (see header).
 * `scheme: "hostel"` → days present, no OT (hostel girls' register).
 */
export function payDaysFromMarks(marks: { shift?: string; ot?: number }[], scheme: WageScheme = "odisha"): { days: number; ot: number; present: number } {
  let n12 = 0, n8 = 0, pool = 0, ot12 = 0;
  for (const m of marks) {
    const c = norm(m.shift ?? ""), o = Number(m.ot) || 0;
    if (H12.has(c)) { n12++; ot12 += o; }
    else { if (H8.has(c)) { n8++; pool += 8; } pool += o; }
  }
  const present = n12 + n8;
  if (scheme === "hostel") return { days: present, ot: 0, present };
  const d = Math.floor(pool / 12 + 1e-9);
  return { days: n12 + d, ot: Math.round((ot12 + pool - 12 * d) * 100) / 100, present };
}

// --------------------------------------------------------------- Monthly ----
export interface MonthlyInput {
  rate: number;          // W/D
  daysWorked: number;    // DW
  ot?: number;           // OT hours
  esi?: number;
  adv?: number;
  others?: number;
  canteen?: number;
  /** true when the worker has left (register column K filled) — zeroes "15/day". */
  left?: boolean;
  /** Which register's rules apply (default Odisha monthly register). */
  scheme?: WageScheme;
  /** Direct / MILL hire — no ₹10/day agent cut. */
  noAgent?: boolean;
  /** Staff PF (Security G-series, Permanent, Semi-staff statements). */
  pf?: number;
  /** Extra earnings: driver food, apprentice night/attendance incentive, casual allowance. */
  allowance?: number;
}
export interface MonthlyResult {
  totWage: number; otWage: number; incentive: number; gross: number;
  agentComm: number; fifteenPerDay: number; net: number; roundOff: number;
}

export function computeMonthly(inp: MonthlyInput): MonthlyResult {
  const n = inp.daysWorked, m = inp.rate;
  const scheme = inp.scheme ?? "odisha";
  const hostel = scheme === "hostel";
  const staffLike = scheme === "staff" || scheme === "casual";
  if (staffLike) {
    // MONTHLY.xls: G.WAGES = W.DAYS × W/D + OT HRS × W/D ÷ 8, rounded once.
    const totWage = round0(m * n);
    const otWage = round0((m / 8) * (inp.ot ?? 0));
    const gross = round0(m * n + (m / 8) * (inp.ot ?? 0) + (inp.allowance ?? 0));
    const base = gross - (inp.esi ?? 0) - (inp.pf ?? 0) - (inp.adv ?? 0) - (inp.others ?? 0) - (inp.canteen ?? 0);
    const net = scheme === "casual" ? mround(base, 10) : base;
    return { totWage, otWage, incentive: 0, gross, agentComm: 0, fifteenPerDay: 0, net, roundOff: net - base };
  }
  const totWage = round0(m * n);                         // O
  const otWage = hostel ? 0 : roundUp0((m / 12) * (inp.ot ?? 0)); // Q (hostel register pays no OT)
  const incentive = monthlyIncentive(n, scheme);         // R
  const gross = roundUp0(totWage + otWage + incentive + (inp.allowance ?? 0)); // S
  const agentComm = hostel || inp.noAgent ? 0 : n * 10;  // X
  const fifteenPerDay = inp.left ? 0 : n * 15;           // Y (15S C)
  const base = gross - (inp.esi ?? 0) - (inp.pf ?? 0) - (inp.adv ?? 0) - (inp.others ?? 0) - (inp.canteen ?? 0) - agentComm;
  const net = mround(base, 10);                          // AA
  const roundOff = net - base;                           // Z
  return { totWage, otWage, incentive, gross, agentComm, fifteenPerDay, net, roundOff };
}

/**
 * Cash denomination breakdown of a net amount, mirroring the weekly sheet's
 * ₹500/100/50/20/10 note-count columns (AR…AW). Returns note counts.
 */
export function denominations(net: number): Record<"500" | "100" | "50" | "20" | "10", number> {
  let r = Math.round(net);
  const out = { "500": 0, "100": 0, "50": 0, "20": 0, "10": 0 };
  for (const d of [500, 100, 50, 20, 10] as const) {
    out[String(d) as keyof typeof out] = Math.floor(r / d);
    r -= out[String(d) as keyof typeof out] * d;
  }
  return out;
}

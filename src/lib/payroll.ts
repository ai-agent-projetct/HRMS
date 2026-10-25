/**
 * Payroll & number-to-words helpers (Vyapar-style).
 *
 * Salary is broken into standard Indian components and statutory deductions
 * (PF, ESI, PT, TDS) from an employee's monthly gross, so a full payslip can
 * be generated, downloaded and sent on WhatsApp.
 *
 * Daily-wage workers are paid days-worked × rate, plus the two attendance
 * incentive, minus advance recovery, mess bill and other deductions.
 */

import { categoryById, categoryIdOf } from "@/lib/hr-master";
import { computeMonthly, type WageScheme } from "@/lib/mill-wages";

/** Which register's rules price this worker (hostel girls have their own). */
export function wageSchemeFor(category?: string): WageScheme {
  const c = categoryIdOf(category);
  if (c === "HOSTEL_GIRLS") return "hostel";
  // mwages statements (apprentice / permanent) and the casual sheet round net to ₹10
  if (c === "CASUAL" || c === "APPRENTICE" || c === "PERMANENT") return "casual";
  if (c === "SECURITY" || c === "DRIVER" || c === "MESS" || c === "SEMISTAFF" || c === "STAFF") return "staff";
  return "odisha";
}

/** The register a history month was paid from decides its rules (a worker can
 *  move between the hostel and Odisha registers). */
export function schemeFromSource(src?: string): WageScheme | undefined {
  if (!src) return undefined;
  if (src.startsWith("ORISSA")) return "odisha";
  if (src.startsWith("HOSETL")) return "hostel";
  if (src.startsWith("MONTHLY CASUAL") || src.startsWith("mwages")) return "casual";
  if (src.startsWith("MONTHLY")) return "staff";
  return undefined;
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? " " + ONES[n % 10] : ""}`;
}

/** Indian-format amount in words, e.g. "Rupees Twelve Lakh Thirty Four Thousand Only". */
export function amountInWords(amount: number): string {
  const rupees = Math.floor(Math.abs(amount));
  if (rupees === 0) return "Rupees Zero Only";
  const parts: string[] = [];
  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const hundred = Math.floor((rupees % 1000) / 100);
  const rest = rupees % 100;
  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (rest) parts.push(twoDigits(rest));
  return `Rupees ${parts.join(" ")} Only`;
}

export interface PayComponent {
  label: string;
  amount: number;
}

export interface Payslip {
  earnings: PayComponent[];
  deductions: PayComponent[];
  grossEarnings: number;
  totalDeductions: number;
  netPay: number;
  lopDays: number;
  paidDays: number;
}

/** Per-employee statutory toggles (a worker may be exempt from PF or TDS). */
export interface StatutoryOpts {
  pf?: boolean;   // deduct Provident Fund + ESI (default true)
  tds?: boolean;  // deduct TDS (default true)
  pt?: boolean;   // deduct Professional Tax (default true)
}

/**
 * Builds a payslip from monthly gross. LOP (loss of pay) days reduce earnings
 * pro-rata across a 30-day month. PF/TDS/PT can be switched off per worker.
 */
export function buildPayslip(monthlyGross: number, lopDays = 0, loanEmi = 0, opts: StatutoryOpts = {}): Payslip {
  const { pf: pfOn = true, tds: tdsOn = true, pt: ptOn = true } = opts;
  const paidRatio = (30 - lopDays) / 30;
  const basic = Math.round(monthlyGross * 0.5 * paidRatio);
  const hra = Math.round(monthlyGross * 0.2 * paidRatio);
  const conveyance = Math.round(monthlyGross * 0.08 * paidRatio);
  const special = Math.round(monthlyGross * 0.22 * paidRatio);
  const grossEarnings = basic + hra + conveyance + special;

  // Statutory deductions (each can be switched off for a worker).
  const pf = pfOn ? Math.round(Math.min(basic, 15000) * 0.12) : 0; // employee PF, capped
  const esi = pfOn && monthlyGross <= 21000 ? Math.round(grossEarnings * 0.0075) : 0;
  const pt = ptOn && grossEarnings > 15000 ? 200 : ptOn && grossEarnings > 7500 ? 150 : 0;
  const tds = tdsOn && monthlyGross > 50000 ? Math.round(grossEarnings * 0.05) : 0;

  const earnings: PayComponent[] = [
    { label: "Basic", amount: basic },
    { label: "HRA", amount: hra },
    { label: "Conveyance", amount: conveyance },
    { label: "Special Allowance", amount: special },
  ];
  const deductions: PayComponent[] = [
    { label: "Provident Fund (PF)", amount: pf },
    { label: "ESI", amount: esi },
    { label: "Professional Tax", amount: pt },
    { label: "TDS", amount: tds },
    { label: "Loan / Advance EMI", amount: loanEmi },
  ].filter((d) => d.amount > 0);

  const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0);
  return {
    earnings,
    deductions,
    grossEarnings,
    totalDeductions,
    netPay: grossEarnings - totalDeductions,
    lopDays,
    paidDays: 30 - lopDays,
  };
}

/**
 * One worker's pay for one month on the mill engine — the figure shown in the
 * employee Salary Record and the History report. Uses that month's rate when
 * the attendance row carries one.
 */
export interface MonthInputs {
  scheme?: WageScheme;   // default: register of a paid month, else the worker's category
  noAgent?: boolean;     // default: worker has no agent
  esi?: number;          // default: ₹200 for Odisha on-roll workers who worked, else 0
  pf?: number;
  allowance?: number;
}

/** An advance instalment never takes pay below zero — recover at most what is left after other deductions. */
function capAdvance(adv: number, inp: Omit<Parameters<typeof computeMonthly>[0], "adv">): number {
  return adv > 0 ? Math.min(adv, Math.max(0, computeMonthly({ ...inp, adv: 0 }).net)) : 0;
}

export function monthSalary(
  e: { salaryPerDay?: number; monthlyGross?: number; pfApplicable?: boolean; category: string; agentId?: string },
  a: { daysWorked: number; otHours: number; rate?: number; paid?: { net: number; gross: number; wages: number; otAmt: number; incentive: number; esi: number; adv: number; others: number; mess: number; agent: number; src: string } },
  ded: { mess: number; others: number; adv?: number; pmDiff?: number },
  opts: MonthInputs = {},
) {
  // Monthly-paid with no day rate on record: monthly gross ÷ 26 (as Add Employee stores it).
  const rate = a.rate ?? e.salaryPerDay ?? (e.monthlyGross ? Math.round((e.monthlyGross / 26) * 100) / 100 : 0);
  const scheme = opts.scheme ?? schemeFromSource(a.paid?.src) ?? wageSchemeFor(e.category);
  const statutory = scheme === "odisha" && (e.pfApplicable ?? (categoryById(e.category)?.statutory ?? true));
  const esi = opts.esi ?? (statutory && a.daysWorked > 0 ? 200 : 0);
  const others = ded.others + (ded.pmDiff ?? 0);
  const inp = {
    rate, daysWorked: a.daysWorked, ot: a.otHours, esi, others, canteen: ded.mess, scheme,
    noAgent: opts.noAgent ?? !e.agentId, pf: opts.pf, allowance: opts.allowance,
  };
  const adv = capAdvance(ded.adv ?? 0, inp);
  const m = computeMonthly({ ...inp, adv });
  const computed = {
    days: a.daysWorked, rate, ot: a.otHours, wages: m.totWage, otAmt: m.otWage, incentive: m.incentive,
    gross: m.gross, ded: m.gross - m.net, net: m.net, esi, adv, agentComm: m.agentComm,
  };
  // History months carry the register's own figures — those are what was paid.
  if (!a.paid) return { ...computed, paidNet: undefined as number | undefined, source: "computed" as const };
  const p = a.paid;
  return {
    ...computed, wages: p.wages, otAmt: p.otAmt, incentive: p.incentive, gross: p.gross,
    ded: p.gross - p.net, net: p.net, esi: p.esi, adv: p.adv, agentComm: p.agent,
    paidNet: p.net, computedNet: m.net, source: "register" as const,
  };
}

/**
 * Payroll totals for one month across the workforce — register figures for
 * paid months, the wage engine otherwise (the same numbers Payroll lists).
 */
export function monthTotals(
  employees: { id: string; salaryPerDay?: number; pfApplicable?: boolean; category: string; agentId?: string }[],
  attendance: { empId: string; month: string; daysWorked: number; otHours: number; rate?: number; paid?: Parameters<typeof monthSalary>[1]["paid"] }[],
  deductions: { empId: string; month: string; mess: number; others: number; adv?: number; pmDiff?: number }[],
  month: string,
) {
  const emp = new Map(employees.map((e) => [e.id, e]));
  const ded = new Map(deductions.filter((d) => d.month === month).map((d) => [d.empId, d]));
  const t = { workers: 0, gross: 0, net: 0, incentive: 0, agent: 0, otAmt: 0, fromRegister: 0 };
  for (const a of attendance) {
    if (a.month !== month || (!a.paid && a.daysWorked <= 0)) continue;
    const e = emp.get(a.empId);
    if (!e) continue;
    const r = monthSalary(e, a, ded.get(a.empId) ?? { mess: 0, others: 0 });
    t.workers++; t.gross += r.gross; t.net += r.net; t.incentive += r.incentive; t.agent += r.agentComm; t.otAmt += r.otAmt;
    if (r.source === "register") t.fromRegister++;
  }
  return t;
}

/** The latest month that has salary-register figures (the last month actually paid). */
export function latestPaidMonth(attendance: { month: string; paid?: unknown }[], fallback: string): string {
  let m = "";
  for (const a of attendance) if (a.paid && a.month > m) m = a.month;
  return m || fallback;
}

/** A payslip that shows exactly what the register paid for a history month. */
export function payslipFromPaid(p: {
  src: string; days: number; rate: number; ot: number; wages: number; otAmt: number; incentive: number; allowance?: number;
  gross: number; esi: number; pf?: number; adv: number; others: number; mess: number; agent: number; roundOff: number; net: number;
}): DailyPayslip {
  const earnings: PayComponent[] = [
    { label: `Wages (${p.days} days × ₹${p.rate})`, amount: p.wages },
    { label: `Overtime (${p.ot} hr)`, amount: p.otAmt },
    { label: "Attendance incentive", amount: p.incentive },
    { label: "Allowances", amount: p.allowance ?? 0 },
  ].filter((e) => e.amount);
  const deductions: PayComponent[] = [
    { label: "PF", amount: p.pf ?? 0 },
    { label: "ESI", amount: p.esi },
    { label: "Agent (₹10/day)", amount: p.agent },
    { label: "Advance Recovery", amount: p.adv },
    { label: "Mess / Canteen", amount: p.mess },
    { label: "Other Deductions", amount: p.others },
    { label: "Round-off", amount: -p.roundOff },
  ].filter((d) => d.amount);
  return {
    earnings, deductions, grossEarnings: p.gross, totalDeductions: p.gross - p.net, netPay: p.net,
    lopDays: 0, paidDays: p.days, daysWorked: p.days, ratePerDay: p.rate,
  };
}

export interface DailyPayInput {
  ratePerDay: number;
  daysWorked: number;
  otHours?: number;
  advanceRecovery?: number;
  messBill?: number;
  others?: number;
  statutory?: boolean; // apply PF/ESI for on-roll categories
  tds?: boolean;       // apply TDS (rare for day-wage; default false)
  scheme?: WageScheme; // register rules (hostel girls differ)
  noAgent?: boolean;   // direct hire — no ₹10/day agent cut
}

export interface DailyPayslip extends Payslip {
  daysWorked: number;
  ratePerDay: number;
}

/**
 * Builds a daily-wage worker payslip:
 *   earnings   = days × rate + overtime + attendance incentive (mill slabs)
 *   deductions = ESI (if on-roll) + agent + advance recovery + mess bill + others
 */
export function buildDailyPayslip(input: DailyPayInput): DailyPayslip {
  const {
    ratePerDay, daysWorked, otHours = 0,
    advanceRecovery = 0, messBill = 0, others = 0, statutory = true, tds: tdsOn = false,
    scheme = "odisha", noAgent = false,
  } = input;

  // Mill register model (reproduces COTT20-2026.xls — see src/lib/mill-wages.ts):
  //   wages      = rate × days
  //   OT wage    = ROUNDUP(rate/12 × OThrs)
  //   incentive  = days 26–27 → ×15 ; 28–31 → ×30 ; else 0
  //   ESI        = flat ₹200 (on-roll)   ·   welfare = days × ₹10 (register "AGENT" col)
  //   net        = MROUND(gross − ESI − adv − mess − others − welfare, 10)
  void tdsOn;
  // ESI applies only when the worker actually earned (no wage → no ESI, so a
  // zero-day / fully-absent worker never shows negative pay).
  const esi = statutory && scheme !== "hostel" && daysWorked > 0 ? 200 : 0;
  const inp = { rate: ratePerDay, daysWorked, ot: otHours, esi, others, canteen: messBill, scheme, noAgent };
  const adv = capAdvance(advanceRecovery, inp);
  const m = computeMonthly({ ...inp, adv });

  const earnings: PayComponent[] = [
    { label: `Wages (${daysWorked} days × ₹${ratePerDay})`, amount: m.totWage },
    { label: `Overtime (${otHours} hr)`, amount: m.otWage },
    { label: `Attendance incentive (${daysWorked} days)`, amount: m.incentive },
  ].filter((e) => e.amount > 0);

  const deductions: PayComponent[] = [
    { label: "ESI", amount: esi },
    { label: "Agent (₹10/day)", amount: m.agentComm },
    { label: "Advance Recovery", amount: adv },
    { label: "Mess Bill", amount: messBill },
    { label: "Other Deductions", amount: others },
  ].filter((d) => d.amount > 0);

  return {
    earnings,
    deductions,
    grossEarnings: m.gross,
    totalDeductions: m.gross - m.net,   // exact: net is the mill's MROUND-10 figure
    netPay: m.net,
    lopDays: 0,
    paidDays: daysWorked,
    daysWorked,
    ratePerDay,
  };
}

/** Net wages still owed — months with attendance that no register has paid yet (mess etc. already netted). */
export function unpaidWages(
  e: Parameters<typeof monthSalary>[0] & { id: string },
  attendance: { empId: string; month: string; daysWorked: number; otHours: number; rate?: number; paid?: Parameters<typeof monthSalary>[1]["paid"] }[],
  deductions: { empId: string; month: string; mess: number; others: number; adv?: number; pmDiff?: number }[],
): number {
  let owed = 0;
  for (const a of attendance) {
    if (a.empId !== e.id || a.paid || a.daysWorked <= 0) continue;
    owed += monthSalary(e, a, deductions.find((d) => d.empId === e.id && d.month === a.month) ?? { mess: 0, others: 0 }).net;
  }
  return Math.max(0, owed);
}

/** Plain-text payslip for WhatsApp / e-mail. */
export function payslipText(e: { id: string; name: string }, slip: Payslip): string {
  const rs = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
  return [
    `${e.name} (${e.id})`,
    ...slip.earnings.map((x) => `${x.label}: ${rs(x.amount)}`),
    `Gross: ${rs(slip.grossEarnings)}`,
    ...slip.deductions.map((x) => `${x.label}: −${rs(x.amount)}`),
    `Net pay: ${rs(slip.netPay)}`,
  ].join("\n");
}

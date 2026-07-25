/**
 * Payroll & number-to-words helpers (Vyapar-style).
 *
 * Salary is broken into standard Indian components and statutory deductions
 * (PF, ESI, PT, TDS) from an employee's monthly gross, so a full payslip can
 * be generated, downloaded and sent on WhatsApp.
 *
 * Daily-wage workers are paid days-worked × rate, plus the two attendance
 * incentives, minus advance recovery, mess bill and other deductions.
 */

import { computeIncentives, type IncentiveResult } from "@/lib/hr-master";

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

export interface DailyPayInput {
  ratePerDay: number;
  daysWorked: number;
  otHours?: number;
  saturdaysWorked: number;
  totalSaturdays: number;
  advanceRecovery?: number;
  messBill?: number;
  others?: number;
  statutory?: boolean; // apply PF/ESI for on-roll categories
  tds?: boolean;       // apply TDS (rare for day-wage; default false)
}

export interface DailyPayslip extends Payslip {
  daysWorked: number;
  ratePerDay: number;
  incentives: IncentiveResult;
}

/**
 * Builds a daily-wage worker payslip:
 *   earnings  = days × rate  + overtime + Incentive-1 (Saturdays) + Incentive-2 (28-day)
 *   deductions = PF/ESI (if on-roll) + advance recovery + mess bill + others
 */
export function buildDailyPayslip(input: DailyPayInput): DailyPayslip {
  const {
    ratePerDay, daysWorked, otHours = 0, saturdaysWorked, totalSaturdays,
    advanceRecovery = 0, messBill = 0, others = 0, statutory = true, tds: tdsOn = false,
  } = input;

  const wages = Math.round(ratePerDay * daysWorked);
  const otRate = Math.round((ratePerDay / 8) * 2); // 2× hourly for OT
  const ot = Math.round(otRate * otHours);
  const incentives = computeIncentives(saturdaysWorked, totalSaturdays, daysWorked);

  const earnings: PayComponent[] = [
    { label: `Wages (${daysWorked} days × ₹${ratePerDay})`, amount: wages },
    { label: `Overtime (${otHours} hr)`, amount: ot },
    { label: "Incentive 1 — Saturday", amount: incentives.inc1Amount },
    { label: "Incentive 2 — 28-day attendance", amount: incentives.inc2Amount },
  ].filter((e) => e.amount > 0);

  const grossEarnings = earnings.reduce((s, e) => s + e.amount, 0);

  const pf = statutory ? Math.round(Math.min(wages, 15000) * 0.12) : 0;
  const esi = statutory && grossEarnings <= 21000 ? Math.round(grossEarnings * 0.0075) : 0;
  const tds = tdsOn ? Math.round(grossEarnings * 0.05) : 0;

  const deductions: PayComponent[] = [
    { label: "Provident Fund (PF)", amount: pf },
    { label: "ESI", amount: esi },
    { label: "TDS", amount: tds },
    { label: "Advance Recovery", amount: advanceRecovery },
    { label: "Mess Bill", amount: messBill },
    { label: "Other Deductions", amount: others },
  ].filter((d) => d.amount > 0);

  const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0);

  return {
    earnings,
    deductions,
    grossEarnings,
    totalDeductions,
    netPay: grossEarnings - totalDeductions,
    lopDays: 0,
    paidDays: daysWorked,
    daysWorked,
    ratePerDay,
    incentives,
  };
}

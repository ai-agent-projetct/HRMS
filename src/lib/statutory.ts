/**
 * Indian statutory & settlement calculations — PF/ESI/PT, gratuity, bonus,
 * leave encashment and full-and-final (F&F) settlement.
 *
 * Rates are the standard defaults and are configurable here. Verify against
 * current EPFO / ESIC / state PT / Payment of Bonus & Gratuity Acts before
 * filing. Figures are representative for planning and register generation.
 */

import type { HrEmployee } from "@/lib/hr-data";
import { tenure } from "@/lib/hr-data";
import { categoryById } from "@/lib/hr-master";

export const STATUTORY = {
  pfRate: 0.12,          // employee & employer each
  pfWageCeiling: 15000,  // PF wage ceiling
  epsRate: 0.0833,       // employer share going to pension (of ceiling)
  esiEmployee: 0.0075,   // 0.75%
  esiEmployer: 0.0325,   // 3.25%
  esiWageCeiling: 21000, // ESI applies at/below this gross
  bonusRate: 0.0833,     // 8.33% statutory minimum
  bonusCalcCeiling: 7000,// bonus computed on min(basic, 7000)/month
  bonusEligibilityGross: 21000,
  gratuityYears: 5,      // min completed years for gratuity
  ptMonthly: 200,        // simplified PT slab (TN ~ per half-year; monthly approx)
} as const;

/** Basic component used for statutory calc (~50% of gross / wages). */
function basicOf(e: HrEmployee): number {
  return Math.round(e.monthlyGross * 0.5);
}

export function pfApplies(e: HrEmployee): boolean {
  return e.pfApplicable ?? (categoryById(e.category)?.statutory ?? true);
}

export interface StatutoryLine {
  empId: string;
  name: string;
  uan: string;
  basic: number;
  gross: number;
  pfEmployee: number;
  pfEmployerEpf: number;   // 3.67% (of ceiling) to EPF
  pfEmployerEps: number;   // 8.33% (of ceiling) to pension
  pfEmployerTotal: number;
  esiEmployee: number;
  esiEmployer: number;
  pt: number;
}

export function statutoryLine(e: HrEmployee): StatutoryLine {
  const basic = basicOf(e);
  const gross = e.monthlyGross;
  const on = pfApplies(e);
  const pfBase = Math.min(basic, STATUTORY.pfWageCeiling);
  const pfEmployee = on ? Math.round(pfBase * STATUTORY.pfRate) : 0;
  const pfEmployerEps = on ? Math.round(Math.min(basic, STATUTORY.pfWageCeiling) * STATUTORY.epsRate) : 0;
  const pfEmployerTotal = on ? Math.round(pfBase * STATUTORY.pfRate) : 0;
  const pfEmployerEpf = pfEmployerTotal - pfEmployerEps;
  const esiOn = on && gross <= STATUTORY.esiWageCeiling;
  const esiEmployee = esiOn ? Math.round(gross * STATUTORY.esiEmployee) : 0;
  const esiEmployer = esiOn ? Math.round(gross * STATUTORY.esiEmployer) : 0;
  const pt = on && gross > 15000 ? STATUTORY.ptMonthly : on && gross > 7500 ? 150 : 0;
  return { empId: e.id, name: e.name, uan: e.uan, basic, gross, pfEmployee, pfEmployerEpf, pfEmployerEps, pfEmployerTotal, esiEmployee, esiEmployer, pt };
}

export interface Gratuity { years: number; eligible: boolean; amount: number; }

/** Gratuity = last basic × 15/26 × completed years (payable at ≥5 years). */
export function gratuity(e: HrEmployee): Gratuity {
  const years = Math.floor(tenure(e.doj).totalDays / 365);
  const amount = Math.round(basicOf(e) * (15 / 26) * years);
  return { years, eligible: years >= STATUTORY.gratuityYears, amount };
}

/** Annual statutory bonus (8.33%) on capped basic, for eligible workers. */
export function annualBonus(e: HrEmployee): number {
  if (e.monthlyGross > STATUTORY.bonusEligibilityGross && e.wageType === "Monthly") {
    // Above ceiling: still often paid ex-gratia; compute on the calc ceiling.
  }
  const monthlyBase = Math.min(basicOf(e), STATUTORY.bonusCalcCeiling);
  return Math.round(monthlyBase * 12 * STATUTORY.bonusRate);
}

/** Leave encashment for unused earned leave (EL) at (gross / 30) per day. */
export function leaveEncashment(e: HrEmployee): number {
  return Math.round((e.monthlyGross / 30) * e.leave.el);
}

// ---- Full & Final settlement ----------------------------------------------

export interface SettlementInput {
  pendingWages: number;      // unpaid days this cycle
  outstandingAdvance: number;
  messDue?: number;
  noticeRecovery?: number;   // recovery for shortfall in notice
}

export interface SettlementLine { label: string; amount: number; kind: "credit" | "debit"; }

export interface Settlement {
  lines: SettlementLine[];
  totalCredits: number;
  totalDebits: number;
  net: number;
  gratuity: Gratuity;
}

export function settlement(e: HrEmployee, input: SettlementInput): Settlement {
  const g = gratuity(e);
  const le = leaveEncashment(e);
  const bonus = Math.round(annualBonus(e) / 12 * (tenure(e.doj).totalDays % 365 / 30)); // pro-rata bonus this year
  const credits: SettlementLine[] = [
    { label: "Pending wages / salary", amount: input.pendingWages, kind: "credit" as const },
    { label: "Leave encashment (EL)", amount: le, kind: "credit" as const },
    { label: `Gratuity (${g.years} yrs)`, amount: g.eligible ? g.amount : 0, kind: "credit" as const },
    { label: "Pro-rata bonus", amount: Math.max(0, bonus), kind: "credit" as const },
  ].filter((l) => l.amount > 0);
  const debits: SettlementLine[] = [
    { label: "Outstanding advance", amount: input.outstandingAdvance, kind: "debit" as const },
    { label: "Mess dues", amount: input.messDue ?? 0, kind: "debit" as const },
    { label: "Notice-period recovery", amount: input.noticeRecovery ?? 0, kind: "debit" as const },
  ].filter((l) => l.amount > 0);
  const totalCredits = credits.reduce((s, l) => s + l.amount, 0);
  const totalDebits = debits.reduce((s, l) => s + l.amount, 0);
  return { lines: [...credits, ...debits], totalCredits, totalDebits, net: totalCredits - totalDebits, gratuity: g };
}

// ---- Company-wide aggregation ---------------------------------------------

export interface StatutorySummary {
  pfEmployee: number; pfEmployer: number; esiEmployee: number; esiEmployer: number;
  pt: number; totalMonthly: number;
  annualBonus: number; gratuityLiability: number;
  covered: number;
}

export function statutorySummary(employees: HrEmployee[]): StatutorySummary {
  const lines = employees.filter((e) => e.status !== "Exited").map(statutoryLine);
  const pfEmployee = lines.reduce((s, l) => s + l.pfEmployee, 0);
  const pfEmployer = lines.reduce((s, l) => s + l.pfEmployerTotal, 0);
  const esiEmployee = lines.reduce((s, l) => s + l.esiEmployee, 0);
  const esiEmployer = lines.reduce((s, l) => s + l.esiEmployer, 0);
  const pt = lines.reduce((s, l) => s + l.pt, 0);
  return {
    pfEmployee, pfEmployer, esiEmployee, esiEmployer, pt,
    totalMonthly: pfEmployee + pfEmployer + esiEmployee + esiEmployer + pt,
    annualBonus: employees.filter((e) => e.status !== "Exited").reduce((s, e) => s + annualBonus(e), 0),
    gratuityLiability: employees.filter((e) => e.status !== "Exited").reduce((s, e) => s + gratuity(e).amount, 0),
    covered: lines.filter((l) => l.pfEmployee > 0).length,
  };
}

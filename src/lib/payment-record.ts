/**
 * Per-employee payment record — a month-by-month statement of pay from date of
 * joining to the current payroll month. PF / ESI / PT / TDS are included only
 * when they apply to that worker (the flags set on the employee master).
 *
 * Used to download an individual's full payment history as Excel and PDF.
 */

import { buildPayslip, buildDailyPayslip, type Payslip } from "@/lib/payroll";
import { categoryById } from "@/lib/hr-master";
import type { HrEmployee } from "@/lib/hr-data";
import { CURRENT_MONTH } from "@/stores/hr";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface PayMonthRow {
  ym: string;        // 2026-07
  label: string;     // Jul 2026
  gross: number;
  pf: number;
  esi: number;
  pt: number;
  tds: number;
  otherDed: number;
  deductions: number;
  net: number;
}

export interface PaymentRecord {
  rows: PayMonthRow[];
  monthsPaid: number;
  totalGross: number;
  totalDeductions: number;
  totalPf: number;
  totalEsi: number;
  totalTds: number;
  totalNet: number;
  pfApplicable: boolean;
  tdsApplicable: boolean;
}

/** Whether PF/ESI applies to this worker (explicit flag, else category default). */
export function pfApplies(e: HrEmployee): boolean {
  return e.pfApplicable ?? (categoryById(e.category)?.statutory ?? true);
}
/** Whether TDS applies to this worker. */
export function tdsApplies(e: HrEmployee): boolean {
  return e.tdsApplicable ?? (e.wageType === "Monthly");
}

/** A representative monthly payslip for the worker (no LOP/advance/mess). */
export function representativeSlip(e: HrEmployee): Payslip {
  const pf = pfApplies(e);
  const tds = tdsApplies(e);
  if (e.wageType === "Monthly") {
    return buildPayslip(e.monthlyGross, 0, 0, { pf, tds, pt: true });
  }
  return buildDailyPayslip({
    ratePerDay: e.salaryPerDay ?? 0, daysWorked: 26, otHours: 0,
    saturdaysWorked: 4, totalSaturdays: 4, statutory: pf, tds,
  });
}

const comp = (s: Payslip, label: string) => s.deductions.find((d) => d.label.includes(label))?.amount ?? 0;

function monthsFrom(doj: string, upto: string): { ym: string; label: string }[] {
  const [fy, fm] = doj.slice(0, 7).split("-").map(Number);
  const [ty, tm] = upto.split("-").map(Number);
  const out: { ym: string; label: string }[] = [];
  let y = fy, m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    out.push({ ym: `${y}-${String(m).padStart(2, "0")}`, label: `${MON[m - 1]} ${y}` });
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

/** Builds the full month-by-month payment record for an employee. */
export function buildPaymentRecord(e: HrEmployee, upto: string = CURRENT_MONTH): PaymentRecord {
  const slip = representativeSlip(e);
  const months = monthsFrom(e.doj, upto);
  const pf = comp(slip, "Provident Fund");
  const esi = comp(slip, "ESI");
  const pt = comp(slip, "Professional Tax");
  const tds = comp(slip, "TDS");

  const rows: PayMonthRow[] = months.map((mo) => ({
    ym: mo.ym, label: mo.label,
    gross: slip.grossEarnings, pf, esi, pt, tds, otherDed: 0,
    deductions: slip.totalDeductions, net: slip.netPay,
  }));

  return {
    rows,
    monthsPaid: rows.length,
    totalGross: slip.grossEarnings * rows.length,
    totalDeductions: slip.totalDeductions * rows.length,
    totalPf: pf * rows.length,
    totalEsi: esi * rows.length,
    totalTds: tds * rows.length,
    totalNet: slip.netPay * rows.length,
    pfApplicable: pfApplies(e),
    tdsApplicable: tdsApplies(e),
  };
}

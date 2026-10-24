/**
 * Per-employee payment record — every month the worker actually has on record,
 * with the salary register's figures where the month was paid from a register
 * and the wage engine's figures otherwise. No month is invented.
 *
 * Used to download an individual's full payment history as Excel and PDF.
 */

import { monthSalary } from "@/lib/payroll";
import { categoryById } from "@/lib/hr-master";
import type { HrEmployee } from "@/lib/hr-data";
import type { AttendanceRecord, MonthlyDeduction } from "@/stores/hr";

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
  source: "register" | "computed";
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

/** Month-by-month record from the worker's real attendance / register months. */
export function buildPaymentRecord(e: HrEmployee, attendance: AttendanceRecord[], deductions: MonthlyDeduction[]): PaymentRecord {
  const ded = new Map(deductions.filter((d) => d.empId === e.id).map((d) => [d.month, d]));
  const rows: PayMonthRow[] = attendance
    .filter((a) => a.empId === e.id && (a.daysWorked > 0 || a.paid))
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((a) => {
      const r = monthSalary(e, a, ded.get(a.month) ?? { mess: 0, others: 0 });
      const pf = a.paid?.pf ?? 0;
      const [y, m] = a.month.split("-").map(Number);
      return {
        ym: a.month, label: `${MON[m - 1]} ${y}`, gross: r.gross, pf, esi: r.esi, pt: 0, tds: 0,
        otherDed: r.ded - r.esi - pf, deductions: r.ded, net: r.net, source: r.source,
      };
    });
  const sum = (f: (r: PayMonthRow) => number) => rows.reduce((s, r) => s + f(r), 0);
  return {
    rows,
    monthsPaid: rows.length,
    totalGross: sum((r) => r.gross),
    totalDeductions: sum((r) => r.deductions),
    totalPf: sum((r) => r.pf),
    totalEsi: sum((r) => r.esi),
    totalTds: 0,
    totalNet: sum((r) => r.net),
    pfApplicable: pfApplies(e),
    tdsApplicable: tdsApplies(e),
  };
}

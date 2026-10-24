/**
 * Overtime computation — weekly & monthly. OT hours are held per month on the
 * attendance record; here we split them across the month's weeks (weighted by
 * days worked) and price each week at the register's OT rate, tagging the shift
 * that week so the report shows when/which-shift/how-many-hours per person.
 * OT rate per hour = day rate ÷ 12 (Odisha 12h basis) or ÷ 8 (staff / casual);
 * the hostel register pays no OT. Paid months show the register's OT amount.
 */
import type { HrEmployee } from "@/lib/hr-data";
import type { AttendanceRecord } from "@/stores/hr";
import { attendanceFor } from "@/stores/hr";
import { shiftById } from "@/lib/hr-master";
import { wageSchemeFor, schemeFromSource } from "@/lib/payroll";

export interface OtWeek { week: number; shiftId: string; shiftCode: string; days: number; hours: number; rate: number; amount: number; }
export interface OtRow {
  e: HrEmployee;
  ratePerHour: number;
  monthlyHours: number;
  monthlyAmount: number;
  weeks: OtWeek[];
  currentWeekHours: number;
  currentWeekAmount: number;
}

/** Split a whole-number total across buckets weighted by `weights` (largest-remainder). */
function distribute(total: number, weights: number[]): number[] {
  const n = weights.length;
  if (total <= 0) return weights.map(() => 0);
  const sumW = weights.reduce((a, b) => a + b, 0);
  const raw = sumW > 0 ? weights.map((w) => (total * w) / sumW) : weights.map(() => total / n);
  const out = raw.map((x) => Math.floor(x));
  let rem = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rem > 0 && k < order.length; k++, rem--) out[order[k][1]]++;
  return out;
}

export function otRowFor(e: HrEmployee, a: AttendanceRecord | undefined, currentWeekIndex: number): OtRow {
  const monthlyHours = a?.otHours ?? 0;
  const days = a?.weekDaysWorked ?? [0, 0, 0, 0];
  const scheme = schemeFromSource(a?.paid?.src) ?? wageSchemeFor(e.category);
  const day = a?.paid?.rate ?? a?.rate ?? e.salaryPerDay ?? (e.monthlyGross ? e.monthlyGross / 26 : 0);
  const rate = scheme === "hostel" ? 0 : Math.round((day / (scheme === "odisha" ? 12 : 8)) * 100) / 100;
  const monthlyAmount = a?.paid ? a.paid.otAmt : scheme === "odisha" ? Math.ceil(rate * monthlyHours) : Math.round(rate * monthlyHours);
  const perWeek = distribute(monthlyHours, days);
  const weeks: OtWeek[] = perWeek.map((h, i) => {
    const shiftId = a?.weekShiftIds?.[i] || e.shiftId;
    return { week: i + 1, shiftId, shiftCode: shiftById(shiftId)?.code ?? "—", days: days[i] ?? 0, hours: h, rate, amount: Math.round(h * rate) };
  });
  const cw = weeks[currentWeekIndex];
  return {
    e, ratePerHour: rate, monthlyHours, monthlyAmount, weeks,
    currentWeekHours: cw?.hours ?? 0, currentWeekAmount: cw?.amount ?? 0,
  };
}

export function otRows(employees: HrEmployee[], attendance: AttendanceRecord[], currentWeekIndex: number, month?: string): OtRow[] {
  return employees.map((e) => otRowFor(e, attendanceFor(attendance, e.id, month), currentWeekIndex));
}

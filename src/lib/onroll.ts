/**
 * On-roll daily report — the DAILY REPORT_ONROLL workbook.
 *
 * For a chosen date, per worker category and per unit:
 *   Opening + New Join + Re-join − Left = Closing
 * plus Present and Leave&Abs for that day.
 *
 * Opening is derived by rewinding the movement ledger: today's on-roll count
 * minus everyone who joined/re-joined since the date, plus everyone who left.
 * That keeps the identity above true by construction, without needing a stored
 * headcount snapshot for every past day.
 */

import type { HrEmployee } from "@/lib/hr-data";
import type { Movement, LeaveRequest, DailyAttendance } from "@/stores/hr";
import { WORKER_CATEGORIES, type WorkerCategoryId } from "@/lib/hr-master";

export interface OnRollCell {
  opening: number;
  newJoin: number;
  reJoin: number;
  left: number;
  present: number;
  leaveAbs: number;
  closing: number;
}

export interface OnRollRow {
  category: string;
  categoryId: WorkerCategoryId;
  perUnit: Record<string, OnRollCell>;
  total: OnRollCell;
}

export interface OnRollReport {
  date: string;
  units: string[];
  rows: OnRollRow[];
  grand: OnRollCell;
  /** True when every row satisfies Opening + New + Re-join − Left = Closing. */
  balanced: boolean;
}

const empty = (): OnRollCell => ({ opening: 0, newJoin: 0, reJoin: 0, left: 0, present: 0, leaveAbs: 0, closing: 0 });
const addInto = (a: OnRollCell, b: OnRollCell) => {
  a.opening += b.opening; a.newJoin += b.newJoin; a.reJoin += b.reJoin; a.left += b.left;
  a.present += b.present; a.leaveAbs += b.leaveAbs; a.closing += b.closing;
};

export interface OnRollInput {
  employees: HrEmployee[];
  movements: Movement[];
  leave: LeaveRequest[];
  daily: DailyAttendance[];
  date: string;
  units: string[];
}

const UNASSIGNED = "Unassigned";

export function buildOnRollReport(input: OnRollInput): OnRollReport {
  const { employees, movements, leave, daily, date } = input;
  const units = [...input.units, UNASSIGNED];
  const unitOf = (u?: string) => (u && input.units.includes(u) ? u : UNASSIGNED);

  const onDate = movements.filter((m) => m.date === date);

  const presentOn = (e: HrEmployee): boolean => {
    const d = daily.find((x) => x.empId === e.id && x.date === date)?.status;
    if (d) return d === "Present" || d === "Half Day";
    if (e.status === "Exited") return false;
    const onLeave = leave.some((l) => l.empId === e.id && (l.status === "Approved" || l.status === "Approved by Manager") && date >= l.from && date <= l.to);
    return !onLeave && e.leave.lopThisMonth === 0;
  };

  const rows: OnRollRow[] = WORKER_CATEGORIES.map((c) => {
    const perUnit: Record<string, OnRollCell> = Object.fromEntries(units.map((u) => [u, empty()]));
    const inCat = employees.filter((e) => e.category === c.id);

    for (const e of inCat) {
      const u = unitOf(e.unit);
      const cell = perUnit[u];
      // Closing = who is on the roll at the end of `date`.
      const leftOnOrBefore = movements.some((m) => m.empId === e.id && m.type === "Left" && m.date <= date);
      const reJoinedAfterLeaving = movements.some((m) => m.empId === e.id && m.type === "Re-join" && m.date <= date &&
        movements.some((x) => x.empId === e.id && x.type === "Left" && x.date < m.date));
      const joinedOnOrBefore = movements.some((m) => m.empId === e.id && (m.type === "New Join" || m.type === "Re-join") && m.date <= date)
        || (!!e.doj && e.doj <= date);
      const onRoll = joinedOnOrBefore && (!leftOnOrBefore || reJoinedAfterLeaving);
      if (onRoll) {
        cell.closing += 1;
        if (presentOn(e)) cell.present += 1; else cell.leaveAbs += 1;
      }
    }

    for (const m of onDate.filter((m) => m.category === c.id)) {
      const cell = perUnit[unitOf(m.unit)];
      if (m.type === "New Join") cell.newJoin += 1;
      else if (m.type === "Re-join") cell.reJoin += 1;
      else cell.left += 1;
    }

    // Opening = Closing − New − Re-join + Left (rewind the day's movements).
    for (const u of units) {
      const cell = perUnit[u];
      cell.opening = cell.closing - cell.newJoin - cell.reJoin + cell.left;
    }

    const total = empty();
    for (const u of units) addInto(total, perUnit[u]);
    return { category: c.label, categoryId: c.id, perUnit, total };
  }).filter((r) => r.total.closing > 0 || r.total.newJoin > 0 || r.total.left > 0 || r.total.reJoin > 0);

  const grand = empty();
  rows.forEach((r) => addInto(grand, r.total));

  const balanced = rows.every((r) => r.total.opening + r.total.newJoin + r.total.reJoin - r.total.left === r.total.closing);
  return { date, units, rows, grand, balanced };
}

export const ONROLL_UNASSIGNED = UNASSIGNED;

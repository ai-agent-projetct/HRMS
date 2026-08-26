"use client";

import { Fragment } from "react";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dailyFor, type AttendanceStatus, type DailyAttendance } from "@/stores/hr";
import { cn } from "@/lib/utils";
import type { HrEmployee } from "@/lib/hr-data";
import { categoryById, shiftById, SHIFTS } from "@/lib/hr-master";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CYCLE: AttendanceStatus[] = ["Present", "Half Day", "Absent", "Leave", "Holiday"];

const CELL_STYLES: Record<AttendanceStatus, string> = {
  Present: "bg-success/15 text-success border-success/50 hover:bg-success/25",
  "Half Day": "bg-emerald-500/10 text-emerald-700 border-emerald-500/40 hover:bg-emerald-500/20 dark:text-emerald-400",
  Absent: "bg-danger/15 text-danger border-danger/50 hover:bg-danger/25",
  Leave: "bg-info/15 text-info border-info/50 hover:bg-info/25",
  Holiday: "bg-warning/15 text-warning border-warning/50 hover:bg-warning/25",
};

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  Present: "P",
  "Half Day": "½",
  Absent: "A",
  Leave: "L",
  Holiday: "H",
};

type DayCell = { day: number; date: string; future: boolean };

export function AttendanceCalendar({
  employee,
  month,
  today,
  daily,
  weekShiftIds,
  onMark,
  onClear,
  onClose,
  onWeekShiftChange,
}: {
  employee: HrEmployee;
  month: string; // YYYY-MM
  today: string; // YYYY-MM-DD — later days are dimmed
  daily: DailyAttendance[];
  /** Shift per calendar week-row (index 0 = row containing the 1st); undefined/blank → employee's default shift. */
  weekShiftIds?: (string | null | undefined)[];
  onMark: (date: string, status: AttendanceStatus) => void;
  onClear: (date: string) => void;
  onClose: () => void;
  onWeekShiftChange?: (weekRow: number, shiftId: string) => void;
}) {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDow = new Date(y, m - 1, 1).getDay();
  const monthLabel = new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });

  const counts: Record<AttendanceStatus, number> = { Present: 0, "Half Day": 0, Absent: 0, Leave: 0, Holiday: 0 };
  for (const d of daily) {
    if (d.empId !== employee.id || !d.date.startsWith(month)) continue;
    counts[d.status] += 1;
  }

  const cycle = (date: string, current?: AttendanceStatus) => {
    if (!current) { onMark(date, CYCLE[0]); return; }
    const next = CYCLE.indexOf(current) + 1;
    if (next >= CYCLE.length) onClear(date);
    else onMark(date, CYCLE[next]);
  };

  // Group days into calendar week-rows (Sun–Sat) so a shift picked for one
  // row — e.g. on Monday — applies to that whole row, rotating shifts moved
  // week to week the way the mill actually schedules them.
  const rowCount = Math.ceil((firstDow + daysInMonth) / 7);
  const weeks: (DayCell | null)[][] = Array.from({ length: rowCount }, (_, w) =>
    Array.from({ length: 7 }, (_, i) => {
      const day = w * 7 + i - firstDow + 1;
      if (day < 1 || day > daysInMonth) return null;
      const date = `${month}-${String(day).padStart(2, "0")}`;
      return { day, date, future: date > today };
    })
  );

  return (
    <Modal
      title={`${employee.name} — Attendance Calendar`}
      description={`${employee.id} · ${categoryById(employee.category)?.label ?? employee.category} · ${monthLabel}`}
      onClose={onClose}
      wide
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone="success">{counts.Present} Present</Badge>
        <Badge tone="danger">{counts.Absent} Absent</Badge>
        <Badge tone="info">{counts.Leave} Leave</Badge>
        <Badge tone="warning">{counts.Holiday} Holiday</Badge>
        <Badge tone="muted">{daysInMonth - counts.Present - counts.Absent - counts.Leave - counts.Holiday} Unmarked</Badge>
      </div>

      <div className={cn("grid gap-1.5", onWeekShiftChange ? "grid-cols-[repeat(7,minmax(0,1fr))_5.5rem]" : "grid-cols-7")}>
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-1 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {w}
          </div>
        ))}
        {onWeekShiftChange && <div className="pb-1 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Shift</div>}

        {weeks.map((row, w) => {
          const weekShiftId = weekShiftIds?.[w] || employee.shiftId;
          return (
            <Fragment key={w}>
              {row.map((c, i) =>
                c ? (
                  (() => {
                    const rec = dailyFor(daily, employee.id, c.date);
                    const status = rec?.status;
                    return (
                      <button
                        key={c.date}
                        title={c.date}
                        onClick={() => cycle(c.date, status)}
                        className={cn(
                          "flex aspect-square flex-col items-center justify-center rounded-md border text-xs font-semibold transition-colors",
                          c.future && "opacity-40",
                          status ? CELL_STYLES[status] : "border-border text-muted-foreground hover:bg-accent",
                          c.day % 7 === 6 && !status && "border-dashed"
                        )}
                      >
                        <span className="text-[10px] text-muted-foreground">{c.day}</span>
                        <span>{status ? STATUS_LABEL[status] : "·"}</span>
                      </button>
                    );
                  })()
                ) : (
                  <div key={`pad-${w}-${i}`} />
                )
              )}
              {onWeekShiftChange && (
                <select
                  key={`shift-${w}`}
                  value={weekShiftId}
                  onChange={(ev) => onWeekShiftChange(w, ev.target.value)}
                  title={shiftById(weekShiftId)?.time}
                  className="h-full rounded-md border border-input bg-card px-1 text-center text-[11px] text-info focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {SHIFTS.map((s) => (
                    <option key={s.id} value={s.id}>{s.code} · {s.hours}h</option>
                  ))}
                </select>
              )}
            </Fragment>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 p-3 text-[11px] text-muted-foreground">
        <span>
          Click a day to cycle <b className="text-foreground">P → A → L → H → clear</b>. Saturdays are shown with a dashed
          border and count toward Incentive 1.
          {onWeekShiftChange && (
            <> Setting a row&apos;s <b className="text-foreground">Shift</b> applies to that whole week — pick it once (e.g. on Monday) and the rest of the row follows.</>
          )}
        </span>
        <Button variant="outline" size="sm" onClick={onClose}>Done</Button>
      </div>
    </Modal>
  );
}

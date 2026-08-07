"use client";

import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dailyFor, type AttendanceStatus, type DailyAttendance } from "@/stores/hr";
import { cn } from "@/lib/utils";
import type { HrEmployee } from "@/lib/hr-data";
import { categoryById } from "@/lib/hr-master";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CYCLE: AttendanceStatus[] = ["Present", "Absent", "Leave", "Holiday"];

const CELL_STYLES: Record<AttendanceStatus, string> = {
  Present: "bg-success/15 text-success border-success/50 hover:bg-success/25",
  Absent: "bg-danger/15 text-danger border-danger/50 hover:bg-danger/25",
  Leave: "bg-info/15 text-info border-info/50 hover:bg-info/25",
  Holiday: "bg-warning/15 text-warning border-warning/50 hover:bg-warning/25",
};

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  Present: "P",
  Absent: "A",
  Leave: "L",
  Holiday: "H",
};

export function AttendanceCalendar({
  employee,
  month,
  today,
  daily,
  onMark,
  onClear,
  onClose,
}: {
  employee: HrEmployee;
  month: string; // YYYY-MM
  today: string; // YYYY-MM-DD — later days are dimmed
  daily: DailyAttendance[];
  onMark: (date: string, status: AttendanceStatus) => void;
  onClear: (date: string) => void;
  onClose: () => void;
}) {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDow = new Date(y, m - 1, 1).getDay();
  const monthLabel = new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });

  const counts = { Present: 0, Absent: 0, Leave: 0, Holiday: 0 };
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

  const cells: { day: number; date: string; future: boolean }[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    cells.push({ day, date, future: date > today });
  }

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

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-1 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {w}
          </div>
        ))}
        {Array.from({ length: firstDow }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {cells.map((c) => {
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
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 p-3 text-[11px] text-muted-foreground">
        <span>
          Click a day to cycle <b className="text-foreground">P → A → L → H → clear</b>. Saturdays are shown with a dashed
          border and count toward Incentive 1.
        </span>
        <Button variant="outline" size="sm" onClick={onClose}>Done</Button>
      </div>
    </Modal>
  );
}

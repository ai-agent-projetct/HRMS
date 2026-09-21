"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** A calendar date picker — month/year jump + day grid — for choosing one date. */
export function DatePickerModal({
  value,
  today,
  title = "Select date",
  onSelect,
  onClose,
}: {
  value: string; // YYYY-MM-DD — the currently selected date
  today?: string; // YYYY-MM-DD — highlighted as "today"
  title?: string;
  onSelect: (date: string) => void;
  onClose: () => void;
}) {
  const [vy, vm] = value.split("-").map(Number);
  const [viewYear, setViewYear] = useState(vy);
  const [viewMonth, setViewMonth] = useState(vm - 1); // 0-based

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const fmt = (d: number) => `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const yearOptions = Array.from({ length: 21 }, (_, i) => vy - 10 + i);

  const changeMonth = (delta: number) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    else if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  };

  return (
    <Modal title={title} onClose={onClose}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button variant="outline" size="icon" className="h-7 w-7" title="Previous month" onClick={() => changeMonth(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-1.5">
          <select
            value={viewMonth}
            onChange={(e) => setViewMonth(Number(e.target.value))}
            className="h-8 rounded-md border border-input bg-card px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select
            value={viewYear}
            onChange={(e) => setViewYear(Number(e.target.value))}
            className="h-8 rounded-md border border-input bg-card px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <Button variant="outline" size="icon" className="h-7 w-7" title="Next month" onClick={() => changeMonth(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-1 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{w}</div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={`pad-${i}`} />;
          const date = fmt(d);
          const isSelected = date === value;
          const isToday = today && date === today;
          return (
            <button
              key={date}
              onClick={() => onSelect(date)}
              className={cn(
                "flex aspect-square items-center justify-center rounded-md border text-xs font-medium transition-colors hover:bg-accent",
                isSelected ? "border-primary bg-primary text-primary-foreground hover:bg-primary" : "border-transparent",
                !isSelected && isToday && "border-primary text-primary"
              )}
            >
              {d}
            </button>
          );
        })}
      </div>

      {today && (
        <div className="mt-4 flex justify-end border-t pt-3">
          <Button variant="outline" size="sm" onClick={() => onSelect(today)}>Today</Button>
        </div>
      )}
    </Modal>
  );
}

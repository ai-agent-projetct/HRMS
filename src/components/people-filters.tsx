"use client";

import { useState } from "react";
import { useHr, availableMonths, monthLabel, CURRENT_MONTH } from "@/stores/hr";
import type { HrEmployee } from "@/lib/hr-data";
import { latestPaidMonth } from "@/lib/payroll";

const selCls = "h-8 rounded-md border border-input bg-card px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring";

/**
 * Department + unit (and optionally month) filter shared by every people list.
 * Usage: const pf = usePeopleFilters(); rows.filter((r) => pf.match(r.e)); render {pf.ui}.
 */
export function usePeopleFilters(opts?: { month?: boolean }) {
  const employees = useHr((s) => s.employees);
  const units = useHr((s) => s.units);
  const attendance = useHr((s) => s.attendance);
  const [dept, setDept] = useState("All");
  const [unit, setUnit] = useState("All");
  // Until picked, follow the last paid month — data may hydrate after mount.
  const [picked, setMonth] = useState<string | null>(null);
  const month = picked ?? latestPaidMonth(attendance, CURRENT_MONTH);
  const departments = [...new Set(employees.map((e) => e.department).filter((d) => d && d !== "—"))].sort();

  const match = (e?: Pick<HrEmployee, "department" | "unit"> | null) =>
    !!e && (dept === "All" || e.department === dept) && (unit === "All" || (e.unit ?? "") === unit);
  /** For lists keyed by empId only (leave, advances…). */
  const matchId = (empId: string) => match(employees.find((e) => e.id === empId));

  const ui = (
    <>
      {opts?.month && (
        <select value={month} onChange={(e) => setMonth(e.target.value)} className={selCls} title="Month">
          {availableMonths(attendance).map((m) => <option key={m} value={m}>{monthLabel(m)}{m === CURRENT_MONTH ? " (current)" : ""}</option>)}
        </select>
      )}
      <select value={dept} onChange={(e) => setDept(e.target.value)} className={selCls} title="Department">
        <option value="All">All departments</option>
        {departments.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
      <select value={unit} onChange={(e) => setUnit(e.target.value)} className={selCls} title="Unit">
        <option value="All">All units</option>
        {units.map((u) => <option key={u} value={u}>{u}</option>)}
      </select>
    </>
  );

  return { match, matchId, ui, dept, unit, month, monthLabel: monthLabel(month), active: dept !== "All" || unit !== "All" };
}

"use client";

import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { BranchExplorer } from "@/components/branch-explorer";
import { useHr } from "@/stores/hr";
import { Building2, Users, UserCheck } from "lucide-react";

export default function BranchesPage() {
  const employees = useHr((s) => s.employees);
  const units = useHr((s) => s.units);

  const unassigned = employees.filter((e) => !e.unit).length;

  return (
    <>
      <PageHeader
        title="Branches / Units"
        description="Company units across the mill — attendance and workforce allocation are maintained per unit. Click a unit to see only its employees."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Units / Branches" value={`${units.length}`} icon={Building2} sub={units.join(" · ")} />
        <KpiCard label="Total workforce" value={`${employees.length}`} icon={Users} sub="across all units" tone="info" />
        <KpiCard label="Largest unit" value={largestUnit(employees, units)} icon={UserCheck} sub="by headcount" tone="success" />
        <KpiCard label="Unassigned" value={`${unassigned}`} icon={Users} sub={unassigned ? "allocate a branch" : "all allocated"} tone={unassigned ? "warning" : "success"} />
      </div>

      <BranchExplorer />
    </>
  );
}

function largestUnit(employees: { unit?: string }[], units: string[]): string {
  let best = "—", n = -1;
  for (const u of units) {
    const c = employees.filter((e) => (e.unit ?? "") === u).length;
    if (c > n) { n = c; best = `${u} (${c})`; }
  }
  return best;
}

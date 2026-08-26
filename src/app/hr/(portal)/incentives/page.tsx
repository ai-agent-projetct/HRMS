"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { downloadExcel, downloadExcelWorkbook } from "@/lib/excel";
import { DetailSheet } from "@/components/detail-sheet";
import { categoryById, shiftById, computeIncentives, INCENTIVE } from "@/lib/hr-master";
import { useHr, attendanceFor, CURRENT_MONTH_LABEL } from "@/stores/hr";
import type { HrEmployee } from "@/lib/hr-data";
import { formatINR } from "@/lib/utils";
import { Gift, CalendarCheck, Trophy, Coins, FileSpreadsheet, Layers } from "lucide-react";

export default function IncentivesPage() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"All" | "Inc1" | "Inc2" | "Both">("All");
  const [cat, setCat] = useState("All");
  const [detail, setDetail] = useState<HrEmployee | null>(null);
  const allEmployees = useHr((s) => s.employees);
  const attendance = useHr((s) => s.attendance);
  // Incentives are the daily-wage labour attendance scheme.
  const dailyEmployees = allEmployees.filter((e) => e.wageType === "Daily");
  const catOptions = [...new Set(dailyEmployees.map((e) => e.category))];
  const employees = dailyEmployees.filter((e) => cat === "All" || e.category === cat);

  const rows = employees
    .map((e) => {
      const a = attendanceFor(attendance, e.id);
      const inc = computeIncentives(a?.saturdaysWorked ?? 0, a?.totalSaturdays ?? 4, a?.daysWorked ?? 0);
      return { e, a, inc };
    })
    .filter((r) => r.inc.total > 0 || filter === "All")
    .filter((r) => {
      if (filter === "Inc1") return r.inc.inc1Eligible;
      if (filter === "Inc2") return r.inc.inc2Eligible;
      if (filter === "Both") return r.inc.inc1Eligible && r.inc.inc2Eligible;
      return true;
    })
    .filter((r) => `${r.e.name} ${r.e.id} ${r.e.department}`.toLowerCase().includes(q.toLowerCase()));

  const inc1Count = employees.filter((e) => { const a = attendanceFor(attendance, e.id); return computeIncentives(a?.saturdaysWorked ?? 0, a?.totalSaturdays ?? 4, a?.daysWorked ?? 0).inc1Eligible; }).length;
  const inc2Count = employees.filter((e) => { const a = attendanceFor(attendance, e.id); return computeIncentives(a?.saturdaysWorked ?? 0, a?.totalSaturdays ?? 4, a?.daysWorked ?? 0).inc2Eligible; }).length;
  const totalPayout = employees.reduce((s, e) => { const a = attendanceFor(attendance, e.id); return s + computeIncentives(a?.saturdaysWorked ?? 0, a?.totalSaturdays ?? 4, a?.daysWorked ?? 0).total; }, 0);

  const exportIncentives = () =>
    downloadExcel({
      filename: `incentives-${CURRENT_MONTH_LABEL}`, sheetName: "Incentives", title: `Incentives — ${CURRENT_MONTH_LABEL}`,
      columns: [
        { header: "Emp ID", key: "id" }, { header: "Name", key: "name", width: 22 }, { header: "Category", key: "category" },
        { header: "Days", key: "days" }, { header: "Saturdays", key: "sat" },
        { header: "Inc-1 (Sat) ₹", key: "inc1" }, { header: "Inc-1 full?", key: "inc1full" },
        { header: "Inc-2 (28d) ₹", key: "inc2" }, { header: "Total ₹", key: "total" },
      ],
      rows: rows.map((r) => ({
        id: r.e.id, name: r.e.name, category: categoryById(r.e.category)?.label,
        days: r.a?.daysWorked ?? 0, sat: `${r.a?.saturdaysWorked ?? 0}/${r.a?.totalSaturdays ?? 4}`,
        inc1: r.inc.inc1Amount, inc1full: r.inc.inc1Eligible ? "Yes" : "No", inc2: r.inc.inc2Amount, total: r.inc.total,
      })),
    });

  /** Every incentive-eligible worker, all categories, plus a category summary. */
  const bulkExport = () => {
    const all = dailyEmployees.map((e) => {
      const a = attendanceFor(attendance, e.id);
      const inc = computeIncentives(a?.saturdaysWorked ?? 0, a?.totalSaturdays ?? 4, a?.daysWorked ?? 0);
      return { e, a, inc };
    });
    const byCat = new Map<string, { workers: number; inc1: number; inc2: number; total: number }>();
    for (const r of all) {
      const k = categoryById(r.e.category)?.label ?? r.e.category;
      const c = byCat.get(k) ?? { workers: 0, inc1: 0, inc2: 0, total: 0 };
      c.workers += 1; c.inc1 += r.inc.inc1Amount; c.inc2 += r.inc.inc2Amount; c.total += r.inc.total;
      byCat.set(k, c);
    }
    downloadExcelWorkbook({
      filename: `incentives-bulk-${CURRENT_MONTH_LABEL}`,
      sheets: [
        {
          sheetName: "All Incentives", title: `Incentives — all categories — ${CURRENT_MONTH_LABEL}`,
          columns: [
            { header: "Emp ID", key: "id" }, { header: "Name", key: "name", width: 22 }, { header: "Category", key: "category", width: 16 },
            { header: "Unit", key: "unit" }, { header: "Department", key: "dept", width: 16 },
            { header: "Days", key: "days" }, { header: "Saturdays", key: "sat" },
            { header: "Inc-1 (Sat)", key: "inc1" }, { header: "Inc-1 Full?", key: "inc1full" },
            { header: "Inc-2 (28d)", key: "inc2" }, { header: "Total", key: "total" },
          ],
          rows: all.map((r) => ({
            id: r.e.id, name: r.e.name, category: categoryById(r.e.category)?.label ?? r.e.category,
            unit: r.e.unit ?? "", dept: r.e.department,
            days: r.a?.daysWorked ?? 0, sat: `${r.a?.saturdaysWorked ?? 0}/${r.a?.totalSaturdays ?? 4}`,
            inc1: r.inc.inc1Amount, inc1full: r.inc.inc1Eligible ? "Yes" : "No", inc2: r.inc.inc2Amount, total: r.inc.total,
          })),
        },
        {
          sheetName: "Category Summary", title: `Incentive Summary by Category — ${CURRENT_MONTH_LABEL}`,
          columns: [
            { header: "Category", key: "category", width: 20 }, { header: "Workers", key: "workers" },
            { header: "Incentive 1", key: "inc1" }, { header: "Incentive 2", key: "inc2" }, { header: "Total", key: "total" },
          ],
          rows: [...byCat.entries()].map(([category, c]) => ({ category, ...c })),
        },
        {
          sheetName: "Eligible Only", title: `Workers Earning an Incentive — ${CURRENT_MONTH_LABEL}`,
          columns: [
            { header: "Emp ID", key: "id" }, { header: "Name", key: "name", width: 22 },
            { header: "Category", key: "category", width: 16 }, { header: "Total", key: "total" },
          ],
          rows: all.filter((r) => r.inc.total > 0).map((r) => ({
            id: r.e.id, name: r.e.name, category: categoryById(r.e.category)?.label ?? r.e.category, total: r.inc.total,
          })),
        },
      ],
    });
  };

  return (
    <>
      <PageHeader
        title="Incentives"
        description={`Incentive 1 — ₹${INCENTIVE.perSaturday}/Saturday worked (full if every Saturday). Incentive 2 — flat ₹${INCENTIVE.fullMonthAmount} for ${INCENTIVE.fullMonthDays}+ days. Auto-computed from attendance.`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={bulkExport}><Layers className="h-4 w-4" /> Bulk export</Button>
            <Button variant="outline" size="sm" onClick={exportIncentives}><FileSpreadsheet className="h-4 w-4" /> Export view</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total incentive payout" value={formatINR(totalPayout, true)} icon={Coins} sub={CURRENT_MONTH_LABEL} tone="success" />
        <KpiCard label="Incentive 1 — full" value={`${inc1Count}`} icon={CalendarCheck} sub="worked every Saturday" tone="info" />
        <KpiCard label="Incentive 2 — earned" value={`${inc2Count}`} icon={Trophy} sub="28+ days worked" tone="warning" />
        <KpiCard label="Both incentives" value={`${employees.filter((e) => { const a = attendanceFor(attendance, e.id); const i = computeIncentives(a?.saturdaysWorked ?? 0, a?.totalSaturdays ?? 4, a?.daysWorked ?? 0); return i.inc1Eligible && i.inc2Eligible; }).length}`} icon={Gift} sub="star attendance" />
      </div>

      <Card>
        <CardContent className="py-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {(["All", "Inc1", "Inc2", "Both"] as const).map((f) => (
                <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" className="h-7 px-2.5 text-[11px]" onClick={() => setFilter(f)}>
                  {f === "All" ? "All" : f === "Inc1" ? "Incentive 1" : f === "Inc2" ? "Incentive 2" : "Both"}
                </Button>
              ))}
              <select value={cat} onChange={(e) => setCat(e.target.value)} className="ml-1 h-8 rounded-md border border-input bg-card px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring" title="Filter by worker category">
                <option value="All">All categories</option>
                {catOptions.map((c) => <option key={c} value={c}>{categoryById(c)?.label ?? c}</option>)}
              </select>
            </div>
            <Input placeholder="Search name, ID, dept…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
          </div>
          <Table>
            <THead>
              <TR><TH>Emp ID</TH><TH>Name</TH><TH>Category</TH><TH className="text-center">Days</TH><TH className="text-center">Saturdays</TH><TH className="text-right">Incentive 1</TH><TH className="text-right">Incentive 2</TH><TH className="text-right">Total</TH></TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.e.id} className="cursor-pointer" onClick={() => setDetail(r.e)}>
                  <TD className="font-mono text-xs text-muted-foreground">{r.e.id}</TD>
                  <TD className="font-medium">{r.e.name}<div className="text-[10px] font-normal text-primary">View details →</div></TD>
                  <TD><Badge tone="muted">{categoryById(r.e.category)?.label ?? r.e.category}</Badge></TD>
                  <TD className="text-center">{r.a?.daysWorked ?? 0}</TD>
                  <TD className="text-center">{r.a?.saturdaysWorked ?? 0}/{r.a?.totalSaturdays ?? 4}</TD>
                  <TD className="text-right">
                    {r.inc.inc1Amount > 0 ? (
                      <span className="inline-flex items-center gap-1.5">{formatINR(r.inc.inc1Amount)}{r.inc.inc1Eligible && <Badge tone="success">Full</Badge>}</span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TD>
                  <TD className="text-right">{r.inc.inc2Amount > 0 ? <span className="inline-flex items-center gap-1.5">{formatINR(r.inc.inc2Amount)}<Badge tone="success">28d</Badge></span> : <span className="text-muted-foreground">—</span>}</TD>
                  <TD className="text-right font-semibold">{r.inc.total > 0 ? formatINR(r.inc.total) : "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {rows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No workers match this filter.</p>}
        </CardContent>
      </Card>

      {detail && (() => {
        const a = attendanceFor(attendance, detail.id);
        const days = a?.daysWorked ?? 0, sat = a?.saturdaysWorked ?? 0, totSat = a?.totalSaturdays ?? 4;
        const inc = computeIncentives(sat, totSat, days);
        const sh = shiftById(detail.shiftId);
        return (
          <DetailSheet
            title={`${detail.name} — Incentives`}
            subtitle={`${detail.id} · ${categoryById(detail.category)?.label} · ${CURRENT_MONTH_LABEL}`}
            badges={[
              { label: inc.inc1Eligible ? "Incentive 1: Full" : inc.inc1Amount > 0 ? "Incentive 1: Partial" : "Incentive 1: —", tone: inc.inc1Eligible ? "success" : inc.inc1Amount > 0 ? "warning" : "muted" },
              { label: inc.inc2Eligible ? "Incentive 2: Earned" : "Incentive 2: —", tone: inc.inc2Eligible ? "success" : "muted" },
            ]}
            onClose={() => setDetail(null)}
            sections={[
              { heading: "Attendance basis", stats: [
                { label: "Days worked", value: `${days}` },
                { label: "Saturdays", value: `${sat}/${totSat}` },
                { label: "OT hours", value: `${a?.otHours ?? 0}` },
                { label: "Shift", value: sh?.code ?? "—" },
              ] },
              { heading: "Incentive 1 — Saturday scheme", rows: [
                ["Rule", `₹${INCENTIVE.perSaturday} per Saturday worked; full if all ${totSat} worked`],
                ["Saturdays worked", `${sat} of ${totSat}`],
                ["Eligibility", inc.inc1Eligible ? "Full (every Saturday)" : inc.inc1Amount > 0 ? "Partial" : "Not eligible"],
                ["Amount", formatINR(inc.inc1Amount)],
              ] },
              { heading: "Incentive 2 — 28-day attendance", rows: [
                ["Rule", `Flat ₹${INCENTIVE.fullMonthAmount} for ${INCENTIVE.fullMonthDays}+ days worked`],
                ["Days worked", `${days} (need ${INCENTIVE.fullMonthDays})`],
                ["Eligibility", inc.inc2Eligible ? "Earned" : "Not eligible"],
                ["Amount", formatINR(inc.inc2Amount)],
              ] },
              { heading: "Total incentive", rows: [
                ["Incentive 1", formatINR(inc.inc1Amount)],
                ["Incentive 2", formatINR(inc.inc2Amount)],
                ["Total payable", formatINR(inc.total)],
              ], note: "Incentives are added to the worker's gross on the payroll and wage statement." },
            ]}
          />
        );
      })()}
    </>
  );
}

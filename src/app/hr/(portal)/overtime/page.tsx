"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { DetailSheet } from "@/components/detail-sheet";
import { downloadExcel } from "@/lib/excel";
import { categoryById, shiftById, WEEK_LABELS, CURRENT_WEEK_INDEX, OT_RATE_MULTIPLIER } from "@/lib/hr-master";
import { useHr, CURRENT_MONTH_LABEL } from "@/stores/hr";
import { otRows, type OtRow } from "@/lib/ot";
import { formatINR } from "@/lib/utils";
import { Clock, Timer, IndianRupee, Users, FileSpreadsheet, ChevronRight } from "lucide-react";

const selectCls = "h-8 rounded-md border border-input bg-card px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring";

export default function OvertimePage() {
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("All");
  const [span, setSpan] = useState<"weekly" | "monthly">("monthly");
  const [detail, setDetail] = useState<OtRow | null>(null);
  const employees = useHr((s) => s.employees);
  const attendance = useHr((s) => s.attendance);

  const departments = useMemo(() => [...new Set(employees.map((e) => e.department).filter(Boolean))].sort(), [employees]);

  const all = useMemo(() => otRows(employees, attendance, CURRENT_WEEK_INDEX), [employees, attendance]);
  const rows = all
    .filter((r) => (span === "weekly" ? r.currentWeekHours > 0 : r.monthlyHours > 0))
    .filter((r) => dept === "All" || r.e.department === dept)
    .filter((r) => `${r.e.name} ${r.e.id} ${r.e.department}`.toLowerCase().includes(q.toLowerCase()));

  const totHours = rows.reduce((s, r) => s + (span === "weekly" ? r.currentWeekHours : r.monthlyHours), 0);
  const totAmount = rows.reduce((s, r) => s + (span === "weekly" ? r.currentWeekAmount : r.monthlyAmount), 0);

  const exportReport = () =>
    downloadExcel({
      filename: "ot-wages-report",
      sheetName: "OT Wages",
      title: `O.T WAGES REPORT — ${CURRENT_MONTH_LABEL} (OT paid at ${OT_RATE_MULTIPLIER}× hourly)`,
      columns: [
        { header: "Emp ID", key: "id" }, { header: "Name", key: "name", width: 22 }, { header: "Dept", key: "dept", width: 16 },
        { header: "Category", key: "category", width: 14 }, { header: "OT Rate/Hr ₹", key: "rate" },
        { header: "W1 Hrs", key: "w1" }, { header: "W2 Hrs", key: "w2" }, { header: "W3 Hrs", key: "w3" }, { header: "W4 Hrs", key: "w4" },
        { header: "Total OT Hrs", key: "hrs" }, { header: "OT Wages ₹", key: "amt" },
      ],
      rows: all.filter((r) => r.monthlyHours > 0).map((r) => ({
        id: r.e.id, name: r.e.name, dept: r.e.department, category: categoryById(r.e.category)?.label ?? r.e.category,
        rate: r.ratePerHour, w1: r.weeks[0].hours, w2: r.weeks[1].hours, w3: r.weeks[2].hours, w4: r.weeks[3].hours,
        hrs: r.monthlyHours, amt: r.monthlyAmount,
      })),
    });

  return (
    <>
      <PageHeader
        title="Overtime (OT) Wages"
        description={`Weekly & monthly OT — hours × ${OT_RATE_MULTIPLIER}× hourly rate (wage-per-day ÷ 8). Filter by department, view any worker's OT history by week & shift.`}
        actions={<Button variant="outline" size="sm" onClick={exportReport}><FileSpreadsheet className="h-4 w-4" /> Export O.T Wages Report</Button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Workers on OT" value={`${rows.length}`} icon={Users} sub={span === "weekly" ? WEEK_LABELS[CURRENT_WEEK_INDEX] : CURRENT_MONTH_LABEL} />
        <KpiCard label={span === "weekly" ? "OT hours (this week)" : "OT hours (month)"} value={`${totHours}`} icon={Timer} sub="total across workers" tone="info" />
        <KpiCard label="OT wages" value={formatINR(totAmount, true)} icon={IndianRupee} sub={`${OT_RATE_MULTIPLIER}× hourly`} tone="success" />
        <KpiCard label="Span" value={span === "weekly" ? "Weekly" : "Monthly"} icon={Clock} sub="toggle below" tone="warning" />
      </div>

      <Card>
        <CardContent className="py-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button variant={span === "weekly" ? "default" : "outline"} size="sm" className="h-7 px-2.5 text-[11px]" onClick={() => setSpan("weekly")}>Weekly</Button>
              <Button variant={span === "monthly" ? "default" : "outline"} size="sm" className="h-7 px-2.5 text-[11px]" onClick={() => setSpan("monthly")}>Monthly</Button>
              <select value={dept} onChange={(e) => setDept(e.target.value)} className={`${selectCls} ml-1`} title="Filter by department">
                <option value="All">All departments</option>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <Input placeholder="Search name, ID, dept…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
          </div>
          <Table>
            <THead>
              {span === "weekly" ? (
                <TR><TH>Emp ID</TH><TH>Name</TH><TH>Dept</TH><TH>Shift (wk)</TH><TH className="text-center">OT hrs</TH><TH className="text-right">Rate/hr</TH><TH className="text-right">OT wages</TH><TH></TH></TR>
              ) : (
                <TR><TH>Emp ID</TH><TH>Name</TH><TH>Dept</TH>{WEEK_LABELS.map((_, i) => <TH key={i} className="text-center">W{i + 1}</TH>)}<TH className="text-center">Total hrs</TH><TH className="text-right">Rate/hr</TH><TH className="text-right">OT wages</TH><TH></TH></TR>
              )}
            </THead>
            <TBody>
              {rows.map((r) => {
                const cw = r.weeks[CURRENT_WEEK_INDEX];
                return (
                  <TR key={r.e.id} className="cursor-pointer" onClick={() => setDetail(r)}>
                    <TD className="font-mono text-xs text-muted-foreground">{r.e.id}</TD>
                    <TD className="font-medium">{r.e.name}<div className="text-[10px] font-normal text-primary">View OT history →</div></TD>
                    <TD className="text-xs">{r.e.department}</TD>
                    {span === "weekly" ? (
                      <>
                        <TD><Badge tone="info">{cw?.shiftCode ?? "—"}</Badge></TD>
                        <TD className="text-center">{r.currentWeekHours}</TD>
                        <TD className="text-right">{formatINR(r.ratePerHour)}</TD>
                        <TD className="text-right font-semibold">{formatINR(r.currentWeekAmount)}</TD>
                      </>
                    ) : (
                      <>
                        {r.weeks.map((w) => <TD key={w.week} className="text-center text-xs">{w.hours || "—"}</TD>)}
                        <TD className="text-center font-semibold">{r.monthlyHours}</TD>
                        <TD className="text-right">{formatINR(r.ratePerHour)}</TD>
                        <TD className="text-right font-semibold">{formatINR(r.monthlyAmount)}</TD>
                      </>
                    )}
                    <TD className="text-right"><ChevronRight className="h-4 w-4 text-muted-foreground" /></TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          {rows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No OT recorded for this {span === "weekly" ? "week" : "month"} / filter.</p>}
        </CardContent>
      </Card>

      {detail && (
        <DetailSheet
          title={`${detail.e.name} — OT history`}
          subtitle={`${detail.e.id} · ${detail.e.department} · ${CURRENT_MONTH_LABEL}`}
          badges={[
            { label: `${detail.monthlyHours} OT hrs`, tone: "info" },
            { label: `${formatINR(detail.monthlyAmount)} OT wages`, tone: "success" },
            { label: `Rate ${formatINR(detail.ratePerHour)}/hr`, tone: "muted" },
          ]}
          onClose={() => setDetail(null)}
          sections={[
            { heading: "OT summary", stats: [
              { label: "Total OT hrs", value: `${detail.monthlyHours}` },
              { label: "Rate / hr", value: formatINR(detail.ratePerHour) },
              { label: "OT wages", value: formatINR(detail.monthlyAmount) },
              { label: "Multiplier", value: `${OT_RATE_MULTIPLIER}×` },
            ] },
            { heading: "Week-by-week — when, which shift, how many hours", table: {
              cols: ["Week", "Shift", "Days", "OT hrs", "Rate/hr", "Amount"],
              right: [false, false, true, true, true, true],
              rows: detail.weeks.map((w) => [
                WEEK_LABELS[w.week - 1] ?? `Week ${w.week}`,
                `${w.shiftCode}${shiftById(w.shiftId)?.name ? ` — ${shiftById(w.shiftId)!.name}` : ""}`,
                String(w.days), String(w.hours), formatINR(w.rate), formatINR(w.amount),
              ]),
            }, note: `OT paid at ${OT_RATE_MULTIPLIER}× the hourly rate (wage-per-day ÷ 8 hrs). Hours are split across weeks by days worked.` },
          ]}
        />
      )}
    </>
  );
}

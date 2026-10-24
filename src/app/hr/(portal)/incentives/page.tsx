"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { downloadExcel } from "@/lib/excel";
import { DetailSheet } from "@/components/detail-sheet";
import { categoryById } from "@/lib/hr-master";
import { monthlyIncentive, type WageScheme } from "@/lib/mill-wages";
import { schemeFromSource, wageSchemeFor } from "@/lib/payroll";
import { useHr, attendanceFor } from "@/stores/hr";
import { usePeopleFilters } from "@/components/people-filters";
import type { HrEmployee } from "@/lib/hr-data";
import { formatINR } from "@/lib/utils";
import { Gift, CalendarCheck, Trophy, Coins, FileSpreadsheet } from "lucide-react";

/** ₹ per day by slab, as the registers pay it. */
const slabRate = (days: number, scheme: WageScheme) => {
  if (scheme !== "odisha" && scheme !== "hostel") return 0;
  const [low, high] = scheme === "hostel" ? [10, 20] : [15, 30];
  return days >= 28 ? high : days >= 26 ? low : 0;
};
const RULE = "Odisha register: 26–27 days ₹15/day, 28+ days ₹30/day · Hostel girls: 26–27 days ₹10/day, 28+ days ₹20/day";

export default function IncentivesPage() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"All" | "Earned" | "26–27" | "28+" | "Near">("All");
  const [detail, setDetail] = useState<HrEmployee | null>(null);
  const employees = useHr((s) => s.employees);
  const attendance = useHr((s) => s.attendance);
  const pf = usePeopleFilters({ month: true });

  // Everyone with attendance that month on a register that pays the incentive
  // (or whose paid statement carries one — apprentice / casual).
  const all = employees.flatMap((e) => {
    const a = attendanceFor(attendance, e.id, pf.month);
    if (!a || (!a.paid && a.daysWorked <= 0)) return [];
    const scheme = schemeFromSource(a.paid?.src) ?? wageSchemeFor(e.category);
    const amount = a.paid ? a.paid.incentive : monthlyIncentive(a.daysWorked, scheme);
    if (scheme !== "odisha" && scheme !== "hostel" && !amount) return [];
    return [{ e, a, days: a.daysWorked, scheme, rate: slabRate(a.daysWorked, scheme), amount, fromRegister: !!a.paid }];
  }).filter((r) => pf.match(r.e));

  const rows = all
    .filter((r) => {
      if (filter === "Earned") return r.amount > 0;
      if (filter === "26–27") return r.days >= 26 && r.days < 28;
      if (filter === "28+") return r.days >= 28;
      if (filter === "Near") return r.days >= 23 && r.days < 26; // 1–3 days short of the slab
      return true;
    })
    .filter((r) => `${r.e.name} ${r.e.id} ${r.e.department}`.toLowerCase().includes(q.toLowerCase()));

  const total = all.reduce((s, r) => s + r.amount, 0);
  const low = all.filter((r) => r.days >= 26 && r.days < 28).length;
  const high = all.filter((r) => r.days >= 28).length;
  const near = all.filter((r) => r.days >= 23 && r.days < 26).length;

  const exportIncentives = () =>
    downloadExcel({
      filename: `incentives-${pf.month}`, sheetName: "Incentives", title: `Attendance Incentive — ${pf.monthLabel} (${RULE})`,
      columns: [
        { header: "Emp ID", key: "id" }, { header: "Name", key: "name", width: 22 }, { header: "Department", key: "dept" },
        { header: "Unit", key: "unit" }, { header: "Category", key: "category", width: 16 }, { header: "Register", key: "reg" },
        { header: "Days", key: "days" }, { header: "₹/day", key: "rate" }, { header: "Incentive ₹", key: "amount" }, { header: "Source", key: "src" },
      ],
      rows: rows.map((r) => ({
        id: r.e.id, name: r.e.name, dept: r.e.department, unit: r.e.unit ?? "", category: categoryById(r.e.category)?.label ?? r.e.category,
        reg: r.scheme === "hostel" ? "Hostel girls" : r.scheme === "odisha" ? "Odisha" : "Statement", days: r.days, rate: r.rate,
        amount: r.amount, src: r.fromRegister ? "Salary register" : "Computed",
      })),
    });

  return (
    <>
      <PageHeader
        title="Incentives"
        description={`Monthly attendance incentive, exactly as the salary registers pay it. ${RULE}. Months paid from a register show the register figure.`}
        actions={<Button variant="outline" size="sm" onClick={exportIncentives}><FileSpreadsheet className="h-4 w-4" /> Export</Button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total incentive" value={formatINR(total, true)} icon={Coins} sub={pf.monthLabel} tone="success" />
        <KpiCard label="26–27 days" value={`${low}`} icon={CalendarCheck} sub="lower slab" tone="info" />
        <KpiCard label="28+ days" value={`${high}`} icon={Trophy} sub="full slab" tone="warning" />
        <KpiCard label="Just short (23–25 days)" value={`${near}`} icon={Gift} sub="1–3 days from the slab" />
      </div>

      <Card>
        <CardContent className="py-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {(["All", "Earned", "26–27", "28+", "Near"] as const).map((f) => (
                <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" className="h-7 px-2.5 text-[11px]" onClick={() => setFilter(f)}>
                  {f === "Near" ? "Just short" : f === "26–27" ? "26–27 days" : f === "28+" ? "28+ days" : f}
                </Button>
              ))}
              {pf.ui}
            </div>
            <Input placeholder="Search name, ID, dept…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
          </div>
          <Table>
            <THead>
              <TR><TH>Emp ID</TH><TH>Name</TH><TH>Dept</TH><TH>Unit</TH><TH>Category</TH><TH className="text-center">Days</TH><TH className="text-right">₹/day</TH><TH className="text-right">Incentive</TH></TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.e.id} className="cursor-pointer" onClick={() => setDetail(r.e)}>
                  <TD className="font-mono text-xs text-muted-foreground">{r.e.id}</TD>
                  <TD className="font-medium">{r.e.name}<div className="text-[10px] font-normal text-primary">View details →</div></TD>
                  <TD className="text-xs">{r.e.department}</TD>
                  <TD className="text-xs">{r.e.unit ?? "—"}</TD>
                  <TD><Badge tone="muted">{categoryById(r.e.category)?.label ?? r.e.category}</Badge></TD>
                  <TD className="text-center">{r.days}</TD>
                  <TD className="text-right">{r.rate ? formatINR(r.rate) : "—"}</TD>
                  <TD className="text-right font-semibold">{r.amount > 0 ? formatINR(r.amount) : "—"}{r.fromRegister && <span className="ml-1 text-[9px] font-normal text-muted-foreground">reg</span>}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {rows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No workers with attendance for {pf.monthLabel} match this filter.</p>}
        </CardContent>
      </Card>

      {detail && (() => {
        const r = all.find((x) => x.e.id === detail.id);
        if (!r) return null;
        const needed = r.days >= 28 ? 0 : r.days >= 26 ? 28 - r.days : 26 - r.days;
        return (
          <DetailSheet
            title={`${detail.name} — Attendance incentive`}
            subtitle={`${detail.id} · ${categoryById(detail.category)?.label ?? detail.category} · ${pf.monthLabel}`}
            badges={[{ label: r.amount > 0 ? `Earned ${formatINR(r.amount)}` : "Not earned", tone: r.amount > 0 ? "success" : "muted" }]}
            onClose={() => setDetail(null)}
            sections={[
              { heading: "Basis", stats: [
                { label: "Days worked", value: `${r.days}` },
                { label: "OT hours", value: `${r.a.otHours}` },
                { label: "Register", value: r.scheme === "hostel" ? "Hostel" : r.scheme === "odisha" ? "Odisha" : "Statement" },
                { label: "₹/day", value: r.rate ? `₹${r.rate}` : "—" },
              ] },
              { heading: "Rule", rows: [
                ["Slabs", r.scheme === "hostel" ? "26–27 days ₹10/day · 28+ days ₹20/day" : "26–27 days ₹15/day · 28+ days ₹30/day"],
                ["This month", r.amount > 0 ? `${r.days} days × ₹${r.rate} = ${formatINR(r.amount)}` : "Below 26 days — no incentive"],
                ["Next slab", needed ? `${needed} more day(s)` : "Top slab reached"],
                ["Figure", r.fromRegister ? "As paid in the salary register" : "Computed by the wage engine"],
              ], note: "The incentive is part of gross pay on Payroll, the wage statement and the employee's Salary Record." },
            ]}
          />
        );
      })()}
    </>
  );
}

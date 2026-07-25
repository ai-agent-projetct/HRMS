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
import { SHIFTS, shiftById, categoryById, computeIncentives } from "@/lib/hr-master";
import { useHr, attendanceFor, CURRENT_MONTH_LABEL } from "@/stores/hr";
import { CalendarCheck, Users, TrendingUp, AlertTriangle, FileSpreadsheet } from "lucide-react";

export default function AttendancePage() {
  const [q, setQ] = useState("");
  const [shift, setShift] = useState("All");
  const employees = useHr((s) => s.employees);
  const attendance = useHr((s) => s.attendance);
  const setAttendance = useHr((s) => s.setAttendance);

  const rows = employees
    .filter((e) => shift === "All" || e.shiftId === shift)
    .filter((e) => `${e.name} ${e.id} ${e.department}`.toLowerCase().includes(q.toLowerCase()))
    .map((e) => {
      const a = attendanceFor(attendance, e.id);
      const daysWorked = a?.daysWorked ?? 0;
      const saturdaysWorked = a?.saturdaysWorked ?? 0;
      const totalSat = a?.totalSaturdays ?? 4;
      const inc = computeIncentives(saturdaysWorked, totalSat, daysWorked);
      return { e, a, daysWorked, saturdaysWorked, totalSat, otHours: a?.otHours ?? 0, absent: a?.absent ?? 0, inc };
    });

  const fullAttendance = rows.filter((r) => r.daysWorked >= 28).length;
  const avgDays = rows.length ? Math.round(rows.reduce((s, r) => s + r.daysWorked, 0) / rows.length) : 0;
  const lowAttendance = rows.filter((r) => r.daysWorked < 20).length;

  const exportAttendance = () =>
    downloadExcel({
      filename: `attendance-${CURRENT_MONTH_LABEL}`, sheetName: "Attendance", title: `Attendance — ${CURRENT_MONTH_LABEL}`,
      columns: [
        { header: "Emp ID", key: "id" }, { header: "Name", key: "name", width: 22 }, { header: "Category", key: "category" },
        { header: "Shift", key: "shift" }, { header: "Days Worked", key: "daysWorked" }, { header: "Saturdays", key: "sat" },
        { header: "OT (hr)", key: "otHours" }, { header: "Absent", key: "absent" },
        { header: "Inc-1 ₹", key: "inc1" }, { header: "Inc-2 ₹", key: "inc2" },
      ],
      rows: rows.map((r) => ({
        id: r.e.id, name: r.e.name, category: categoryById(r.e.category)?.label ?? r.e.category,
        shift: shiftById(r.e.shiftId)?.code ?? "", daysWorked: r.daysWorked, sat: `${r.saturdaysWorked}/${r.totalSat}`,
        otHours: r.otHours, absent: r.absent, inc1: r.inc.inc1Amount, inc2: r.inc.inc2Amount,
      })),
    });

  const num = (v: string) => Math.max(0, Number(v) || 0);

  return (
    <>
      <PageHeader
        title="Attendance & Shifts"
        description={`Monthly attendance for ${CURRENT_MONTH_LABEL} — days worked drive day-wage pay and both incentives. Edit inline; it flows straight into payroll.`}
        actions={<Button variant="outline" size="sm" onClick={exportAttendance}><FileSpreadsheet className="h-4 w-4" /> Export</Button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Workforce" value={`${rows.length}`} icon={Users} sub={`${SHIFTS.length} shifts`} />
        <KpiCard label="Avg days worked" value={`${avgDays}`} icon={CalendarCheck} sub={`of 28 · ${CURRENT_MONTH_LABEL}`} tone="info" />
        <KpiCard label="Full attendance (28+)" value={`${fullAttendance}`} icon={TrendingUp} sub="qualify for Incentive 2" tone="success" />
        <KpiCard label="Low attendance (<20)" value={`${lowAttendance}`} icon={AlertTriangle} sub="review conduct / agent" tone="danger" />
      </div>

      <Card>
        <CardContent className="py-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              <Button variant={shift === "All" ? "default" : "outline"} size="sm" className="h-7 px-2.5 text-[11px]" onClick={() => setShift("All")}>All shifts</Button>
              {SHIFTS.map((s) => (
                <Button key={s.id} variant={shift === s.id ? "default" : "outline"} size="sm" className="h-7 px-2.5 text-[11px]" onClick={() => setShift(s.id)} title={s.time}>{s.code} · {s.name}</Button>
              ))}
            </div>
            <Input placeholder="Search name, ID, dept…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
          </div>
          <Table>
            <THead>
              <TR>
                <TH>Emp ID</TH><TH>Name</TH><TH>Category</TH><TH>Shift</TH>
                <TH className="text-center">Days worked</TH><TH className="text-center">Saturdays</TH><TH className="text-center">OT hr</TH>
                <TH className="text-center">Inc-1</TH><TH className="text-center">Inc-2</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => {
                const sh = shiftById(r.e.shiftId);
                return (
                  <TR key={r.e.id}>
                    <TD className="font-mono text-xs text-muted-foreground">{r.e.id}</TD>
                    <TD className="font-medium">{r.e.name}</TD>
                    <TD><Badge tone="muted">{categoryById(r.e.category)?.label ?? r.e.category}</Badge></TD>
                    <TD><Badge tone="info" title={sh?.time}>{sh?.code} · {sh?.hours}h</Badge></TD>
                    <TD className="text-center">
                      <Input type="text" value={String(r.daysWorked)} onChange={(ev) => setAttendance(r.e.id, { daysWorked: num(ev.target.value) })} className="mx-auto h-7 w-14 text-center" />
                    </TD>
                    <TD className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Input type="text" value={String(r.saturdaysWorked)} onChange={(ev) => setAttendance(r.e.id, { saturdaysWorked: Math.min(r.totalSat, num(ev.target.value)) })} className="h-7 w-12 text-center" />
                        <span className="text-xs text-muted-foreground">/{r.totalSat}</span>
                      </div>
                    </TD>
                    <TD className="text-center">
                      <Input type="text" value={String(r.otHours)} onChange={(ev) => setAttendance(r.e.id, { otHours: num(ev.target.value) })} className="mx-auto h-7 w-12 text-center" />
                    </TD>
                    <TD className="text-center">
                      {r.inc.inc1Eligible ? <Badge tone="success">Full</Badge> : r.inc.inc1Amount > 0 ? <Badge tone="warning">{r.saturdaysWorked} Sat</Badge> : <span className="text-muted-foreground">—</span>}
                    </TD>
                    <TD className="text-center">
                      {r.inc.inc2Eligible ? <Badge tone="success">Yes</Badge> : <span className="text-muted-foreground">—</span>}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          {rows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No workers match.</p>}
          <p className="mt-3 text-xs text-muted-foreground">Tip: edits save instantly and recompute incentives + payroll. Use “Export” for the {CURRENT_MONTH_LABEL} muster in Excel.</p>
        </CardContent>
      </Card>
    </>
  );
}

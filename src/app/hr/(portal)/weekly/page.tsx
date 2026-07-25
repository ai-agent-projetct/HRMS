"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { downloadExcel } from "@/lib/excel";
import { WEEK_LABELS, CURRENT_WEEK_INDEX, categoryById } from "@/lib/hr-master";
import { useHr, attendanceFor, isWeeklyPaid } from "@/stores/hr";
import { formatINR } from "@/lib/utils";
import { CalendarRange, Users, Wallet, CalendarCheck, FileSpreadsheet, Send, Undo2, CheckCircle2, Clock } from "lucide-react";

export default function WeeklyWagesPage() {
  const [q, setQ] = useState("");
  const employees = useHr((s) => s.employees);
  const attendance = useHr((s) => s.attendance);
  const weeklyPaid = useHr((s) => s.weeklyPaid);
  const markWeeklyPaid = useHr((s) => s.markWeeklyPaid);
  const logPayslip = useHr((s) => s.logPayslip);
  const push = useToast((s) => s.push);

  // Weekly + daily workers are paid on a weekly cycle.
  const workers = employees.filter((e) => e.wageType === "Weekly" || e.wageType === "Daily");

  const rows = workers
    .filter((e) => `${e.name} ${e.id} ${e.department}`.toLowerCase().includes(q.toLowerCase()))
    .map((e) => {
      const a = attendanceFor(attendance, e.id);
      const weeks = a?.weekDaysWorked ?? [0, 0, 0, 0];
      const rate = e.salaryPerDay ?? 0;
      const weekPay = weeks.map((d) => d * rate);
      const thisWeekDays = weeks[CURRENT_WEEK_INDEX] ?? 0;
      const thisWeekPay = thisWeekDays * rate;
      const monthTotal = weekPay.reduce((s, p) => s + p, 0);
      const paid = isWeeklyPaid(weeklyPaid, e.id, CURRENT_WEEK_INDEX);
      return { e, weeks, rate, weekPay, thisWeekDays, thisWeekPay, monthTotal, paid };
    });

  const weeklyCount = workers.filter((e) => e.wageType === "Weekly").length;
  const thisWeekTotal = rows.reduce((s, r) => s + r.thisWeekPay, 0);
  const monthTotal = rows.reduce((s, r) => s + r.monthTotal, 0);
  const paidThisWeek = rows.filter((r) => r.paid).length;
  const pendingThisWeek = rows.filter((r) => !r.paid && r.thisWeekPay > 0).length;

  const payThisWeek = (name: string, id: string, pay: number) => {
    markWeeklyPaid(id, CURRENT_WEEK_INDEX, true);
    logPayslip({ empId: id, empName: name, channel: "WhatsApp", month: `${WEEK_LABELS[CURRENT_WEEK_INDEX]} 2026`, netPay: pay });
    push(`Weekly wage paid — ${name}`, `${formatINR(pay)} for ${WEEK_LABELS[CURRENT_WEEK_INDEX]}. Marked paid; slip sent on WhatsApp.`);
  };
  const markPending = (name: string, id: string) => {
    markWeeklyPaid(id, CURRENT_WEEK_INDEX, false);
    push(`Marked pending — ${name}`, `${WEEK_LABELS[CURRENT_WEEK_INDEX]} payment reversed to pending.`);
  };

  const exportWeekly = () =>
    downloadExcel({
      filename: "weekly-wages-jul2026", sheetName: "Weekly Wages", title: "Weekly Wages — July 2026",
      columns: [
        { header: "Emp ID", key: "id" }, { header: "Name", key: "name", width: 22 }, { header: "Category", key: "category" },
        { header: "Cycle", key: "cycle" }, { header: "Rate/Day ₹", key: "rate" },
        { header: "Wk1 ₹", key: "w1" }, { header: "Wk2 ₹", key: "w2" }, { header: "Wk3 ₹", key: "w3" }, { header: "Wk4 ₹", key: "w4" },
        { header: "Month Total ₹", key: "total" }, { header: `W${CURRENT_WEEK_INDEX + 1} Status`, key: "status" },
      ],
      rows: rows.map((r) => ({
        id: r.e.id, name: r.e.name, category: categoryById(r.e.category)?.label, cycle: r.e.wageType, rate: r.rate,
        w1: r.weekPay[0], w2: r.weekPay[1], w3: r.weekPay[2], w4: r.weekPay[3], total: r.monthTotal,
        status: r.paid ? "Paid" : r.thisWeekPay > 0 ? "Pending" : "—",
      })),
    });

  return (
    <>
      <PageHeader
        title="Weekly Wages"
        description="Weekly-cycle workers (casual & daily labour) paid every week on days-worked × rate. Current week is highlighted; pay and send the slip in one click."
        actions={<Button variant="outline" size="sm" onClick={exportWeekly}><FileSpreadsheet className="h-4 w-4" /> Export</Button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Weekly-paid workers" value={`${workers.length}`} icon={Users} sub={`${weeklyCount} weekly · ${workers.length - weeklyCount} daily`} />
        <KpiCard label="This week payout" value={formatINR(thisWeekTotal, true)} icon={Wallet} sub={WEEK_LABELS[CURRENT_WEEK_INDEX]} tone="success" />
        <KpiCard label="Month-to-date" value={formatINR(monthTotal, true)} icon={CalendarRange} sub="all weeks · July 2026" tone="info" />
        <KpiCard label={`This week (W${CURRENT_WEEK_INDEX + 1}) status`} value={`${paidThisWeek} paid`} icon={CalendarCheck} sub={`${pendingThisWeek} pending`} tone={pendingThisWeek ? "warning" : "success"} />
      </div>

      <Card>
        <CardContent className="py-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold">Weekly wage sheet — July 2026</p>
            <Input placeholder="Search name, ID, dept…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
          </div>
          <Table>
            <THead>
              <TR>
                <TH>Emp ID</TH><TH>Name</TH><TH>Rate/Day</TH>
                {WEEK_LABELS.map((w, i) => <TH key={w} className={`text-right ${i === CURRENT_WEEK_INDEX ? "text-primary" : ""}`}>W{i + 1}</TH>)}
                <TH className="text-right">Month</TH><TH>W{CURRENT_WEEK_INDEX + 1} status</TH><TH></TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.e.id}>
                  <TD className="font-mono text-xs text-muted-foreground">{r.e.id}</TD>
                  <TD className="font-medium">{r.e.name}<div className="text-xs font-normal text-muted-foreground">{categoryById(r.e.category)?.label} · <Badge tone={r.e.wageType === "Weekly" ? "warning" : "muted"}>{r.e.wageType}</Badge></div></TD>
                  <TD>{formatINR(r.rate)}</TD>
                  {r.weekPay.map((p, i) => (
                    <TD key={i} className={`text-right ${i === CURRENT_WEEK_INDEX ? "bg-primary/5 font-semibold text-primary" : ""}`}>
                      {p > 0 ? formatINR(p) : "—"}<div className="text-[10px] font-normal text-muted-foreground">{r.weeks[i]}d</div>
                    </TD>
                  ))}
                  <TD className="text-right font-bold">{formatINR(r.monthTotal)}</TD>
                  <TD>
                    {r.paid
                      ? <Badge tone="success"><CheckCircle2 className="h-3 w-3" /> Paid</Badge>
                      : r.thisWeekPay > 0
                        ? <Badge tone="warning"><Clock className="h-3 w-3" /> Pending</Badge>
                        : <span className="text-xs text-muted-foreground">—</span>}
                  </TD>
                  <TD>
                    {r.paid ? (
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => markPending(r.e.name, r.e.id)}>
                        <Undo2 className="h-3 w-3" /> Mark pending
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" disabled={r.thisWeekPay <= 0} onClick={() => payThisWeek(r.e.name, r.e.id, r.thisWeekPay)}>
                        <Send className="h-3 w-3" /> Pay W{CURRENT_WEEK_INDEX + 1}
                      </Button>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {rows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No weekly/daily workers match.</p>}
        </CardContent>
      </Card>
    </>
  );
}

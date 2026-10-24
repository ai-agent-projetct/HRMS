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
import { WEEK_LABELS, CURRENT_WEEK_INDEX, categoryById, categoryIdOf } from "@/lib/hr-master";
import { useHr, attendanceFor, onRollIn, isWeeklyPaid, availableMonths, monthLabel, CURRENT_MONTH } from "@/stores/hr";
import { formatINR } from "@/lib/utils";
import { CalendarRange, Users, Wallet, CalendarCheck, FileSpreadsheet, Send, Undo2, CheckCircle2, Clock } from "lucide-react";

const selCls = "h-8 rounded-md border border-input bg-card px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring";

export default function WeeklyWagesPage() {
  const [q, setQ] = useState("");
  const [deptF, setDeptF] = useState("All");
  const [unitF, setUnitF] = useState("All");
  const [scope, setScope] = useState<"casual" | "all">("casual");
  const [monthSel, setMonthSel] = useState(CURRENT_MONTH);
  const employees = useHr((s) => s.employees);
  const attendance = useHr((s) => s.attendance);
  const units = useHr((s) => s.units);
  const weeklyPaid = useHr((s) => s.weeklyPaid);
  const markWeeklyPaid = useHr((s) => s.markWeeklyPaid);
  const logPayslip = useHr((s) => s.logPayslip);
  const push = useToast((s) => s.push);
  const departments = [...new Set(employees.map((e) => e.department).filter((d) => d && d !== "—"))].sort();
  const mLabel = monthLabel(monthSel);

  // Weekly wages are for casual-category labour (casual gents / ladies); "All
  // workers" widens the sheet so any department can be cross-verified.
  const CASUAL_CATEGORIES = ["CASUAL_GENTS", "CASUAL_LADIES", "CASUAL"];
  const workers = employees.filter((e) => onRollIn(e, attendance, monthSel) && (scope === "all" || CASUAL_CATEGORIES.includes(categoryIdOf(e.category))));

  const rows = workers
    .filter((e) => deptF === "All" || e.department === deptF)
    .filter((e) => unitF === "All" || (e.unit ?? "") === unitF)
    .filter((e) => `${e.name} ${e.id} ${e.department}`.toLowerCase().includes(q.toLowerCase()))
    .map((e) => {
      const a = attendanceFor(attendance, e.id, monthSel);
      const weeks = a?.weekDaysWorked ?? [0, 0, 0, 0];
      const rate = a?.rate ?? e.salaryPerDay ?? 0;
      const weekPay = weeks.map((d) => d * rate);
      const thisWeekDays = weeks[CURRENT_WEEK_INDEX] ?? 0;
      const thisWeekPay = thisWeekDays * rate;
      const monthTotal = weekPay.reduce((s, p) => s + p, 0);
      const paid = isWeeklyPaid(weeklyPaid, e.id, CURRENT_WEEK_INDEX);
      return { e, weeks, rate, weekPay, thisWeekDays, thisWeekPay, monthTotal, paid };
    });

  const gents = workers.filter((e) => categoryIdOf(e.category) === "CASUAL_GENTS").length;
  const ladies = workers.filter((e) => categoryIdOf(e.category) === "CASUAL_LADIES").length;
  const thisWeekTotal = rows.reduce((s, r) => s + r.thisWeekPay, 0);
  const monthTotal = rows.reduce((s, r) => s + r.monthTotal, 0);
  const paidThisWeek = rows.filter((r) => r.paid).length;
  const pendingThisWeek = rows.filter((r) => !r.paid && r.thisWeekPay > 0).length;

  const payThisWeek = (name: string, id: string, pay: number) => {
    markWeeklyPaid(id, CURRENT_WEEK_INDEX, true);
    logPayslip({ empId: id, empName: name, channel: "WhatsApp", month: `${WEEK_LABELS[CURRENT_WEEK_INDEX]} 2026`, netPay: pay });
    push(`Weekly wage paid — ${name}`, `${formatINR(pay)} for ${WEEK_LABELS[CURRENT_WEEK_INDEX]}. Marked paid; slip logged.`);
  };
  const markPending = (name: string, id: string) => {
    markWeeklyPaid(id, CURRENT_WEEK_INDEX, false);
    push(`Marked pending — ${name}`, `${WEEK_LABELS[CURRENT_WEEK_INDEX]} payment reversed to pending.`);
  };

  const exportWeekly = () =>
    downloadExcel({
      filename: `weekly-wages-${monthSel}${deptF !== "All" ? `-${deptF}` : ""}`, sheetName: "Weekly Wages",
      title: `Weekly Wages — ${mLabel}${deptF !== "All" ? ` · ${deptF}` : ""}${unitF !== "All" ? ` · ${unitF}` : ""}`,
      columns: [
        { header: "Emp ID", key: "id" }, { header: "Name", key: "name", width: 22 }, { header: "Department", key: "dept" },
        { header: "Unit", key: "unit" }, { header: "Category", key: "category" },
        { header: "Cycle", key: "cycle" }, { header: "Rate/Day ₹", key: "rate" },
        { header: "Wk1 ₹", key: "w1" }, { header: "Wk2 ₹", key: "w2" }, { header: "Wk3 ₹", key: "w3" }, { header: "Wk4 ₹", key: "w4" },
        { header: "Month Total ₹", key: "total" }, { header: `W${CURRENT_WEEK_INDEX + 1} Status`, key: "status" },
      ],
      rows: rows.map((r) => ({
        id: r.e.id, name: r.e.name, dept: r.e.department, unit: r.e.unit ?? "", category: categoryById(r.e.category)?.label ?? r.e.category, cycle: r.e.wageType, rate: r.rate,
        w1: r.weekPay[0], w2: r.weekPay[1], w3: r.weekPay[2], w4: r.weekPay[3], total: r.monthTotal,
        status: r.paid ? "Paid" : r.thisWeekPay > 0 ? "Pending" : "—",
      })),
    });

  return (
    <>
      <PageHeader
        title="Weekly Wages"
        description="Casual labour (gents & ladies) paid every week on days-worked × rate. Current week is highlighted; pay and send the slip in one click."
        actions={<Button variant="outline" size="sm" onClick={exportWeekly}><FileSpreadsheet className="h-4 w-4" /> Export</Button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={scope === "casual" ? "Casual workers" : "Workers shown"} value={`${rows.length}`} icon={Users} sub={scope === "casual" ? `${gents} gents · ${ladies} ladies` : "all categories"} />
        <KpiCard label="This week payout" value={formatINR(thisWeekTotal, true)} icon={Wallet} sub={WEEK_LABELS[CURRENT_WEEK_INDEX]} tone="success" />
        <KpiCard label="Month total" value={formatINR(monthTotal, true)} icon={CalendarRange} sub={`all weeks · ${mLabel}`} tone="info" />
        <KpiCard label={`This week (W${CURRENT_WEEK_INDEX + 1}) status`} value={`${paidThisWeek} paid`} icon={CalendarCheck} sub={`${pendingThisWeek} pending`} tone={pendingThisWeek ? "warning" : "success"} />
      </div>

      <Card>
        <CardContent className="py-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="mr-1 text-sm font-bold">Weekly wage sheet — {mLabel}</p>
              <select value={monthSel} onChange={(e) => setMonthSel(e.target.value)} className={selCls} title="Month">
                {availableMonths(attendance).map((m) => <option key={m} value={m}>{monthLabel(m)}{m === CURRENT_MONTH ? " (current)" : ""}</option>)}
              </select>
              <select value={deptF} onChange={(e) => setDeptF(e.target.value)} className={selCls} title="Department">
                <option value="All">All departments</option>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={unitF} onChange={(e) => setUnitF(e.target.value)} className={selCls} title="Unit">
                <option value="All">All units</option>
                {units.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              <select value={scope} onChange={(e) => setScope(e.target.value as "casual" | "all")} className={selCls} title="Who to include">
                <option value="casual">Casual (weekly) only</option>
                <option value="all">All workers</option>
              </select>
            </div>
            <Input placeholder="Search name, ID, dept…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
          </div>
          <Table>
            <THead>
              <TR>
                <TH>Emp ID</TH><TH>Name</TH><TH>Dept</TH><TH>Unit</TH><TH>Rate/Day</TH>
                {WEEK_LABELS.map((w, i) => <TH key={w} className={`text-right ${i === CURRENT_WEEK_INDEX ? "text-primary" : ""}`}>W{i + 1}</TH>)}
                <TH className="text-right">Month</TH><TH>W{CURRENT_WEEK_INDEX + 1} status</TH><TH></TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.e.id}>
                  <TD className="font-mono text-xs text-muted-foreground">{r.e.id}</TD>
                  <TD className="font-medium">{r.e.name}<div className="text-xs font-normal text-muted-foreground">{categoryById(r.e.category)?.label ?? r.e.category} · <Badge tone={r.e.wageType === "Weekly" ? "warning" : "muted"}>{r.e.wageType}</Badge></div></TD>
                  <TD className="text-xs">{r.e.department}</TD>
                  <TD className="text-xs">{r.e.unit ?? "—"}</TD>
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
          {rows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">{scope === "casual" ? "No casual workers match — switch to “All workers” to see every department." : "No workers match."}</p>}
        </CardContent>
      </Card>
    </>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { downloadExcel } from "@/lib/excel";
import { monthSalary } from "@/lib/payroll";
import { allAgents, agentById, allCategories, categoryById, categoryIdOf } from "@/lib/hr-master";
import { useHr, deductionFor, availableMonths, monthLabel, CURRENT_MONTH } from "@/stores/hr";
import { formatINR } from "@/lib/utils";
import { ScrollText, Users, UserPlus, UserMinus, Wallet, FileSpreadsheet } from "lucide-react";

const selCls = "h-8 rounded-md border border-input bg-card px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring";
const MAX_ROWS = 600; // ponytail: render cap keeps the page snappy; Export always has every row
type View = "month" | "employee" | "group";
type GroupBy = "department" | "unit" | "category" | "agent";

export default function HistoryPage() {
  const employees = useHr((s) => s.employees);
  const attendance = useHr((s) => s.attendance);
  const deductions = useHr((s) => s.deductions);
  const units = useHr((s) => s.units);
  const months = availableMonths(attendance); // newest first
  const [from, setFrom] = useState(CURRENT_MONTH);
  const [to, setTo] = useState(CURRENT_MONTH);
  const [deptF, setDeptF] = useState("All");
  const [unitF, setUnitF] = useState("All");
  const [catF, setCatF] = useState("All");
  const [agentF, setAgentF] = useState("All");
  const [statusF, setStatusF] = useState<"All" | "Active" | "Left">("All");
  const [q, setQ] = useState("");
  const [view, setView] = useState<View>("month");
  const [groupBy, setGroupBy] = useState<GroupBy>("department");

  const lo = from <= to ? from : to;
  const hi = from <= to ? to : from;
  const inRange = (ym?: string) => !!ym && ym >= lo && ym <= hi;
  const departments = [...new Set(employees.map((e) => e.department).filter((d) => d && d !== "—"))].sort();
  const usedCats = new Set(employees.map((e) => categoryIdOf(e.category)));

  const people = employees
    .filter((e) => deptF === "All" || e.department === deptF)
    .filter((e) => unitF === "All" || (e.unit ?? "") === unitF)
    .filter((e) => catF === "All" || categoryIdOf(e.category) === catF)
    .filter((e) => agentF === "All" || (agentF === "DIRECT" ? !e.agentId : e.agentId === agentF))
    .filter((e) => statusF === "All" || (statusF === "Left" ? e.status === "Exited" : e.status !== "Exited"))
    .filter((e) => `${e.name} ${e.id} ${e.department} ${e.tokenNo ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  const byId = new Map(people.map((e) => [e.id, e]));

  // One row per worker × month in range, priced on that month's rate.
  const monthRows = attendance
    .filter((a) => byId.has(a.empId) && inRange(a.month))
    .map((a) => {
      const e = byId.get(a.empId)!;
      return { e, month: a.month, ...monthSalary(e, a, deductionFor(deductions, e.id, a.month)) };
    })
    .sort((x, y) => y.month.localeCompare(x.month) || x.e.id.localeCompare(y.e.id));

  const leaveLeft = (e: (typeof people)[number]) => (e.leave?.el ?? 0) + (e.leave?.cl ?? 0) + (e.leave?.sl ?? 0);
  const agentName = (id?: string) => agentById(id)?.name ?? "Direct";

  type Tot = { months: number; days: number; ot: number; otAmt: number; incentive: number; gross: number; ded: number; net: number };
  const zero = (): Tot => ({ months: 0, days: 0, ot: 0, otAmt: 0, incentive: 0, gross: 0, ded: 0, net: 0 });
  const add = (t: Tot, r: (typeof monthRows)[number]) => {
    t.months++; t.days += r.days; t.ot += r.ot; t.otAmt += r.otAmt; t.incentive += r.incentive; t.gross += r.gross; t.ded += r.ded; t.net += r.net;
  };

  const empTotals = [...monthRows.reduce((m, r) => {
    const t = m.get(r.e.id) ?? { e: r.e, ...zero() };
    add(t, r); m.set(r.e.id, t); return m;
  }, new Map<string, { e: (typeof people)[number] } & Tot>()).values()].sort((a, b) => a.e.id.localeCompare(b.e.id));

  const groupKey = (e: (typeof people)[number]) =>
    groupBy === "department" ? e.department || "—"
      : groupBy === "unit" ? e.unit || "—"
      : groupBy === "category" ? categoryById(e.category)?.label ?? e.category
      : agentName(e.agentId);
  const groupTotals = [...monthRows.reduce((m, r) => {
    const k = groupKey(r.e);
    const t = m.get(k) ?? { key: k, people: new Set<string>(), ...zero() };
    add(t, r); t.people.add(r.e.id); m.set(k, t); return m;
  }, new Map<string, { key: string; people: Set<string> } & Tot>()).values()].sort((a, b) => b.net - a.net);

  const grand = monthRows.reduce((t, r) => { add(t, r); return t; }, zero());
  const joined = people.filter((e) => inRange(e.doj?.slice(0, 7))).length;
  const left = people.filter((e) => e.status === "Exited" && inRange(e.exit?.lastWorkingDay?.slice(0, 7))).length;
  const rangeLabel = lo === hi ? monthLabel(lo) : `${monthLabel(lo)} – ${monthLabel(hi)}`;

  const exportHistory = () => {
    const base = `employee-history-${lo}${lo !== hi ? `_to_${hi}` : ""}`;
    if (view === "group") {
      return downloadExcel({
        filename: `${base}-by-${groupBy}`, sheetName: "By " + groupBy, title: `Employee History by ${groupBy} — ${rangeLabel}`,
        columns: [
          { header: groupBy[0].toUpperCase() + groupBy.slice(1), key: "key", width: 20 }, { header: "People", key: "people" },
          { header: "Days worked", key: "days" }, { header: "OT hr", key: "ot" }, { header: "OT ₹", key: "otAmt" },
          { header: "Incentive ₹", key: "incentive" }, { header: "Gross ₹", key: "gross" }, { header: "Deductions ₹", key: "ded" }, { header: "Net ₹", key: "net" },
        ],
        rows: groupTotals.map((g) => ({ ...g, people: g.people.size })),
      });
    }
    if (view === "employee") {
      return downloadExcel({
        filename: `${base}-per-employee`, sheetName: "Per employee", title: `Employee History (totals) — ${rangeLabel}`,
        columns: [
          { header: "Emp ID", key: "id" }, { header: "Name", key: "name", width: 22 }, { header: "Department", key: "dept" },
          { header: "Unit", key: "unit" }, { header: "Category", key: "cat", width: 16 }, { header: "Agent", key: "agent" },
          { header: "Joined", key: "doj" }, { header: "Status", key: "status" }, { header: "Months", key: "months" },
          { header: "Days worked", key: "days" }, { header: "OT hr", key: "ot" }, { header: "OT ₹", key: "otAmt" },
          { header: "Incentive ₹", key: "incentive" }, { header: "Gross ₹", key: "gross" }, { header: "Deductions ₹", key: "ded" },
          { header: "Net ₹", key: "net" }, { header: "Leave left", key: "leave" },
        ],
        rows: empTotals.map((t) => ({
          id: t.e.id, name: t.e.name, dept: t.e.department, unit: t.e.unit ?? "", cat: categoryById(t.e.category)?.label ?? t.e.category,
          agent: agentName(t.e.agentId), doj: t.e.doj, status: t.e.status === "Exited" ? "Left" : "Active",
          months: t.months, days: t.days, ot: t.ot, otAmt: t.otAmt, incentive: t.incentive, gross: t.gross, ded: t.ded, net: t.net, leave: leaveLeft(t.e),
        })),
      });
    }
    return downloadExcel({
      filename: `${base}-monthly`, sheetName: "Monthly", title: `Employee History (month-wise) — ${rangeLabel}`,
      columns: [
        { header: "Month", key: "month" }, { header: "Emp ID", key: "id" }, { header: "Name", key: "name", width: 22 },
        { header: "Department", key: "dept" }, { header: "Unit", key: "unit" }, { header: "Category", key: "cat", width: 16 },
        { header: "Agent", key: "agent" }, { header: "Days worked", key: "days" }, { header: "Rate ₹/day", key: "rate" },
        { header: "Wages ₹", key: "wages" }, { header: "OT hr", key: "ot" }, { header: "OT ₹", key: "otAmt" },
        { header: "Incentive ₹", key: "incentive" }, { header: "Gross ₹", key: "gross" }, { header: "Deductions ₹", key: "ded" },
        { header: "Net ₹", key: "net" }, { header: "Leave left", key: "leave" }, { header: "Status", key: "status" },
        { header: "Source", key: "source", width: 22 },
      ],
      rows: monthRows.map((r) => ({
        month: monthLabel(r.month), id: r.e.id, name: r.e.name, dept: r.e.department, unit: r.e.unit ?? "",
        cat: categoryById(r.e.category)?.label ?? r.e.category, agent: agentName(r.e.agentId), days: r.days, rate: r.rate,
        wages: r.wages, ot: r.ot, otAmt: r.otAmt, incentive: r.incentive, gross: r.gross, ded: r.ded, net: r.net,
        leave: leaveLeft(r.e), status: r.e.status === "Exited" ? "Left" : "Active",
        source: r.source === "register" ? "Salary register (as paid)" : "Computed",
      })),
    });
  };

  const money = (n: number) => (n ? formatINR(n) : "—");

  return (
    <>
      <PageHeader
        title="Employee History"
        description="Month-wise days, salary, OT, incentives and leave for any worker or group — filter by department, unit, category, agent and date range, then export to Excel."
        actions={<Button variant="outline" size="sm" onClick={exportHistory}><FileSpreadsheet className="h-4 w-4" /> Export Excel</Button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Employees" value={`${people.length}`} icon={Users} sub={`${empTotals.length} with records in range`} />
        <KpiCard label="Joined (in)" value={`${joined}`} icon={UserPlus} sub={rangeLabel} tone="success" />
        <KpiCard label="Left (out)" value={`${left}`} icon={UserMinus} sub={rangeLabel} tone="danger" />
        <KpiCard label="Net paid" value={formatINR(grand.net, true)} icon={Wallet} sub={`${grand.days} days · OT ${formatINR(grand.otAmt, true)}`} tone="info" />
      </div>

      <Card>
        <CardContent className="py-3">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-muted-foreground">From</span>
            <select value={from} onChange={(e) => setFrom(e.target.value)} className={selCls}>
              {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
            <span className="text-[11px] font-semibold text-muted-foreground">to</span>
            <select value={to} onChange={(e) => setTo(e.target.value)} className={selCls}>
              {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
            <Button variant="ghost" size="sm" className="h-8 px-2 text-[11px]" onClick={() => { setFrom(months[months.length - 1] ?? CURRENT_MONTH); setTo(months[0] ?? CURRENT_MONTH); }}>All months</Button>
            <span className="mx-1 h-5 w-px bg-border" />
            <select value={deptF} onChange={(e) => setDeptF(e.target.value)} className={selCls} title="Department">
              <option value="All">All departments</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={unitF} onChange={(e) => setUnitF(e.target.value)} className={selCls} title="Unit">
              <option value="All">All units</option>
              {units.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <select value={catF} onChange={(e) => setCatF(e.target.value)} className={selCls} title="Category">
              <option value="All">All categories</option>
              {allCategories().map((c) => <option key={c.id} value={c.id}>{c.label}{usedCats.has(c.id) ? "" : " (0)"}</option>)}
            </select>
            <select value={agentF} onChange={(e) => setAgentF(e.target.value)} className={selCls} title="Agent">
              <option value="All">All agents</option>
              <option value="DIRECT">Direct hire</option>
              {allAgents().map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <select value={statusF} onChange={(e) => setStatusF(e.target.value as typeof statusF)} className={selCls} title="Status">
              <option value="All">Active + left</option>
              <option value="Active">Active</option>
              <option value="Left">Left</option>
            </select>
            <Input placeholder="Search name / Emp ID…" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 w-48 text-xs" />
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-1.5 border-t pt-2.5">
            <span className="mr-1 text-[11px] font-semibold text-muted-foreground">View</span>
            {([["month", "Month-wise"], ["employee", "Per employee (totals)"], ["group", "Group totals"]] as const).map(([v, l]) => (
              <Button key={v} size="sm" variant={view === v ? "default" : "outline"} className="h-7 px-2.5 text-[11px]" onClick={() => setView(v)}>{l}</Button>
            ))}
            {view === "group" && (
              <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)} className={`${selCls} ml-1`}>
                <option value="department">by Department</option>
                <option value="unit">by Unit</option>
                <option value="category">by Category</option>
                <option value="agent">by Agent</option>
              </select>
            )}
            <span className="ml-auto text-[11px] text-muted-foreground">{rangeLabel}</span>
          </div>

          {view === "month" && (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH>Month</TH><TH>Emp ID</TH><TH>Name</TH><TH>Dept</TH><TH>Unit</TH><TH>Category</TH><TH>Agent</TH>
                    <TH className="text-right">Days</TH><TH className="text-right">Rate</TH><TH className="text-right">OT hr</TH><TH className="text-right">OT ₹</TH>
                    <TH className="text-right">Incentive</TH><TH className="text-right">Gross</TH><TH className="text-right">Deduct.</TH><TH className="text-right">Net</TH><TH className="text-right">Leave left</TH>
                  </TR>
                </THead>
                <TBody>
                  {monthRows.slice(0, MAX_ROWS).map((r) => (
                    <TR key={`${r.e.id}-${r.month}`}>
                      <TD className="text-xs">{monthLabel(r.month)}</TD>
                      <TD className="font-mono text-xs text-muted-foreground">{r.e.id}</TD>
                      <TD className="font-medium"><Link href={`/hr/employee/${r.e.id}`} className="hover:text-primary hover:underline">{r.e.name}</Link>{r.e.status === "Exited" && <Badge tone="danger" className="ml-1.5">Left</Badge>}</TD>
                      <TD className="text-xs">{r.e.department}</TD>
                      <TD className="text-xs">{r.e.unit ?? "—"}</TD>
                      <TD><Badge tone="muted">{categoryById(r.e.category)?.label ?? r.e.category}</Badge></TD>
                      <TD className="text-xs">{agentName(r.e.agentId)}</TD>
                      <TD className="text-right">{r.days}</TD>
                      <TD className="text-right text-xs">{formatINR(r.rate)}</TD>
                      <TD className="text-right">{r.ot || "—"}</TD>
                      <TD className="text-right">{money(r.otAmt)}</TD>
                      <TD className="text-right">{money(r.incentive)}</TD>
                      <TD className="text-right">{formatINR(r.gross)}</TD>
                      <TD className="text-right text-danger">{money(r.ded)}</TD>
                      <TD className="text-right font-semibold text-success" title={r.source === "register" ? "As paid in the salary register" : "Computed by the wage engine"}>{formatINR(r.net)}{r.source === "register" && <span className="ml-1 text-[9px] text-muted-foreground">reg</span>}</TD>
                      <TD className="text-right">{leaveLeft(r.e)}</TD>
                    </TR>
                  ))}
                  {monthRows.length > 0 && (
                    <TR>
                      <TD className="font-bold" colSpan={7}>TOTAL — {monthRows.length} month-rows</TD>
                      <TD className="text-right font-bold">{grand.days}</TD><TD />
                      <TD className="text-right font-bold">{grand.ot}</TD>
                      <TD className="text-right font-bold">{formatINR(grand.otAmt)}</TD>
                      <TD className="text-right font-bold">{formatINR(grand.incentive)}</TD>
                      <TD className="text-right font-bold">{formatINR(grand.gross)}</TD>
                      <TD className="text-right font-bold text-danger">{formatINR(grand.ded)}</TD>
                      <TD className="text-right font-bold text-success">{formatINR(grand.net)}</TD><TD />
                    </TR>
                  )}
                </TBody>
              </Table>
              {monthRows.length > MAX_ROWS && <p className="mt-2 text-[11px] text-warning">Showing first {MAX_ROWS} of {monthRows.length} rows (totals include all). Narrow the filters, or Export Excel for every row.</p>}
            </>
          )}

          {view === "employee" && (
            <Table>
              <THead>
                <TR>
                  <TH>Emp ID</TH><TH>Name</TH><TH>Dept</TH><TH>Unit</TH><TH>Category</TH><TH>Agent</TH><TH>Joined</TH>
                  <TH className="text-right">Months</TH><TH className="text-right">Days</TH><TH className="text-right">OT hr</TH><TH className="text-right">OT ₹</TH>
                  <TH className="text-right">Incentive</TH><TH className="text-right">Gross</TH><TH className="text-right">Net</TH><TH className="text-right">Leave left</TH>
                </TR>
              </THead>
              <TBody>
                {empTotals.slice(0, MAX_ROWS).map((t) => (
                  <TR key={t.e.id}>
                    <TD className="font-mono text-xs text-muted-foreground">{t.e.id}</TD>
                    <TD className="font-medium"><Link href={`/hr/employee/${t.e.id}`} className="hover:text-primary hover:underline">{t.e.name}</Link>{t.e.status === "Exited" && <Badge tone="danger" className="ml-1.5">Left</Badge>}</TD>
                    <TD className="text-xs">{t.e.department}</TD>
                    <TD className="text-xs">{t.e.unit ?? "—"}</TD>
                    <TD><Badge tone="muted">{categoryById(t.e.category)?.label ?? t.e.category}</Badge></TD>
                    <TD className="text-xs">{agentName(t.e.agentId)}</TD>
                    <TD className="text-xs">{t.e.doj || "—"}</TD>
                    <TD className="text-right">{t.months}</TD>
                    <TD className="text-right">{t.days}</TD>
                    <TD className="text-right">{t.ot || "—"}</TD>
                    <TD className="text-right">{money(t.otAmt)}</TD>
                    <TD className="text-right">{money(t.incentive)}</TD>
                    <TD className="text-right">{formatINR(t.gross)}</TD>
                    <TD className="text-right font-semibold text-success">{formatINR(t.net)}</TD>
                    <TD className="text-right">{leaveLeft(t.e)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}

          {view === "group" && (
            <Table>
              <THead>
                <TR>
                  <TH className="capitalize">{groupBy}</TH><TH className="text-right">People</TH><TH className="text-right">Days</TH>
                  <TH className="text-right">OT hr</TH><TH className="text-right">OT ₹</TH><TH className="text-right">Incentive</TH>
                  <TH className="text-right">Gross</TH><TH className="text-right">Deduct.</TH><TH className="text-right">Net</TH>
                </TR>
              </THead>
              <TBody>
                {groupTotals.map((g) => (
                  <TR key={g.key}>
                    <TD className="font-medium">{g.key}</TD>
                    <TD className="text-right">{g.people.size}</TD>
                    <TD className="text-right">{g.days}</TD>
                    <TD className="text-right">{g.ot || "—"}</TD>
                    <TD className="text-right">{money(g.otAmt)}</TD>
                    <TD className="text-right">{money(g.incentive)}</TD>
                    <TD className="text-right">{formatINR(g.gross)}</TD>
                    <TD className="text-right text-danger">{money(g.ded)}</TD>
                    <TD className="text-right font-semibold text-success">{formatINR(g.net)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}

          {monthRows.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground"><ScrollText className="mx-auto mb-2 h-6 w-6" />No attendance records for these filters in {rangeLabel}. Widen the date range (try “All months”).</p>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">Salary per month is recomputed on the mill wage engine with that month&apos;s rate (wages + OT + incentive − ESI/welfare/mess/others). Leave left = current EL + CL + SL balance.</p>
        </CardContent>
      </Card>
    </>
  );
}

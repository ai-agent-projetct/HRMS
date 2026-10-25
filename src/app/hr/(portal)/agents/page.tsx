"use client";

import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useState } from "react";
import { downloadExcel, downloadExcelWorkbook } from "@/lib/excel";
import { DetailSheet } from "@/components/detail-sheet";
import {
  allAgents, agentById, agentRatePerDay, categoryById, commissionEligible, CONDUCT_STATUSES, type ConductStatus,
} from "@/lib/hr-master";
import { useHr, attendanceFor, onRollIn, useCanEdit, availableMonths, monthLabel, CURRENT_MONTH } from "@/stores/hr";
import type { HrEmployee } from "@/lib/hr-data";
import { formatINR } from "@/lib/utils";
import { wageSchemeFor } from "@/lib/payroll";
import { Handshake, Users, Coins, UserX, FileSpreadsheet, Layers, UserPlus, X, Plus } from "lucide-react";

const selCls = "h-8 rounded-md border border-input bg-card px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring";

export default function AgentsPage() {
  const employees = useHr((s) => s.employees);
  const attendance = useHr((s) => s.attendance);
  const setConduct = useHr((s) => s.setConduct);
  const addAgent = useHr((s) => s.addAgent);
  const updateAgent = useHr((s) => s.updateAgent);
  const updateEmployee = useHr((s) => s.updateEmployee);
  useHr((s) => s.customAgents); // re-render when agents change (allAgents reads the registry)
  const mayEdit = useCanEdit();
  const push = useToast((s) => s.push);
  const [detail, setDetail] = useState<HrEmployee | null>(null);
  const [monthSel, setMonthSel] = useState(CURRENT_MONTH);
  const [newAgent, setNewAgent] = useState({ name: "", place: "", phone: "", rate: "10" });
  const [pick, setPick] = useState<Record<string, string>>({}); // agentId -> typed worker
  const mLabel = monthLabel(monthSel);

  // Agent for the selected month: a register-paid month records it (AG column),
  // otherwise the worker's current agent.
  const agentInMonth = (e: HrEmployee) => {
    const p = attendanceFor(attendance, e.id, monthSel)?.paid;
    return p ? (p.agentId ?? undefined) : e.agentId;
  };
  // That month's roster: on-roll workers, plus anyone who left but worked that month.
  const roster = employees.filter((e) => onRollIn(e, attendance, monthSel));
  const supplied = roster.filter((e) => agentInMonth(e));

  // Commission per worker for the month = days worked × agent's ₹/day, paid
  // only while conduct is "Proper" (mill register: AGENT = ₹10/day). A month
  // paid from the salary register shows exactly what it deducted — the hostel
  // register never deducts an agent cut, so hostel girls carry none.
  const rowFor = (e: HrEmployee) => {
    const agent = agentById(agentInMonth(e));
    const a = attendanceFor(attendance, e.id, monthSel);
    const days = a?.daysWorked ?? 0;
    const rate = agentRatePerDay(agent);
    if (a?.paid) return { e, agent, days, rate, eligible: a.paid.agent > 0, amount: a.paid.agent, fromRegister: true };
    const scheme = wageSchemeFor(e.category);
    const eligible = commissionEligible(e.conduct) && scheme === "odisha";
    return { e, agent, days, rate, eligible, amount: eligible ? days * rate : 0, fromRegister: false };
  };

  const perAgent = allAgents().map((ag) => {
    const workers = supplied.filter((e) => agentInMonth(e) === ag.id).map(rowFor);
    const payable = workers.reduce((s, r) => s + r.amount, 0);
    const eligibleCount = workers.filter((r) => r.eligible).length;
    const days = workers.reduce((s, r) => s + r.days, 0);
    return { ag, workers, payable, eligibleCount, days };
  });

  const totalCommission = perAgent.reduce((s, p) => s + p.payable, 0);
  const ineligible = supplied.filter((e) => !commissionEligible(e.conduct)).length;

  const submitAgent = () => {
    const r = addAgent({ name: newAgent.name, place: newAgent.place, phone: newAgent.phone, commissionPerWorker: Number(newAgent.rate) || 0 });
    if (!r.ok) { push("Could not add agent", r.error); return; }
    push(`Agent added — ${newAgent.name.trim()}`, "Now assign workers to them below.");
    setNewAgent({ name: "", place: "", phone: "", rate: "10" });
  };

  const assign = (agentId: string) => {
    const typed = (pick[agentId] ?? "").trim();
    const id = typed.split(/\s|·/)[0];
    const emp = employees.find((e) => e.id.toLowerCase() === id.toLowerCase());
    if (!emp) { push("Worker not found", "Pick a worker from the list (Emp ID · Name)."); return; }
    const prev = agentById(emp.agentId);
    updateEmployee(emp.id, { agentId });
    push(`${emp.name} → ${agentById(agentId)?.name}`, prev && prev.id !== agentId ? `Moved from ${prev.name}.` : "Assigned.");
    setPick((p) => ({ ...p, [agentId]: "" }));
  };

  const unassign = (e: HrEmployee) => {
    updateEmployee(e.id, { agentId: undefined });
    push(`${e.name} removed from agent`, "Now a direct hire.");
  };

  const exportCommission = () =>
    downloadExcel({
      filename: `agent-commission-${monthSel}`, sheetName: "Commission", title: `Agent Commission — ${mLabel}`,
      columns: [
        { header: "Agent", key: "agent", width: 22 }, { header: "Emp ID", key: "id" }, { header: "Worker", key: "name", width: 22 },
        { header: "Department", key: "dept" }, { header: "Unit", key: "unit" }, { header: "Category", key: "category" },
        { header: "Days worked", key: "days" }, { header: "Rate ₹/day", key: "rate" }, { header: "Conduct", key: "conduct" },
        { header: "Eligible", key: "eligibleYN" }, { header: "Commission ₹", key: "amount" },
      ],
      rows: perAgent.flatMap((p) => p.workers.map((r) => ({
        agent: p.ag.name, id: r.e.id, name: r.e.name, dept: r.e.department, unit: r.e.unit ?? "",
        category: categoryById(r.e.category)?.label ?? r.e.category, days: r.days, rate: r.rate,
        conduct: r.e.conduct, eligibleYN: r.eligible ? "Yes" : "No", amount: r.amount,
      }))),
    });

  /** Agent master, every supplied worker, the commission bill and the workers
   *  whose conduct has stopped the payout — one workbook for the agent settlement. */
  const bulkExport = () =>
    downloadExcelWorkbook({
      filename: `agent-commission-bulk-${monthSel}`,
      sheets: [
        {
          sheetName: "Commission Bill", title: `Agent Commission Bill — ${mLabel}`,
          columns: [
            { header: "Agent", key: "agent", width: 22 }, { header: "Place", key: "place", width: 16 },
            { header: "Phone", key: "phone", width: 14 }, { header: "Rate ₹/day", key: "rate" },
            { header: "Workers", key: "workers" }, { header: "Eligible", key: "eligible" },
            { header: "Stopped", key: "stopped" }, { header: "Days worked", key: "days" }, { header: "Payable ₹", key: "payable" },
          ],
          rows: perAgent.map((p) => ({
            agent: p.ag.name, place: p.ag.place, phone: p.ag.phone, rate: agentRatePerDay(p.ag),
            workers: p.workers.length, eligible: p.eligibleCount, stopped: p.workers.length - p.eligibleCount, days: p.days, payable: p.payable,
          })),
        },
        {
          sheetName: "All Workers", title: `Agent-Supplied Workers — ${mLabel}`,
          columns: [
            { header: "Agent", key: "agent", width: 22 }, { header: "Emp ID", key: "id" }, { header: "Worker", key: "name", width: 22 },
            { header: "Category", key: "category", width: 16 }, { header: "Unit", key: "unit" }, { header: "Department", key: "dept", width: 16 },
            { header: "Days Worked", key: "days" }, { header: "Rate ₹/day", key: "rate" }, { header: "Conduct", key: "conduct" },
            { header: "Eligible", key: "eligibleYN" }, { header: "Commission ₹", key: "amount" },
          ],
          rows: perAgent.flatMap((p) => p.workers.map((r) => ({
            agent: p.ag.name, id: r.e.id, name: r.e.name, category: categoryById(r.e.category)?.label ?? r.e.category,
            unit: r.e.unit ?? "", dept: r.e.department, days: r.days, rate: r.rate, conduct: r.e.conduct,
            eligibleYN: r.eligible ? "Yes" : "No", amount: r.amount,
          }))),
        },
        {
          sheetName: "Stopped", title: `Commission Stopped — conduct not proper — ${mLabel}`,
          columns: [
            { header: "Agent", key: "agent", width: 22 }, { header: "Emp ID", key: "id" }, { header: "Worker", key: "name", width: 22 },
            { header: "Conduct", key: "conduct" }, { header: "Days Worked", key: "days" }, { header: "Commission Withheld ₹", key: "withheld" },
          ],
          rows: perAgent.flatMap((p) => p.workers.filter((r) => !r.eligible).map((r) => ({
            agent: p.ag.name, id: r.e.id, name: r.e.name, conduct: r.e.conduct, days: r.days, withheld: r.days * r.rate,
          }))),
        },
      ],
    });

  return (
    <>
      <PageHeader
        title="Agents & Commission"
        description="Workers supplied by labour agents earn the agent a commission per day worked — only while the worker attends properly. Add agents, assign their workers and see each person's amount here."
        actions={
          <>
            <select value={monthSel} onChange={(e) => setMonthSel(e.target.value)} className={selCls} title="Month">
              {availableMonths(attendance).map((m) => <option key={m} value={m}>{monthLabel(m)}{m === CURRENT_MONTH ? " (current)" : ""}</option>)}
            </select>
            <Button variant="outline" size="sm" onClick={bulkExport}><Layers className="h-4 w-4" /> Bulk export</Button>
            <Button variant="outline" size="sm" onClick={exportCommission}><FileSpreadsheet className="h-4 w-4" /> Export commission</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Commission payable" value={formatINR(totalCommission, true)} icon={Coins} sub={mLabel} tone="success" />
        <KpiCard label="Agents" value={`${allAgents().length}`} icon={Handshake} sub="active contractors" />
        <KpiCard label="Workers via agents" value={`${supplied.length}`} icon={Users} sub={`${roster.length - supplied.length} direct hires`} tone="info" />
        <KpiCard label="Not eligible" value={`${ineligible}`} icon={UserX} sub="absconded / long leave / absent" tone="danger" />
      </div>

      {/* Add agent */}
      {mayEdit && (
        <Card>
          <CardContent className="py-3">
            <p className="mb-2 flex items-center gap-2 text-xs font-bold"><UserPlus className="h-4 w-4 text-primary" /> Add agent</p>
            <div className="flex flex-wrap items-end gap-2">
              <Input placeholder="Agent name *" value={newAgent.name} onChange={(e) => setNewAgent((s) => ({ ...s, name: e.target.value }))} className="w-48" />
              <Input placeholder="Place" value={newAgent.place} onChange={(e) => setNewAgent((s) => ({ ...s, place: e.target.value }))} className="w-40" />
              <Input placeholder="Phone" value={newAgent.phone} onChange={(e) => setNewAgent((s) => ({ ...s, phone: e.target.value }))} className="w-36" />
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">₹</span>
                <Input placeholder="10" value={newAgent.rate} onChange={(e) => setNewAgent((s) => ({ ...s, rate: e.target.value }))} className="w-16 text-center" />
                <span className="text-xs text-muted-foreground">/ day</span>
              </div>
              <Button size="sm" onClick={submitAgent} disabled={!newAgent.name.trim()}><Plus className="h-4 w-4" /> Add agent</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <datalist id="agent-worker-options">
        {employees.filter((e) => e.status !== "Exited").map((e) => <option key={e.id} value={`${e.id} · ${e.name}`}>{e.department} · {agentById(e.agentId)?.name ?? "Direct"}</option>)}
      </datalist>

      {/* Per-agent cards */}
      <div className="grid gap-4 xl:grid-cols-2">
        {perAgent.map((p) => (
          <Card key={p.ag.id}>
            <CardHeader className="flex-row items-start justify-between">
              <div>
                <CardTitle>{p.ag.name}</CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-1.5">
                  {p.ag.place || "—"} · {p.ag.phone || "—"} ·
                  {mayEdit ? (
                    <span className="inline-flex items-center gap-1">
                      ₹<Input
                        key={`${p.ag.id}-${agentRatePerDay(p.ag)}`}
                        defaultValue={String(agentRatePerDay(p.ag))}
                        onBlur={(ev) => {
                          const v = Number(ev.target.value);
                          if (v > 0 && v !== agentRatePerDay(p.ag)) { updateAgent(p.ag.id, { commissionPerWorker: v }); push(`${p.ag.name} rate → ₹${v}/day`, "Commission recalculated."); }
                        }}
                        className="h-6 w-14 px-1 text-center text-xs"
                      />/day
                    </span>
                  ) : <span>{formatINR(agentRatePerDay(p.ag))}/day</span>}
                </CardDescription>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-success">{formatINR(p.payable)}</p>
                <p className="text-[11px] text-muted-foreground">{p.eligibleCount}/{p.workers.length} eligible · {p.days} days</p>
              </div>
            </CardHeader>
            <CardContent>
              {mayEdit && (
                <div className="mb-3 flex gap-2">
                  <Input
                    list="agent-worker-options"
                    placeholder="Add worker — type Emp ID or name"
                    value={pick[p.ag.id] ?? ""}
                    onChange={(e) => setPick((s) => ({ ...s, [p.ag.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") assign(p.ag.id); }}
                    className="h-8 flex-1 text-xs"
                  />
                  <Button size="sm" variant="outline" className="h-8" onClick={() => assign(p.ag.id)}><UserPlus className="h-3.5 w-3.5" /> Add</Button>
                </div>
              )}
              {p.workers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No workers under this agent yet.</p>
              ) : (
                <div className="max-h-[420px] overflow-y-auto">
                  <Table>
                    <THead><TR><TH>Emp ID</TH><TH>Worker</TH><TH>Dept</TH><TH className="text-center">Days</TH><TH>Conduct</TH><TH className="text-right">Amount</TH><TH></TH></TR></THead>
                    <TBody>
                      {p.workers.map((r) => (
                        <TR key={r.e.id}>
                          <TD className="font-mono text-xs text-muted-foreground">{r.e.id}</TD>
                          <TD className="font-medium"><button className="text-left hover:text-primary hover:underline" onClick={() => setDetail(r.e)}>{r.e.name}</button><div className="text-[10px] font-normal text-muted-foreground">{r.e.unit ?? "—"} · {categoryById(r.e.category)?.label ?? r.e.category}</div></TD>
                          <TD className="text-xs">{r.e.department}</TD>
                          <TD className="text-center">{r.days}</TD>
                          <TD>
                            <select
                              value={r.e.conduct}
                              disabled={!mayEdit}
                              onChange={(ev) => { setConduct(r.e.id, ev.target.value as ConductStatus); push(`${r.e.name} → ${ev.target.value}`, commissionEligible(ev.target.value as ConductStatus) ? "Agent commission enabled." : "Agent commission stopped."); }}
                              className="h-7 rounded-md border border-input bg-card px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              {CONDUCT_STATUSES.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </TD>
                          <TD className="text-right">
                            {r.eligible
                              ? <span className="font-semibold text-success" title={r.fromRegister ? "As deducted in the salary register" : `${r.days} days × ₹${r.rate}`}>{formatINR(r.amount)}</span>
                              : r.e.conduct !== "Proper"
                                ? <Badge tone="danger">Stopped</Badge>
                                : <span className="text-xs text-muted-foreground" title="This worker's register does not deduct an agent cut (e.g. hostel girls)">—</span>}
                          </TD>
                          <TD>{mayEdit && <Button size="icon" variant="ghost" className="h-6 w-6" title="Remove from this agent" onClick={() => unassign(r.e)}><X className="h-3.5 w-3.5" /></Button>}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {detail && (() => {
        const r = rowFor(detail);
        const a = attendanceFor(attendance, detail.id, monthSel);
        return (
          <DetailSheet
            title={`${detail.name} — Agent & Commission`}
            subtitle={`${detail.id} · ${categoryById(detail.category)?.label ?? detail.category} · ${mLabel}`}
            badges={[
              { label: r.eligible ? "Commission: Payable" : "Commission: Stopped", tone: r.eligible ? "success" : "danger" },
              { label: `Conduct: ${detail.conduct}`, tone: detail.conduct === "Proper" ? "success" : "warning" },
            ]}
            onClose={() => setDetail(null)}
            sections={[
              { heading: "Supplying agent", rows: [
                ["Agent", r.agent?.name ?? "—"],
                ["Place", r.agent?.place || "—"],
                ["Phone", r.agent?.phone || "—"],
                ["Commission rate", `${formatINR(r.rate)} / day worked`],
              ] },
              { heading: "Worker & attendance", stats: [
                { label: "Days worked", value: `${r.days}` },
                { label: "OT hours", value: `${a?.otHours ?? 0}` },
                { label: "Conduct", value: detail.conduct, tone: detail.conduct === "Proper" ? "success" : "danger" },
                { label: "Dept", value: detail.department },
              ] },
              { heading: "Commission decision", rows: [
                ["Rule", "Days worked × agent rate, paid only while conduct is “Proper”"],
                ["This worker", r.eligible ? "Eligible — attends properly" : `Not eligible — ${detail.conduct}`],
                ["Commission this month", r.eligible ? `${formatINR(r.amount)} (${r.days} × ₹${r.rate})` : "₹0 (stopped)"],
              ], note: "Change conduct from the row dropdown; every change is recorded in the Audit Log with your login." },
            ]}
          />
        );
      })()}
    </>
  );
}

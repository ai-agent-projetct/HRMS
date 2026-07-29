"use client";

import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useState } from "react";
import { downloadExcel } from "@/lib/excel";
import { DetailSheet } from "@/components/detail-sheet";
import {
  AGENTS, agentById, categoryById, commissionEligible, CONDUCT_STATUSES, type ConductStatus,
} from "@/lib/hr-master";
import { useHr, attendanceFor, CURRENT_MONTH_LABEL } from "@/stores/hr";
import type { HrEmployee } from "@/lib/hr-data";
import { formatINR } from "@/lib/utils";
import { Handshake, Users, Coins, UserX, FileSpreadsheet } from "lucide-react";

export default function AgentsPage() {
  const employees = useHr((s) => s.employees);
  const attendance = useHr((s) => s.attendance);
  const setConduct = useHr((s) => s.setConduct);
  const push = useToast((s) => s.push);
  const [detail, setDetail] = useState<HrEmployee | null>(null);

  const supplied = employees.filter((e) => e.agentId);

  const rowFor = (empId: string) => {
    const e = employees.find((x) => x.id === empId)!;
    const agent = agentById(e.agentId);
    const a = attendanceFor(attendance, empId);
    const eligible = commissionEligible(e.conduct);
    const amount = eligible ? (agent?.commissionPerWorker ?? 0) : 0;
    return { e, agent, days: a?.daysWorked ?? 0, eligible, amount };
  };

  const perAgent = AGENTS.map((ag) => {
    const workers = supplied.filter((e) => e.agentId === ag.id);
    const payable = workers.reduce((s, e) => s + (commissionEligible(e.conduct) ? ag.commissionPerWorker : 0), 0);
    const eligibleCount = workers.filter((e) => commissionEligible(e.conduct)).length;
    return { ag, workers, payable, eligibleCount };
  });

  const totalCommission = perAgent.reduce((s, p) => s + p.payable, 0);
  const totalWorkers = supplied.length;
  const ineligible = supplied.filter((e) => !commissionEligible(e.conduct)).length;

  const exportCommission = () =>
    downloadExcel({
      filename: `agent-commission-${CURRENT_MONTH_LABEL}`, sheetName: "Commission", title: `Agent Commission — ${CURRENT_MONTH_LABEL}`,
      columns: [
        { header: "Agent", key: "agent", width: 26 }, { header: "Emp ID", key: "id" }, { header: "Worker", key: "name", width: 22 },
        { header: "Category", key: "category" }, { header: "Days worked", key: "days" }, { header: "Conduct", key: "conduct" },
        { header: "Eligible", key: "eligibleYN" }, { header: "Commission ₹", key: "amount" },
      ],
      rows: supplied.map((e) => {
        const r = rowFor(e.id);
        return { agent: r.agent?.name, id: e.id, name: e.name, category: categoryById(e.category)?.label, days: r.days, conduct: e.conduct, eligibleYN: r.eligible ? "Yes" : "No", amount: r.amount };
      }),
    });

  return (
    <>
      <PageHeader
        title="Agents & Commission"
        description="Workers supplied by labour agents earn the agent a monthly commission — but only while the worker attends properly. Absconding, long leave or frequent absence stops the payout."
        actions={<Button variant="outline" size="sm" onClick={exportCommission}><FileSpreadsheet className="h-4 w-4" /> Export commission</Button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Commission payable" value={formatINR(totalCommission, true)} icon={Coins} sub={CURRENT_MONTH_LABEL} tone="success" />
        <KpiCard label="Agents" value={`${AGENTS.length}`} icon={Handshake} sub="active contractors" />
        <KpiCard label="Workers via agents" value={`${totalWorkers}`} icon={Users} sub="supplied labour" tone="info" />
        <KpiCard label="Not eligible" value={`${ineligible}`} icon={UserX} sub="absconded / long leave / absent" tone="danger" />
      </div>

      {/* Per-agent summary */}
      <div className="grid gap-4 md:grid-cols-2">
        {perAgent.map((p) => (
          <Card key={p.ag.id}>
            <CardHeader className="flex-row items-start justify-between">
              <div>
                <CardTitle>{p.ag.name}</CardTitle>
                <CardDescription>{p.ag.place} · {p.ag.phone} · {formatINR(p.ag.commissionPerWorker)}/worker</CardDescription>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-success">{formatINR(p.payable)}</p>
                <p className="text-[11px] text-muted-foreground">{p.eligibleCount}/{p.workers.length} eligible</p>
              </div>
            </CardHeader>
            <CardContent>
              {p.workers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No workers currently.</p>
              ) : (
                <Table>
                  <THead><TR><TH>Worker</TH><TH className="text-center">Days</TH><TH>Conduct</TH><TH className="text-right">Comm.</TH></TR></THead>
                  <TBody>
                    {p.workers.map((e) => {
                      const r = rowFor(e.id);
                      return (
                        <TR key={e.id}>
                          <TD className="font-medium"><button className="text-left hover:text-primary hover:underline" onClick={() => setDetail(e)}>{e.name}</button><div className="text-xs font-normal text-muted-foreground">{categoryById(e.category)?.label} · details →</div></TD>
                          <TD className="text-center">{r.days}</TD>
                          <TD>
                            <select
                              value={e.conduct}
                              onChange={(ev) => { setConduct(e.id, ev.target.value as ConductStatus); push(`${e.name} → ${ev.target.value}`, commissionEligible(ev.target.value as ConductStatus) ? "Agent commission enabled." : "Agent commission stopped."); }}
                              className="h-7 rounded-md border border-input bg-card px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              {CONDUCT_STATUSES.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </TD>
                          <TD className="text-right">
                            {r.eligible ? <span className="font-semibold text-success">{formatINR(r.amount)}</span> : <Badge tone="danger">Stopped</Badge>}
                          </TD>
                        </TR>
                      );
                    })}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {detail && (() => {
        const r = rowFor(detail.id);
        const a = attendanceFor(attendance, detail.id);
        return (
          <DetailSheet
            title={`${detail.name} — Agent & Commission`}
            subtitle={`${detail.id} · ${categoryById(detail.category)?.label} · ${CURRENT_MONTH_LABEL}`}
            badges={[
              { label: r.eligible ? "Commission: Payable" : "Commission: Stopped", tone: r.eligible ? "success" : "danger" },
              { label: `Conduct: ${detail.conduct}`, tone: detail.conduct === "Proper" ? "success" : "warning" },
            ]}
            onClose={() => setDetail(null)}
            sections={[
              { heading: "Supplying agent", rows: [
                ["Agent", r.agent?.name ?? "—"],
                ["Place", r.agent?.place ?? "—"],
                ["Phone", r.agent?.phone ?? "—"],
                ["Commission rate", `${formatINR(r.agent?.commissionPerWorker ?? 0)} / worker / month`],
              ] },
              { heading: "Worker & attendance", stats: [
                { label: "Days worked", value: `${r.days}` },
                { label: "Saturdays", value: `${a?.saturdaysWorked ?? 0}/${a?.totalSaturdays ?? 4}` },
                { label: "Conduct", value: detail.conduct, tone: detail.conduct === "Proper" ? "success" : "danger" },
                { label: "Dept", value: detail.department },
              ] },
              { heading: "Commission decision", rows: [
                ["Rule", "Paid only while conduct is “Proper”"],
                ["This worker", r.eligible ? "Eligible — attends properly" : `Not eligible — ${detail.conduct}`],
                ["Commission this month", r.eligible ? formatINR(r.amount) : "₹0 (stopped)"],
              ], note: "Change conduct from the row dropdown; every change is recorded in the Audit Log with your login." },
            ]}
          />
        );
      })()}
    </>
  );
}

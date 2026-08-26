"use client";

import { useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { downloadExcel } from "@/lib/excel";
import { useHr, TODAY } from "@/stores/hr";
import { dailyBriefing, answerQuery, SUGGESTED_QUESTIONS, type AiContext, type AiAnswer } from "@/lib/hr-ai";
import { formatDate } from "@/lib/utils";
import {
  Bot, Sparkles, Users, AlertTriangle, Gauge, Boxes, ShieldAlert, UserCog,
  Send, FileSpreadsheet, TrendingUp, HeartPulse, CircleCheck, Info, ArrowRight,
} from "lucide-react";

type ChatMsg = { role: "user" | "ai"; text: string; rows?: AiAnswer["rows"] };

export default function AiCommandCenter() {
  const employees = useHr((s) => s.employees);
  const attendance = useHr((s) => s.attendance);
  const leave = useHr((s) => s.leave);
  const advances = useHr((s) => s.advances);
  const units = useHr((s) => s.units);
  const [unit, setUnit] = useState("All");

  const scoped = useMemo(() => (unit === "All" ? employees : employees.filter((e) => (e.unit ?? "") === unit)), [employees, unit]);
  const ctx: AiContext = useMemo(() => ({ employees: scoped, attendance, leave, advances, today: TODAY }), [scoped, attendance, leave, advances]);
  const b = useMemo(() => dailyBriefing(ctx), [ctx]);

  const [chat, setChat] = useState<ChatMsg[]>([{ role: "ai", text: b.summary }]);
  const [q, setQ] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const ask = (question: string) => {
    if (!question.trim()) return;
    const a = answerQuery(question, ctx);
    setChat((c) => [...c, { role: "user", text: question }, { role: "ai", text: a.answer, rows: a.rows }]);
    setQ("");
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50);
  };

  const riskTone = b.productionRisk === "High" ? "danger" : b.productionRisk === "Medium" ? "warning" : "success";
  const AlertIcon = ({ level }: { level: string }) => level === "danger" ? <ShieldAlert className="h-4 w-4 text-danger" /> : level === "warning" ? <AlertTriangle className="h-4 w-4 text-warning" /> : level === "success" ? <CircleCheck className="h-4 w-4 text-success" /> : <Info className="h-4 w-4 text-info" />;

  const exportReport = () =>
    downloadExcel({
      filename: `daily-hr-report-${unit === "All" ? "all-units" : unit.replace(/\s+/g, "-")}-${TODAY}`, sheetName: "Daily Report", title: `Daily HR & Production Report — ${unit === "All" ? "All Units" : unit} — ${formatDate(TODAY)}`,
      columns: [
        { header: "Unit", key: "unit", width: 26 }, { header: "Assigned", key: "assigned" }, { header: "Present", key: "present" },
        { header: "On Leave", key: "onLeave" }, { header: "Absent", key: "absent" }, { header: "Required", key: "required" },
        { header: "Present %", key: "pct" }, { header: "Avg Eff %", key: "eff" }, { header: "Output", key: "output" }, { header: "Status", key: "status" },
      ],
      rows: b.units.map((u) => ({
        unit: u.unit.label, assigned: u.assigned, present: u.present, onLeave: u.onLeave, absent: u.absent,
        required: u.requiredPresent, pct: u.presentPct, eff: u.avgEfficiency, output: u.output, status: u.atRisk ? "AT RISK" : "OK",
      })),
    });

  return (
    <>
      <PageHeader
        title={<span className="inline-flex items-center gap-2"><Bot className="h-5 w-5 text-primary" /> AI Command Centre</span>}
        description={`Agentic daily briefing for ${formatDate(TODAY)}${unit === "All" ? " — all units" : ` — ${unit} only`} — attendance, production risk, coverage & auto-assignment, performance and a live assistant`}
        actions={
          <>
            <select value={unit} onChange={(e) => setUnit(e.target.value)} className="h-8 rounded-md border border-input bg-card px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring" title="Report scope">
              <option value="All">All units</option>
              {units.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <Button variant="outline" size="sm" onClick={exportReport}><FileSpreadsheet className="h-4 w-4" /> Export daily report</Button>
          </>
        }
      />

      {/* AI morning brief */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="flex gap-3 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary"><Sparkles className="h-5 w-5" /></div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary">AI Daily Briefing</p>
            <p className="mt-1 text-sm leading-relaxed">{b.summary}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Present today" value={`${b.present}/${b.headcount}`} icon={Users} sub={`${b.presentPct}% · ${b.onLeave} leave · ${b.absent} absent`} tone="success" />
        <KpiCard label="Production risk" value={b.productionRisk} icon={ShieldAlert} sub={`${b.units.filter((u) => u.atRisk).length} unit(s) at risk`} tone={riskTone} />
        <KpiCard label="Avg efficiency" value={`${b.avgEfficiency}%`} icon={Gauge} sub="across present workers" tone="info" />
        <KpiCard label="Planned output" value={b.totalOutput.toLocaleString("en-IN")} icon={Boxes} sub="units today" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left: alerts + coverage + units */}
        <div className="space-y-4 lg:col-span-2">
          {/* Coverage / auto-assignment */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><UserCog className="h-4 w-4 text-primary" /> Coverage & auto-assignment</CardTitle><CardDescription>When a supervisor or head is on leave, the agent nominates a deputy so performance & output hold.</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {b.gaps.length === 0 && <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">All units have their supervisor / head present today.</p>}
              {b.gaps.map((g) => (
                <div key={g.leader.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge tone="warning">{g.leader.role} on leave</Badge>
                    <span className="font-semibold">{g.leader.name}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    {g.deputy ? <Badge tone="success">Deputy: {g.deputy.name}</Badge> : <Badge tone="danger">No deputy — escalate</Badge>}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">{g.note}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Department shortages → trained redeployment */}
          <Card className={b.shortages.length ? "border-danger/40" : undefined}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Short-staffed departments &amp; trained cover ({b.shortages.length})
              </CardTitle>
              <CardDescription>
                When a supervisor and several workers are out of the same department, the agent finds who is already <b>trained</b> for that section, ranks them, and names the stand-in.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {b.shortages.length === 0 && (
                <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">
                  No department is short-staffed today — every section has its supervisor and enough hands.
                </p>
              )}
              {b.shortages.map((s) => (
                <div key={s.department} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={s.severity === "Critical" ? "danger" : s.severity === "High" ? "warning" : "muted"}>{s.severity}</Badge>
                    <span className="text-sm font-bold">{s.department}</span>
                    <Badge tone="muted">{s.present}/{s.headcount} present</Badge>
                    <Badge tone="danger">{s.absentPct}% away</Badge>
                    {s.supervisorAbsent && <Badge tone="warning"><UserCog className="h-3 w-3" /> Supervisor out</Badge>}
                  </div>

                  {s.supervisors.length > 0 && (
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      Out: {s.supervisors.map((x) => `${x.name} (${x.role})`).join(", ")}
                      {s.absentees.length > s.supervisors.length ? ` + ${s.absentees.length - s.supervisors.length} worker(s)` : ""}
                    </p>
                  )}

                  {s.candidates.length > 0 ? (
                    <div className="mt-2 overflow-hidden rounded-md border">
                      <Table>
                        <THead>
                          <TR><TH>Trained stand-in</TH><TH>Currently in</TH><TH>Training held</TH><TH className="text-center">Level</TH><TH className="text-center">Eff.</TH><TH className="text-center">Fit</TH></TR>
                        </THead>
                        <TBody>
                          {s.candidates.map((c) => (
                            <TR key={c.emp.id}>
                              <TD className="font-medium">{c.emp.name}<div className="text-[10px] font-normal text-muted-foreground">{c.emp.id}</div></TD>
                              <TD className="text-xs">{c.fromDepartment}</TD>
                              <TD className="text-xs">{c.training.skill}<div className="text-[10px] text-muted-foreground">completed {c.training.completedOn}</div></TD>
                              <TD className="text-center"><Badge tone={c.training.level === "Certified" ? "success" : c.training.level === "Intermediate" ? "info" : "muted"}>{c.training.level}</Badge></TD>
                              <TD className="text-center text-xs">{c.efficiency}%</TD>
                              <TD className="text-center text-xs font-semibold">{c.score}</TD>
                            </TR>
                          ))}
                        </TBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="mt-2 rounded-md bg-danger/10 px-2.5 py-1.5 text-[11px] text-danger">No trained stand-in available for {s.department} today.</p>
                  )}

                  <p className="mt-2 rounded-md bg-primary/5 p-2.5 text-xs">
                    <span className="font-semibold text-primary">AI recommendation: </span>{s.recommendation}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Alerts */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-primary" /> Today’s alerts ({b.alerts.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {b.alerts.length === 0 && <p className="text-sm text-muted-foreground">No alerts — smooth day.</p>}
              {b.alerts.map((a, i) => (
                <div key={i} className="flex gap-2.5 rounded-md border p-2.5">
                  <AlertIcon level={a.level} />
                  <div><p className="text-xs font-semibold">{a.title}</p><p className="text-xs text-muted-foreground">{a.detail}</p></div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Unit status */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Boxes className="h-4 w-4 text-primary" /> Unit status — production, dyeing, machinery, sales…</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <THead><TR><TH>Unit</TH><TH className="text-center">Present</TH><TH className="w-32">Strength</TH><TH className="text-center">Eff</TH><TH className="text-right">Output</TH><TH>Status</TH></TR></THead>
                <TBody>
                  {b.units.map((u) => (
                    <TR key={u.unit.id}>
                      <TD className="font-medium">{u.unit.label}{u.unit.critical && <Badge tone="muted" className="ml-1.5">critical</Badge>}</TD>
                      <TD className="text-center">{u.present}/{u.assigned}{u.onLeave ? <span className="text-muted-foreground"> · {u.onLeave}L</span> : ""}</TD>
                      <TD><Progress value={u.presentPct} tone={u.atRisk ? "danger" : "success"} /><div className="mt-0.5 text-[10px] text-muted-foreground">need {u.requiredPresent}</div></TD>
                      <TD className="text-center">{u.avgEfficiency}%</TD>
                      <TD className="text-right">{u.output.toLocaleString("en-IN")}</TD>
                      <TD>{u.atRisk ? <Badge tone="danger">At risk</Badge> : <Badge tone="success">OK</Badge>}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>

          {/* Performance */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-success" /> Top performers</CardTitle></CardHeader>
              <CardContent className="space-y-1.5">
                {b.topPerformers.map((r) => (
                  <div key={r.emp.id} className="flex items-center justify-between rounded-md border p-2 text-xs">
                    <span className="font-medium">{r.emp.name}<span className="ml-1 font-normal text-muted-foreground">· {r.emp.role}</span></span>
                    <Badge tone="success">{r.perf.efficiency}%</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><HeartPulse className="h-4 w-4 text-danger" /> Needs attention</CardTitle></CardHeader>
              <CardContent className="space-y-1.5">
                {b.lowPerformers.length === 0 && <p className="text-xs text-muted-foreground">None flagged today.</p>}
                {b.lowPerformers.map((r) => (
                  <div key={r.emp.id} className="flex items-center justify-between rounded-md border p-2 text-xs">
                    <span className="font-medium">{r.emp.name}<span className="ml-1 font-normal text-muted-foreground">· {r.emp.role}</span></span>
                    <Badge tone="danger">{r.perf.efficiency}%</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right: AI assistant */}
        <div className="lg:col-span-1">
          <Card className="sticky top-20 flex h-[calc(100vh-8rem)] flex-col">
            <CardHeader className="border-b"><CardTitle className="flex items-center gap-2"><Bot className="h-4 w-4 text-primary" /> AI Assistant</CardTitle><CardDescription>Ask about attendance, production, coverage, performance…</CardDescription></CardHeader>
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
              {chat.map((m, i) => (
                <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div className={`max-w-[92%] rounded-lg px-3 py-2 text-xs leading-relaxed ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    <p>{m.text}</p>
                    {m.rows && m.rows.length > 0 && (
                      <div className="mt-2 space-y-1 border-t border-current/10 pt-2">
                        {m.rows.map((r, j) => (
                          <div key={j} className="flex items-center justify-between gap-3">
                            <span className="opacity-80">{r.label}</span>
                            <span className="shrink-0 font-semibold">{r.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t p-3">
              <div className="mb-2 flex flex-wrap gap-1">
                {SUGGESTED_QUESTIONS.slice(0, 4).map((s) => (
                  <button key={s} onClick={() => ask(s)} className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">{s}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask(q)} placeholder="Ask the HR agent…" />
                <Button size="icon" onClick={() => ask(q)} aria-label="Send"><Send className="h-4 w-4" /></Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

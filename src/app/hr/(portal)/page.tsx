"use client";

import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { ApexChart } from "@/components/charts/apex";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { useMemo } from "react";
import { roleGroup, tenure } from "@/lib/hr-data";
import { useHr, leaveStatusTone, attendanceFor, outstandingAdvance, TODAY } from "@/stores/hr";
import { buildPayslip } from "@/lib/payroll";
import { AGENTS, SHIFTS, computeIncentives, commissionEligible } from "@/lib/hr-master";
import { dailyBriefing, type AiContext } from "@/lib/hr-ai";
import { formatINR } from "@/lib/utils";
import {
  Users, UserCheck, CalendarClock, Banknote, IndianRupee, Award, Send,
  Clock, Gift, Handshake, HandCoins, CalendarCheck, HeartPulse, Database,
  Bot, Sparkles, ShieldAlert, UserCog, ArrowRight,
} from "lucide-react";

export default function HrDashboard() {
  const employees = useHr((s) => s.employees);
  const leave = useHr((s) => s.leave);
  const attendance = useHr((s) => s.attendance);
  const advances = useHr((s) => s.advances);
  const user = useHr((s) => s.user);

  // Agentic daily briefing — the "what's happening today" the AI reports at login.
  const ctx: AiContext = useMemo(() => ({ employees, attendance, leave, advances, today: TODAY }), [employees, attendance, leave, advances]);
  const brief = useMemo(() => dailyBriefing(ctx), [ctx]);
  const riskTone = brief.productionRisk === "High" ? "danger" : brief.productionRisk === "Medium" ? "warning" : "success";

  const active = employees.filter((e) => e.status === "Active" || e.status === "Probation");
  const pendingLeave = leave.filter((l) => l.status === "Pending" || l.status === "Approved by Manager");
  const monthlyPayroll = employees.reduce((s, e) => s + buildPayslip(e.monthlyGross).netPay, 0);
  const freshers = employees.filter((e) => e.employmentType === "Fresher").length;

  // Mill-workforce metrics.
  const dailyWorkers = employees.filter((e) => e.wageType === "Daily");
  const incentivePayout = dailyWorkers.reduce((s, e) => {
    const a = attendanceFor(attendance, e.id);
    return s + computeIncentives(a?.saturdaysWorked ?? 0, a?.totalSaturdays ?? 4, a?.daysWorked ?? 0).total;
  }, 0);
  const commissionPayable = AGENTS.reduce((s, ag) =>
    s + employees.filter((e) => e.agentId === ag.id && commissionEligible(e.conduct)).length * ag.commissionPerWorker, 0);
  const totalOutstanding = employees.reduce((s, e) => s + outstandingAdvance(advances, e.id), 0);

  const quickLinks = [
    { href: "/hr/ai", label: "AI Command Centre", icon: Bot },
    { href: "/hr/attendance", label: "Attendance & Shifts", icon: CalendarCheck },
    { href: "/hr/incentives", label: "Incentives", icon: Gift },
    { href: "/hr/agents", label: "Agents & Commission", icon: Handshake },
    { href: "/hr/advances", label: "Advances & Deductions", icon: HandCoins },
    { href: "/hr/weekly", label: "Weekly Wages", icon: Clock },
    { href: "/hr/health", label: "Health Check", icon: HeartPulse },
    { href: "/hr/masters", label: "Masters & Database", icon: Database },
  ];

  // Role-group distribution.
  const groups = ["Management", "Supervisor", "Staff", "Worker", "Support"] as const;
  const groupCounts = groups.map((g) => employees.filter((e) => roleGroup(e.role) === g).length);

  // Upcoming: probation completions (< 90 days tenure).
  const probation = employees.filter((e) => e.status === "Probation");

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.name.split(" ")[0] ?? "HR"}`}
        description="People portal overview — headcount, roles, leave and payroll at a glance"
        actions={
          <>
            <Link href="/hr/ai"><Button variant="outline" size="sm"><Bot className="h-4 w-4" /> AI Command Centre</Button></Link>
            <Link href="/hr/reports"><Button size="sm"><Send className="h-4 w-4" /> Send daily report</Button></Link>
          </>
        }
      />

      {/* AI daily briefing — shown on login */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary"><Sparkles className="h-5 w-5" /></div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">AI Daily Briefing · {TODAY}</p>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed">{brief.summary}</p>
              </div>
            </div>
            <Link href="/hr/ai"><Button size="sm" variant="outline">Open <ArrowRight className="h-3.5 w-3.5" /></Button></Link>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="success">{brief.present}/{brief.headcount} present</Badge>
            <Badge tone="info">{brief.onLeave} on leave</Badge>
            <Badge tone={brief.absent ? "danger" : "muted"}>{brief.absent} absent</Badge>
            <Badge tone={riskTone}><ShieldAlert className="h-3 w-3" /> Production risk: {brief.productionRisk}</Badge>
            {brief.gaps.length > 0 && <Badge tone="warning"><UserCog className="h-3 w-3" /> {brief.gaps.length} deputy auto-assigned</Badge>}
            <Badge tone="muted">{brief.avgEfficiency}% avg efficiency</Badge>
          </div>
          {brief.gaps.length > 0 && (
            <div className="mt-3 space-y-1.5 border-t pt-3">
              {brief.gaps.map((g) => (
                <p key={g.leader.id} className="flex items-center gap-2 text-xs">
                  <UserCog className="h-3.5 w-3.5 shrink-0 text-warning" />
                  <span className="font-semibold">{g.leader.name}</span> ({g.leader.role}) on leave
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  {g.deputy ? <><span className="font-semibold text-success">{g.deputy.name}</span> acting in-charge · {g.reportsCount} reports</> : <span className="text-danger">escalate — no deputy</span>}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Employees" value={`${employees.length}`} icon={Users} sub={`${active.length} active · ${freshers} fresher`} />
        <KpiCard label="Present Today" value={`${active.filter((e) => e.leave.lopThisMonth === 0).length}/${active.length}`} icon={UserCheck} sub="live from attendance" tone="success" />
        <KpiCard label="Pending Leave" value={`${pendingLeave.length}`} icon={CalendarClock} sub="awaiting approval" tone="warning" />
        <KpiCard label="Monthly Payroll (net)" value={formatINR(monthlyPayroll, true)} icon={Banknote} sub="visible to CEO & Accounts" tone="info" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Daily-wage workers" value={`${dailyWorkers.length}`} icon={Clock} sub={`across ${SHIFTS.length} shifts`} />
        <KpiCard label="Incentive payout" value={formatINR(incentivePayout, true)} icon={Gift} sub="Saturday + 28-day" tone="success" />
        <KpiCard label="Agent commission" value={formatINR(commissionPayable, true)} icon={Handshake} sub="attendance-linked" tone="info" />
        <KpiCard label="Advances outstanding" value={formatINR(totalOutstanding, true)} icon={HandCoins} sub="recovering monthly" tone="warning" />
      </div>

      <Card>
        <CardContent className="flex flex-wrap gap-2 py-3">
          {quickLinks.map((l) => (
            <Link key={l.href} href={l.href} className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted">
              <l.icon className="h-4 w-4 text-primary" /> {l.label}
            </Link>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle>Role distribution</CardTitle>
            <CardDescription>Management → worker across garment & textile roles</CardDescription>
          </CardHeader>
          <CardContent>
            <ApexChart
              type="donut"
              height={260}
              series={groupCounts}
              options={{ labels: [...groups], legend: { position: "bottom" }, stroke: { width: 0 }, plotOptions: { pie: { donut: { size: "65%" } } } }}
            />
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Pending leave approvals</CardTitle>
            <CardDescription>Manager → HR two-step approval; decisions reflect to the main Admin.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR><TH>ID</TH><TH>Employee</TH><TH>Type</TH><TH>Dates</TH><TH className="text-right">Days</TH><TH>Status</TH></TR>
              </THead>
              <TBody>
                {pendingLeave.map((l) => (
                  <TR key={l.id}>
                    <TD className="font-semibold text-primary">{l.id}</TD>
                    <TD className="font-medium">{l.empName}</TD>
                    <TD><Badge tone="muted">{l.type}</Badge></TD>
                    <TD className="text-muted-foreground">{l.from} → {l.to}</TD>
                    <TD className="text-right">{l.days}</TD>
                    <TD><Badge tone={leaveStatusTone(l.status)}>{l.status}</Badge></TD>
                  </TR>
                ))}
                {pendingLeave.length === 0 && <TR><TD colSpan={6} className="py-4 text-center text-xs text-muted-foreground">No pending requests.</TD></TR>}
              </TBody>
            </Table>
            <div className="mt-2 text-right">
              <Link href="/hr/leave" className="text-xs font-semibold text-primary hover:underline">Manage leave →</Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> On probation</CardTitle>
            <CardDescription>Freshers/new joiners — confirmation review due.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {probation.map((e) => (
              <Link key={e.id} href={`/hr/employee/${e.id}`} className="flex items-center justify-between rounded-md border p-2.5 hover:bg-muted">
                <div>
                  <p className="text-xs font-semibold">{e.name} — {e.role}</p>
                  <p className="text-[11px] text-muted-foreground">Joined {e.doj} · {tenure(e.doj).label} · {e.employmentType}</p>
                </div>
                <Badge tone="warning">Probation</Badge>
              </Link>
            ))}
            {probation.length === 0 && <p className="py-3 text-center text-xs text-muted-foreground">None on probation.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><IndianRupee className="h-4 w-4 text-primary" /> Payroll snapshot</CardTitle>
            <CardDescription>Same figures the CEO & Accounts logins see.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TBody>
                {[
                  ["Employees on payroll", `${employees.length}`],
                  ["Gross monthly", formatINR(employees.reduce((s, e) => s + buildPayslip(e.monthlyGross).grossEarnings, 0))],
                  ["Total deductions (PF/ESI/PT/TDS)", formatINR(employees.reduce((s, e) => s + buildPayslip(e.monthlyGross).totalDeductions, 0))],
                  ["Net payable", formatINR(monthlyPayroll)],
                ].map(([l, v]) => (
                  <TR key={l}><TD className={l === "Net payable" ? "font-bold" : "text-muted-foreground"}>{l}</TD><TD className={`text-right ${l === "Net payable" ? "font-bold text-success" : ""}`}>{v}</TD></TR>
                ))}
              </TBody>
            </Table>
            <div className="mt-2 text-right">
              <Link href="/hr/payroll" className="text-xs font-semibold text-primary hover:underline">Open payroll →</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

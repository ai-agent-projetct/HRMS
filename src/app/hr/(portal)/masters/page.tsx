"use client";

import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { downloadExcel } from "@/lib/excel";
import { useToast } from "@/components/ui/toast";
import {
  SHIFTS, WORKER_CATEGORIES, MILL_SECTIONS, WORKER_DESIGNATIONS, AGENTS, INCENTIVE,
} from "@/lib/hr-master";
import { useHr } from "@/stores/hr";
import { formatINR } from "@/lib/utils";
import { Database, Clock, Layers, Building2, Handshake, FileSpreadsheet, Download, Gift } from "lucide-react";

export default function MastersPage() {
  const employees = useHr((s) => s.employees);
  const push = useToast((s) => s.push);

  const countByCategory = (id: string) => employees.filter((e) => e.category === id).length;
  const countByShift = (id: string) => employees.filter((e) => e.shiftId === id).length;

  const exportShifts = () =>
    downloadExcel({
      filename: "shift-master", sheetName: "Shifts", title: "Shift Master",
      columns: [{ header: "Code", key: "code" }, { header: "Shift", key: "name" }, { header: "Timing", key: "time", width: 22 }, { header: "Hours", key: "hours" }, { header: "Type", key: "kind" }, { header: "Workers", key: "count" }],
      rows: SHIFTS.map((s) => ({ ...s, count: countByShift(s.id) })),
    });

  const exportCategories = () =>
    downloadExcel({
      filename: "worker-category-master", sheetName: "Categories", title: "Worker Category Master",
      columns: [{ header: "Category", key: "label", width: 18 }, { header: "Wage Type", key: "wageType" }, { header: "Gender", key: "gender" }, { header: "Hostel", key: "hostelYN" }, { header: "PF/ESI", key: "statYN" }, { header: "Workers", key: "count" }, { header: "Notes", key: "note", width: 44 }],
      rows: WORKER_CATEGORIES.map((c) => ({ ...c, gender: c.gender ?? "Any", hostelYN: c.hostel ? "Yes" : "No", statYN: c.statutory ? "Yes" : "No", count: countByCategory(c.id) })),
    });

  const exportAgents = () =>
    downloadExcel({
      filename: "agent-master", sheetName: "Agents", title: "Labour Agent Master",
      columns: [{ header: "Agent ID", key: "id" }, { header: "Agent", key: "name", width: 26 }, { header: "Place", key: "place", width: 20 }, { header: "Phone", key: "phone" }, { header: "Commission / worker ₹", key: "commissionPerWorker" }, { header: "Workers supplied", key: "count" }],
      rows: AGENTS.map((a) => ({ ...a, count: employees.filter((e) => e.agentId === a.id).length })),
    });

  const exportSections = () =>
    downloadExcel({
      filename: "section-master", sheetName: "Sections", title: "Mill Sections & Designations",
      columns: [{ header: "#", key: "n" }, { header: "Section / Department", key: "section", width: 26 }],
      rows: MILL_SECTIONS.map((s, i) => ({ n: i + 1, section: s })),
    });

  const exportFullDatabase = async () => {
    // The whole HR database — one master export for backup / audit.
    await downloadExcel({
      filename: "hr-full-database", sheetName: "Workforce", title: "HR Full Database — Workforce",
      columns: [
        { header: "Emp ID", key: "id" }, { header: "Name", key: "name", width: 22 }, { header: "Gender", key: "gender" },
        { header: "Category", key: "category" }, { header: "Wage Type", key: "wageType" }, { header: "Shift", key: "shiftId" },
        { header: "Role", key: "role", width: 18 }, { header: "Department", key: "department", width: 18 },
        { header: "Salary/Day ₹", key: "salaryPerDay" }, { header: "Monthly Gross ₹", key: "monthlyGross" },
        { header: "Agent", key: "agentId" }, { header: "Conduct", key: "conduct" }, { header: "Status", key: "status" },
        { header: "Phone", key: "phone" }, { header: "Aadhaar", key: "aadhaar" },
      ],
      rows: employees.map((e) => ({ ...e, salaryPerDay: e.salaryPerDay ?? "", agentId: e.agentId ?? "Direct" })),
    });
    push("HR database exported", `${employees.length} workforce rows written to Excel.`);
  };

  return (
    <>
      <PageHeader
        title="Masters & Database"
        description="Shifts, worker categories, mill sections, agents & incentive rules — the configuration behind every calculation, viewable and downloadable to Excel"
        actions={<Button size="sm" onClick={exportFullDatabase}><Download className="h-4 w-4" /> Download full database</Button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Shifts" value={`${SHIFTS.length}`} icon={Clock} sub="running across the mill" />
        <KpiCard label="Worker Categories" value={`${WORKER_CATEGORIES.length}`} icon={Layers} sub="permanent · hostel · casual · migrant" tone="info" />
        <KpiCard label="Mill Sections" value={`${MILL_SECTIONS.length}`} icon={Building2} sub="departments on the wage sheet" tone="success" />
        <KpiCard label="Labour Agents" value={`${AGENTS.length}`} icon={Handshake} sub="supplying workers on commission" tone="warning" />
      </div>

      <Tabs defaultValue="shifts">
        <TabsList>
          <TabsTrigger value="shifts">Shifts</TabsTrigger>
          <TabsTrigger value="categories">Worker Categories</TabsTrigger>
          <TabsTrigger value="sections">Sections & Designations</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="incentive">Incentive Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="shifts">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div><CardTitle>Shift Master — 6 shifts</CardTitle><CardDescription>Rotating spinning shifts, 12-hour continuous shifts and the general staff shift</CardDescription></div>
              <Button variant="outline" size="sm" onClick={exportShifts}><FileSpreadsheet className="h-4 w-4" /> Export</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <THead><TR><TH>Code</TH><TH>Shift</TH><TH>Timing</TH><TH>Hours</TH><TH>Type</TH><TH className="text-right">Workers</TH></TR></THead>
                <TBody>
                  {SHIFTS.map((s) => (
                    <TR key={s.id}>
                      <TD><Badge tone="info">{s.code}</Badge></TD>
                      <TD className="font-medium">{s.name}</TD>
                      <TD className="text-muted-foreground">{s.time}</TD>
                      <TD>{s.hours} hr</TD>
                      <TD><Badge tone={s.kind === "Continuous" ? "warning" : s.kind === "General" ? "muted" : "default"}>{s.kind}</Badge></TD>
                      <TD className="text-right font-semibold">{countByShift(s.id)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div><CardTitle>Worker Category Master</CardTitle><CardDescription>Drives wage type, statutory cover and hostel/mess linkage</CardDescription></div>
              <Button variant="outline" size="sm" onClick={exportCategories}><FileSpreadsheet className="h-4 w-4" /> Export</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <THead><TR><TH>Category</TH><TH>Wage</TH><TH>Gender</TH><TH>Hostel</TH><TH>PF/ESI</TH><TH className="text-right">Workers</TH><TH>Notes</TH></TR></THead>
                <TBody>
                  {WORKER_CATEGORIES.map((c) => (
                    <TR key={c.id}>
                      <TD className="font-medium">{c.label}</TD>
                      <TD><Badge tone={c.wageType === "Daily" ? "warning" : "muted"}>{c.wageType}</Badge></TD>
                      <TD className="text-muted-foreground">{c.gender ?? "Any"}</TD>
                      <TD>{c.hostel ? <Badge tone="info">Hostel</Badge> : <span className="text-muted-foreground">—</span>}</TD>
                      <TD>{c.statutory ? <Badge tone="success">Yes</Badge> : <span className="text-muted-foreground">No</span>}</TD>
                      <TD className="text-right font-semibold">{countByCategory(c.id)}</TD>
                      <TD className="max-w-[320px] whitespace-normal text-xs text-muted-foreground">{c.note}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sections">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Mill Sections / Departments</CardTitle>
                <Button variant="outline" size="sm" onClick={exportSections}><FileSpreadsheet className="h-4 w-4" /> Export</Button>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {MILL_SECTIONS.map((s) => <Badge key={s} tone="muted" className="text-xs">{s}</Badge>)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Worker Designations</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {WORKER_DESIGNATIONS.map((d) => <Badge key={d} tone="info" className="text-xs">{d}</Badge>)}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="agents">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div><CardTitle>Labour Agent Master</CardTitle><CardDescription>Contractors who supply workers — see Agents & Commission for monthly payouts</CardDescription></div>
              <Button variant="outline" size="sm" onClick={exportAgents}><FileSpreadsheet className="h-4 w-4" /> Export</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <THead><TR><TH>Agent ID</TH><TH>Agent</TH><TH>Place</TH><TH>Phone</TH><TH className="text-right">Comm./worker</TH><TH className="text-right">Supplied</TH></TR></THead>
                <TBody>
                  {AGENTS.map((a) => (
                    <TR key={a.id}>
                      <TD className="font-mono text-xs text-muted-foreground">{a.id}</TD>
                      <TD className="font-medium">{a.name}</TD>
                      <TD className="text-muted-foreground">{a.place}</TD>
                      <TD className="text-muted-foreground">{a.phone}</TD>
                      <TD className="text-right">{formatINR(a.commissionPerWorker)}</TD>
                      <TD className="text-right font-semibold">{employees.filter((e) => e.agentId === a.id).length}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incentive">
          <Card>
            <CardHeader><CardTitle>Incentive Rules</CardTitle><CardDescription>How the two attendance incentives are calculated on every payslip</CardDescription></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border p-4">
                <div className="mb-1 flex items-center gap-2"><Gift /><h3 className="font-semibold">Incentive 1 — Saturday</h3></div>
                <p className="text-sm text-muted-foreground">Paid <span className="font-semibold text-foreground">{formatINR(INCENTIVE.perSaturday)}</span> for every Saturday worked. A worker who works <span className="font-semibold text-foreground">every</span> Saturday in the month is fully eligible.</p>
              </div>
              <div className="rounded-lg border p-4">
                <div className="mb-1 flex items-center gap-2"><Gift /><h3 className="font-semibold">Incentive 2 — 28-day attendance</h3></div>
                <p className="text-sm text-muted-foreground">A flat <span className="font-semibold text-foreground">{formatINR(INCENTIVE.fullMonthAmount)}</span> when a worker completes <span className="font-semibold text-foreground">{INCENTIVE.fullMonthDays}+ days</span> in the month.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="border-dashed">
        <CardContent className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
          <Database className="h-5 w-5 shrink-0 text-primary" />
          Every master and every worker record can be exported to Excel from this portal — attendance, advances, incentives, commission and payroll each have their own export on their page.
        </CardContent>
      </Card>
    </>
  );
}

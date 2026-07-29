"use client";

import { useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { downloadExcel } from "@/lib/excel";
import { useHr } from "@/stores/hr";
import { statutoryLine, statutorySummary, gratuity, annualBonus, STATUTORY } from "@/lib/statutory";
import { formatINR } from "@/lib/utils";
import { ShieldCheck, Landmark, HeartPulse, Coins, Award, FileSpreadsheet, Wallet } from "lucide-react";

export default function CompliancePage() {
  const employees = useHr((s) => s.employees);
  const active = employees.filter((e) => e.status !== "Exited");
  const summary = useMemo(() => statutorySummary(employees), [employees]);
  const lines = useMemo(() => active.map(statutoryLine), [active]);

  const exportEcr = () =>
    downloadExcel({
      filename: "pf-esi-ecr-register", sheetName: "PF-ESI ECR", title: "PF / ESI Contribution Register (ECR)",
      columns: [
        { header: "Emp ID", key: "empId" }, { header: "Name", key: "name", width: 22 }, { header: "UAN", key: "uan" },
        { header: "Basic ₹", key: "basic" }, { header: "Gross ₹", key: "gross" },
        { header: "PF Employee ₹", key: "pfEmployee" }, { header: "PF Employer EPF ₹", key: "pfEmployerEpf" }, { header: "PF Employer EPS ₹", key: "pfEmployerEps" },
        { header: "ESI Employee ₹", key: "esiEmployee" }, { header: "ESI Employer ₹", key: "esiEmployer" }, { header: "PT ₹", key: "pt" },
      ],
      rows: lines as unknown as Record<string, unknown>[],
    });

  const exportGratuity = () =>
    downloadExcel({
      filename: "gratuity-liability", sheetName: "Gratuity", title: "Gratuity Liability",
      columns: [{ header: "Emp ID", key: "id" }, { header: "Name", key: "name", width: 22 }, { header: "Years", key: "years" }, { header: "Eligible (5+)", key: "elig" }, { header: "Gratuity ₹", key: "amt" }],
      rows: active.map((e) => { const g = gratuity(e); return { id: e.id, name: e.name, years: g.years, elig: g.eligible ? "Yes" : "No", amt: g.amount }; }),
    });

  const exportBonus = () =>
    downloadExcel({
      filename: "bonus-provision", sheetName: "Bonus", title: "Statutory Bonus Provision (8.33%)",
      columns: [{ header: "Emp ID", key: "id" }, { header: "Name", key: "name", width: 22 }, { header: "Annual Bonus ₹", key: "amt" }],
      rows: active.map((e) => ({ id: e.id, name: e.name, amt: annualBonus(e) })),
    });

  return (
    <>
      <PageHeader
        title="Statutory & Compliance"
        description="PF/ESI/PT monthly liability, statutory bonus and gratuity provisioning — with ECR-style registers ready to download"
        actions={<Button variant="outline" size="sm" onClick={exportEcr}><FileSpreadsheet className="h-4 w-4" /> Export ECR</Button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="PF liability / month" value={formatINR(summary.pfEmployee + summary.pfEmployer, true)} icon={Landmark} sub={`Employee ${formatINR(summary.pfEmployee, true)} + Employer ${formatINR(summary.pfEmployer, true)}`} />
        <KpiCard label="ESI liability / month" value={formatINR(summary.esiEmployee + summary.esiEmployer, true)} icon={HeartPulse} sub={`${summary.covered} workers covered`} tone="info" />
        <KpiCard label="Total statutory / month" value={formatINR(summary.totalMonthly, true)} icon={Wallet} sub="PF + ESI + PT" tone="warning" />
        <KpiCard label="Gratuity liability" value={formatINR(summary.gratuityLiability, true)} icon={Award} sub={`Bonus provision ${formatINR(summary.annualBonus, true)}/yr`} tone="success" />
      </div>

      <Tabs defaultValue="pfesi">
        <TabsList>
          <TabsTrigger value="pfesi">PF & ESI (ECR)</TabsTrigger>
          <TabsTrigger value="gratuity">Gratuity</TabsTrigger>
          <TabsTrigger value="bonus">Bonus</TabsTrigger>
          <TabsTrigger value="rules">Rates</TabsTrigger>
        </TabsList>

        <TabsContent value="pfesi">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div><CardTitle>PF & ESI contribution register</CardTitle><CardDescription>Employee + employer share per worker — the basis of the monthly ECR upload</CardDescription></div>
              <Button variant="outline" size="sm" onClick={exportEcr}><FileSpreadsheet className="h-4 w-4" /> Export</Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <THead><TR><TH>Emp</TH><TH>UAN</TH><TH className="text-right">Basic</TH><TH className="text-right">PF (Emp)</TH><TH className="text-right">PF (Employer)</TH><TH className="text-right">ESI (Emp)</TH><TH className="text-right">ESI (Employer)</TH><TH className="text-right">PT</TH></TR></THead>
                <TBody>
                  {lines.map((l) => (
                    <TR key={l.empId}>
                      <TD className="font-medium">{l.name}<div className="font-mono text-[10px] font-normal text-muted-foreground">{l.empId}</div></TD>
                      <TD className="font-mono text-xs text-muted-foreground">{l.uan}</TD>
                      <TD className="text-right">{formatINR(l.basic)}</TD>
                      <TD className="text-right">{l.pfEmployee ? formatINR(l.pfEmployee) : "—"}</TD>
                      <TD className="text-right">{l.pfEmployerTotal ? <span title={`EPF ${formatINR(l.pfEmployerEpf)} · EPS ${formatINR(l.pfEmployerEps)}`}>{formatINR(l.pfEmployerTotal)}</span> : "—"}</TD>
                      <TD className="text-right">{l.esiEmployee ? formatINR(l.esiEmployee) : "—"}</TD>
                      <TD className="text-right">{l.esiEmployer ? formatINR(l.esiEmployer) : "—"}</TD>
                      <TD className="text-right">{l.pt ? formatINR(l.pt) : "—"}</TD>
                    </TR>
                  ))}
                  <TR>
                    <TD colSpan={2} className="font-bold">TOTAL</TD>
                    <TD className="text-right font-bold">{formatINR(lines.reduce((s, l) => s + l.basic, 0))}</TD>
                    <TD className="text-right font-bold">{formatINR(summary.pfEmployee)}</TD>
                    <TD className="text-right font-bold">{formatINR(summary.pfEmployer)}</TD>
                    <TD className="text-right font-bold">{formatINR(summary.esiEmployee)}</TD>
                    <TD className="text-right font-bold">{formatINR(summary.esiEmployer)}</TD>
                    <TD className="text-right font-bold">{formatINR(summary.pt)}</TD>
                  </TR>
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gratuity">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div><CardTitle>Gratuity liability</CardTitle><CardDescription>Last basic × 15/26 × completed years · payable at 5+ years</CardDescription></div>
              <Button variant="outline" size="sm" onClick={exportGratuity}><FileSpreadsheet className="h-4 w-4" /> Export</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <THead><TR><TH>Emp</TH><TH className="text-center">Years</TH><TH>Eligibility</TH><TH className="text-right">Gratuity accrued</TH></TR></THead>
                <TBody>
                  {active.map((e) => { const g = gratuity(e); return (
                    <TR key={e.id}>
                      <TD className="font-medium">{e.name}<div className="text-[10px] font-normal text-muted-foreground">{e.role}</div></TD>
                      <TD className="text-center">{g.years}</TD>
                      <TD>{g.eligible ? <Badge tone="success">Eligible</Badge> : <Badge tone="muted">Vesting</Badge>}</TD>
                      <TD className="text-right font-semibold">{formatINR(g.amount)}</TD>
                    </TR>
                  ); })}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bonus">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div><CardTitle>Statutory bonus provision</CardTitle><CardDescription>Payment of Bonus Act — 8.33% on capped basic (annual)</CardDescription></div>
              <Button variant="outline" size="sm" onClick={exportBonus}><FileSpreadsheet className="h-4 w-4" /> Export</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <THead><TR><TH>Emp</TH><TH>Category</TH><TH className="text-right">Annual bonus (8.33%)</TH></TR></THead>
                <TBody>
                  {active.map((e) => (
                    <TR key={e.id}>
                      <TD className="font-medium">{e.name}</TD>
                      <TD className="text-muted-foreground">{e.wageType}</TD>
                      <TD className="text-right font-semibold">{formatINR(annualBonus(e))}</TD>
                    </TR>
                  ))}
                  <TR><TD colSpan={2} className="font-bold">TOTAL</TD><TD className="text-right font-bold text-success">{formatINR(summary.annualBonus)}</TD></TR>
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Statutory rates</CardTitle><CardDescription>Configured in <code className="text-[11px]">src/lib/statutory.ts</code> — review against current EPFO / ESIC / state PT rules</CardDescription></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {[
                ["Provident Fund (PF)", `${(STATUTORY.pfRate * 100).toFixed(0)}% employee + ${(STATUTORY.pfRate * 100).toFixed(0)}% employer · ceiling ${formatINR(STATUTORY.pfWageCeiling)}`],
                ["Pension (EPS)", `${(STATUTORY.epsRate * 100).toFixed(2)}% of ceiling (within employer PF)`],
                ["ESI", `${(STATUTORY.esiEmployee * 100).toFixed(2)}% employee + ${(STATUTORY.esiEmployer * 100).toFixed(2)}% employer · up to ${formatINR(STATUTORY.esiWageCeiling)} gross`],
                ["Professional Tax", `Up to ${formatINR(STATUTORY.ptMonthly)}/month (slab)`],
                ["Statutory Bonus", `${(STATUTORY.bonusRate * 100).toFixed(2)}% on min(basic, ${formatINR(STATUTORY.bonusCalcCeiling)})`],
                ["Gratuity", `15/26 × years · after ${STATUTORY.gratuityYears} years`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border p-3"><p className="flex items-center gap-2 text-xs font-bold"><Coins className="h-3.5 w-3.5 text-primary" /> {k}</p><p className="mt-1 text-xs text-muted-foreground">{v}</p></div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

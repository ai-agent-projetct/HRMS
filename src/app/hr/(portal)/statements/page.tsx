"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { downloadExcel } from "@/lib/excel";
import { useHr } from "@/stores/hr";
import { WORKER_CATEGORIES, categoryById, type WorkerCategoryId } from "@/lib/hr-master";
import { statementRow, downloadWageStatement, type StmtCtx, type StmtLayout } from "@/lib/wage-statement";
import { formatINR } from "@/lib/utils";
import { FileText, FileSpreadsheet, Receipt, Users, Wallet, Eye } from "lucide-react";

const MONTHLY_CATS: WorkerCategoryId[] = ["PERMANENT", "STAFF", "SEMISTAFF", "UNIT_CHANGE", "MC_OTHERS"];
const layoutFor = (c: WorkerCategoryId): StmtLayout => (MONTHLY_CATS.includes(c) ? "monthly" : "daywage");

const PERIOD = { periodFrom: "01/Jul/2026", periodTo: "31/Jul/2026", monthLabel: "July 2026", paidOn: "7th August 2026" };

export default function StatementsPage() {
  const employees = useHr((s) => s.employees);
  const attendance = useHr((s) => s.attendance);
  const advances = useHr((s) => s.advances);
  const deductions = useHr((s) => s.deductions);
  const push = useToast((s) => s.push);
  const ctx: StmtCtx = useMemo(() => ({ attendance, advances, deductions }), [attendance, advances, deductions]);
  const [preview, setPreview] = useState<WorkerCategoryId | null>(null);

  const groups = useMemo(() => WORKER_CATEGORIES.map((c) => {
    const emps = employees.filter((e) => e.category === c.id && e.status !== "Exited");
    const rows = emps.map((e) => statementRow(e, ctx));
    const gross = rows.reduce((s, r) => s + r.gross, 0);
    const net = rows.reduce((s, r) => s + r.net, 0);
    return { c, emps, rows, gross, net, layout: layoutFor(c.id) };
  }).filter((g) => g.emps.length > 0), [employees, ctx]);

  const totalHeads = groups.reduce((s, g) => s + g.emps.length, 0);
  const totalNet = groups.reduce((s, g) => s + g.net, 0);

  const download = (g: (typeof groups)[number]) => {
    downloadWageStatement({ categoryLabel: g.c.label, layout: g.layout, rows: g.rows, ...PERIOD });
    push(`Statement downloaded — ${g.c.label}`, `${g.emps.length} workers · net ${formatINR(g.net)} · Lucida Console format.`);
  };

  const excel = (g: (typeof groups)[number]) =>
    downloadExcel({
      filename: `wage-statement-${g.c.id.toLowerCase()}`, sheetName: g.c.label.slice(0, 28), title: `Wage Statement — ${g.c.label} — ${PERIOD.monthLabel}`,
      columns: [
        { header: "T.No", key: "token" }, { header: "Name", key: "name", width: 22 },
        ...(g.layout === "monthly"
          ? [{ header: "Wkd", key: "workedDays" }, { header: "Basic", key: "basic" }, { header: "Spl.Al", key: "spl" }, { header: "HRA", key: "hra" }]
          : [{ header: "T.Days", key: "totalDays" }, { header: "Wkd", key: "workedDays" }, { header: "Wage/Day", key: "wagePerDay" }, { header: "Incentive", key: "incentive" }]),
        { header: "Gross", key: "gross" }, { header: "PF", key: "pf" }, { header: "ESI", key: "esi" },
        { header: "ADV", key: "adv" }, { header: "MESS", key: "mess" }, { header: "Deductions", key: "totalDed" }, { header: "Net", key: "net" },
      ],
      rows: g.rows as unknown as Record<string, unknown>[],
    });

  const previewG = groups.find((g) => g.c.id === preview);

  return (
    <>
      <PageHeader
        title="Wage Statements"
        description="Category-wise Monthly Wages Statements in the company mwages format (Lucida Console). Download the exact printable statement per category."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Categories" value={`${groups.length}`} icon={Receipt} sub="with workers this month" />
        <KpiCard label="Workers" value={`${totalHeads}`} icon={Users} sub={PERIOD.monthLabel} tone="info" />
        <KpiCard label="Net payable" value={formatINR(totalNet, true)} icon={Wallet} sub="all statements" tone="success" />
        <KpiCard label="Format" value="mwages" icon={FileText} sub="Lucida Console · exact" tone="warning" />
      </div>

      <Card>
        <CardContent className="py-3">
          <p className="mb-3 text-sm font-bold">Monthly Wages Statement — {PERIOD.monthLabel}</p>
          <Table>
            <THead><TR><TH>Category</TH><TH>Layout</TH><TH className="text-right">Workers</TH><TH className="text-right">Gross</TH><TH className="text-right">Net</TH><TH className="text-right">Statement</TH></TR></THead>
            <TBody>
              {groups.map((g) => (
                <TR key={g.c.id}>
                  <TD className="font-medium">{g.c.label}</TD>
                  <TD><Badge tone={g.layout === "monthly" ? "info" : "warning"}>{g.layout === "monthly" ? "Staff (basic+DA)" : "Day-wage"}</Badge></TD>
                  <TD className="text-right">{g.emps.length}</TD>
                  <TD className="text-right">{formatINR(g.gross)}</TD>
                  <TD className="text-right font-semibold text-success">{formatINR(g.net)}</TD>
                  <TD>
                    <div className="flex items-center justify-end gap-1.5">
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => setPreview(g.c.id)}><Eye className="h-3 w-3" /> Preview</Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => excel(g)}><FileSpreadsheet className="h-3 w-3" /> Excel</Button>
                      <Button size="sm" className="h-7 px-2 text-[11px]" onClick={() => download(g)}><FileText className="h-3 w-3" /> Download statement</Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">“Download statement” produces the printable PDF in the exact <span className="font-semibold">mwages</span> layout and Lucida Console font, per category.</p>
        </CardContent>
      </Card>

      {previewG && (
        <Card>
          <CardContent className="py-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold">{previewG.c.label} — statement preview ({previewG.emps.length})</p>
              <Button size="sm" onClick={() => download(previewG)}><FileText className="h-4 w-4" /> Download this statement</Button>
            </div>
            <div className="overflow-x-auto rounded-md border bg-muted/30 p-3">
              <table className="w-full font-mono text-[11px]">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="px-1 text-left">T.No</th><th className="px-1 text-left">Name</th>
                    {previewG.layout === "monthly"
                      ? <><th className="px-1 text-right">Wkd</th><th className="px-1 text-right">Basic</th><th className="px-1 text-right">Spl.Al</th><th className="px-1 text-right">HRA</th></>
                      : <><th className="px-1 text-right">Wkd</th><th className="px-1 text-right">W/Day</th><th className="px-1 text-right">Incen</th></>}
                    <th className="px-1 text-right">Gross</th><th className="px-1 text-right">PF</th><th className="px-1 text-right">ESI</th><th className="px-1 text-right">ADV</th><th className="px-1 text-right">MESS</th><th className="px-1 text-right">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {previewG.rows.map((r, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="px-1">{r.token}</td><td className="px-1">{r.name}</td>
                      {previewG.layout === "monthly"
                        ? <><td className="px-1 text-right">{r.workedDays}</td><td className="px-1 text-right">{r.basic.toLocaleString("en-IN")}</td><td className="px-1 text-right">{r.spl.toLocaleString("en-IN")}</td><td className="px-1 text-right">{r.hra.toLocaleString("en-IN")}</td></>
                        : <><td className="px-1 text-right">{r.workedDays}</td><td className="px-1 text-right">{r.wagePerDay.toLocaleString("en-IN")}</td><td className="px-1 text-right">{r.incentive.toLocaleString("en-IN")}</td></>}
                      <td className="px-1 text-right">{r.gross.toLocaleString("en-IN")}</td><td className="px-1 text-right">{r.pf.toLocaleString("en-IN")}</td><td className="px-1 text-right">{r.esi.toLocaleString("en-IN")}</td><td className="px-1 text-right">{r.adv.toLocaleString("en-IN")}</td><td className="px-1 text-right">{r.mess.toLocaleString("en-IN")}</td><td className="px-1 text-right font-bold">{r.net.toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

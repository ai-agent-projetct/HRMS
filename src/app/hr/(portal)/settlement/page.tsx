"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { downloadExcel } from "@/lib/excel";
import { downloadSettlementPdf } from "@/lib/pdf";
import { useHr, attendanceFor, deductionFor, outstandingAdvance } from "@/stores/hr";
import { settlement, type Settlement } from "@/lib/statutory";
import { categoryById } from "@/lib/hr-master";
import { amountInWords } from "@/lib/payroll";
import type { HrEmployee } from "@/lib/hr-data";
import { formatINR } from "@/lib/utils";
import { UserMinus, LogOut, Award, Wallet, FileSpreadsheet, FileText, Eye } from "lucide-react";

export default function SettlementPage() {
  const employees = useHr((s) => s.employees);
  const attendance = useHr((s) => s.attendance);
  const advances = useHr((s) => s.advances);
  const deductions = useHr((s) => s.deductions);
  const push = useToast((s) => s.push);
  const [view, setView] = useState<{ e: HrEmployee; s: Settlement } | null>(null);

  // Separating / separated workers.
  const leavers = employees.filter((e) => e.status === "Exited" || e.status === "On Notice" || e.conduct === "Absconded" || e.conduct === "Exited");

  const settleFor = (e: HrEmployee): Settlement => {
    const a = attendanceFor(attendance, e.id);
    const pendingWages = e.wageType === "Monthly" ? e.monthlyGross : Math.round((e.salaryPerDay ?? 0) * (a?.daysWorked ?? 0));
    return settlement(e, {
      pendingWages,
      outstandingAdvance: outstandingAdvance(advances, e.id),
      messDue: deductionFor(deductions, e.id).mess,
    });
  };

  const rows = leavers.map((e) => ({ e, s: settleFor(e) }));
  const totalPayable = rows.reduce((sum, r) => sum + Math.max(0, r.s.net), 0);
  const gratuityDue = rows.filter((r) => r.s.gratuity.eligible).length;

  const exportAll = () =>
    downloadExcel({
      filename: "full-final-settlements", sheetName: "F&F Settlements", title: "Full & Final Settlements",
      columns: [
        { header: "Emp ID", key: "id" }, { header: "Name", key: "name", width: 22 }, { header: "Status", key: "status" },
        { header: "Credits ₹", key: "cr" }, { header: "Debits ₹", key: "db" }, { header: "Gratuity ₹", key: "grat" }, { header: "Net Payable ₹", key: "net" },
      ],
      rows: rows.map((r) => ({ id: r.e.id, name: r.e.name, status: r.e.status, cr: r.s.totalCredits, db: r.s.totalDebits, grat: r.s.gratuity.eligible ? r.s.gratuity.amount : 0, net: r.s.net })),
    });

  const exportOne = (e: HrEmployee, s: Settlement) =>
    downloadExcel({
      filename: `settlement-${e.id}`, sheetName: "Settlement", title: `Full & Final Settlement — ${e.name} (${e.id})`,
      columns: [{ header: "Component", key: "label", width: 30 }, { header: "Credit ₹", key: "cr" }, { header: "Debit ₹", key: "db" }],
      rows: [
        ...s.lines.map((l) => ({ label: l.label, cr: l.kind === "credit" ? l.amount : "", db: l.kind === "debit" ? l.amount : "" })),
        { label: "NET SETTLEMENT", cr: s.net, db: "" },
      ] as unknown as Record<string, unknown>[],
    });

  return (
    <>
      <PageHeader
        title="Full & Final Settlement"
        description="Exit settlements for separating & absconded workers — pending wages, leave encashment, gratuity and bonus, net of advances and dues"
        actions={<Button variant="outline" size="sm" onClick={exportAll}><FileSpreadsheet className="h-4 w-4" /> Export all</Button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="To settle" value={`${rows.length}`} icon={UserMinus} sub="exited / on notice / absconded" tone="warning" />
        <KpiCard label="Net payable" value={formatINR(totalPayable, true)} icon={Wallet} sub="across all settlements" tone="success" />
        <KpiCard label="Gratuity due" value={`${gratuityDue}`} icon={Award} sub="5+ years eligible" tone="info" />
        <KpiCard label="Exited (final)" value={`${employees.filter((e) => e.status === "Exited").length}`} icon={LogOut} sub="off the active roll" tone="danger" />
      </div>

      <Card>
        <CardContent className="py-3">
          <p className="mb-3 text-sm font-bold">Settlements pending</p>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No separating workers — everyone is active.</p>
          ) : (
            <Table>
              <THead><TR><TH>Employee</TH><TH>Status</TH><TH className="text-right">Credits</TH><TH className="text-right">Debits</TH><TH className="text-right">Gratuity</TH><TH className="text-right">Net payable</TH><TH></TH></TR></THead>
              <TBody>
                {rows.map((r) => (
                  <TR key={r.e.id}>
                    <TD className="font-medium">{r.e.name}<div className="text-[10px] font-normal text-muted-foreground">{r.e.id} · {categoryById(r.e.category)?.label}</div></TD>
                    <TD><Badge tone={r.e.status === "Exited" ? "danger" : "warning"}>{r.e.status}{r.e.conduct === "Absconded" ? " · Absconded" : ""}</Badge></TD>
                    <TD className="text-right text-success">{formatINR(r.s.totalCredits)}</TD>
                    <TD className="text-right text-danger">{formatINR(r.s.totalDebits)}</TD>
                    <TD className="text-right">{r.s.gratuity.eligible ? formatINR(r.s.gratuity.amount) : <span className="text-muted-foreground">—</span>}</TD>
                    <TD className="text-right font-bold">{formatINR(r.s.net)}</TD>
                    <TD><Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => setView({ e: r.e, s: r.s })}><Eye className="h-3 w-3" /> Statement</Button></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {view && (
        <Modal title={`Settlement — ${view.e.name}`} description={`${view.e.id} · ${view.e.status} · ${view.s.gratuity.years} yrs service`} onClose={() => setView(null)} wide>
          <Table>
            <THead><TR><TH>Component</TH><TH className="text-right">Credit</TH><TH className="text-right">Debit</TH></TR></THead>
            <TBody>
              {view.s.lines.map((l) => (
                <TR key={l.label}>
                  <TD>{l.label}</TD>
                  <TD className="text-right text-success">{l.kind === "credit" ? formatINR(l.amount) : ""}</TD>
                  <TD className="text-right text-danger">{l.kind === "debit" ? formatINR(l.amount) : ""}</TD>
                </TR>
              ))}
              <TR><TD className="font-bold">Totals</TD><TD className="text-right font-bold text-success">{formatINR(view.s.totalCredits)}</TD><TD className="text-right font-bold text-danger">{formatINR(view.s.totalDebits)}</TD></TR>
            </TBody>
          </Table>
          <div className="mt-4 flex items-center justify-between rounded-lg bg-success/10 px-4 py-3">
            <div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Net settlement payable</p><p className="text-[11px] text-muted-foreground">{amountInWords(view.s.net)}</p></div>
            <p className="text-2xl font-bold text-success">{formatINR(view.s.net)}</p>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => { exportOne(view.e, view.s); push("Settlement exported", `settlement-${view.e.id}.xlsx`); }}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
            <Button onClick={async () => { await downloadSettlementPdf(view.e, view.s); push("Settlement PDF downloaded", `settlement-${view.e.id}.pdf`); }}><FileText className="h-4 w-4" /> PDF statement</Button>
          </div>
        </Modal>
      )}
    </>
  );
}

"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { downloadExcel } from "@/lib/excel";
import { useHr } from "@/stores/hr";
import { buildPayslip } from "@/lib/payroll";
import { formatINR } from "@/lib/utils";
import { ArrowLeftRight, Landmark, Banknote, ShieldCheck, FileSpreadsheet, Send, CheckCircle2 } from "lucide-react";

export default function TransferPage() {
  const employees = useHr((s) => s.employees);
  const transfers = useHr((s) => s.transfers);
  const addTransfer = useHr((s) => s.addTransfer);
  const setTransferStatus = useHr((s) => s.setTransferStatus);
  const push = useToast((s) => s.push);
  const [bank, setBank] = useState("HDFC Corporate Net Banking");

  const rows = employees.map((e) => ({ e, net: buildPayslip(e.monthlyGross, e.leave.lopThisMonth, 0).netPay }));
  const total = rows.reduce((s, r) => s + r.net, 0);
  const withBank = rows.filter((r) => r.e.bankHistory.length > 0);

  const downloadBankFile = () =>
    downloadExcel({
      filename: "salary-bank-transfer-jun2026",
      sheetName: "NEFT Batch",
      title: "Salary Bank Transfer (NEFT batch) — June 2026",
      columns: [
        { header: "Beneficiary", key: "name", width: 22 }, { header: "Bank", key: "bank", width: 22 },
        { header: "Account No", key: "account", width: 16 }, { header: "IFSC", key: "ifsc", width: 14 },
        { header: "Amount ₹", key: "amount" }, { header: "Narration", key: "narration", width: 24 },
      ],
      rows: withBank.map((r) => ({
        name: r.e.name, bank: r.e.bankHistory.at(-1)?.bank ?? "—", account: r.e.bankHistory.at(-1)?.account ?? "—",
        ifsc: r.e.bankHistory.at(-1)?.ifsc ?? "—", amount: r.net, narration: `SAL JUN26 ${r.e.id}`,
      })),
    });

  const createBatch = () => {
    const file = "SAL-JUN26.neft";
    addTransfer({ month: "June 2026", count: withBank.length, total: withBank.reduce((s, r) => s + r.net, 0), bankFile: file, status: "Draft" });
    push("Transfer batch created", `${withBank.length} beneficiaries · ${formatINR(withBank.reduce((s, r) => s + r.net, 0), true)}. NEFT file ready to push to ${bank}.`);
  };

  const pushToBank = (id: string) => {
    setTransferStatus(id, "Sent to Bank");
    push("Sent to bank", `NEFT batch pushed to ${bank} via the authorised net-banking API. Awaiting processing confirmation.`, "info");
  };

  return (
    <>
      <PageHeader
        title="Bank Transfer"
        description="Direct salary payout via corporate net-banking — generate the NEFT batch and push to the bank; posts to Finance automatically"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={downloadBankFile}><FileSpreadsheet className="h-4 w-4" /> NEFT file</Button>
            <Button size="sm" onClick={createBatch}><ArrowLeftRight className="h-4 w-4" /> Create batch</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Payout Total" value={formatINR(total, true)} icon={Banknote} sub={`${rows.length} employees`} />
        <KpiCard label="With Bank Details" value={`${withBank.length}/${rows.length}`} icon={Landmark} sub={rows.length - withBank.length + " pending bank"} tone={withBank.length === rows.length ? "success" : "warning"} />
        <KpiCard label="Net-banking" value="Enabled" icon={ShieldCheck} sub="HDFC / ICICI corporate" tone="success" />
        <KpiCard label="Batches" value={`${transfers.length}`} icon={Send} sub="this session" tone="info" />
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold">Beneficiary list — June 2026</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Push via</span>
              <select value={bank} onChange={(e) => setBank(e.target.value)} className="h-8 rounded-md border border-input bg-card px-2 text-xs">
                <option>HDFC Corporate Net Banking</option>
                <option>ICICI Corporate Net Banking</option>
                <option>SBI Corporate (CINB)</option>
              </select>
            </div>
          </div>
          <Table>
            <THead>
              <TR><TH>Employee</TH><TH>Bank</TH><TH>Account</TH><TH>IFSC</TH><TH className="text-right">Net Pay</TH><TH>Status</TH></TR>
            </THead>
            <TBody>
              {rows.map((r) => {
                const b = r.e.bankHistory.at(-1);
                return (
                  <TR key={r.e.id}>
                    <TD className="font-medium">{r.e.name}</TD>
                    <TD className="text-muted-foreground">{b?.bank ?? "—"}</TD>
                    <TD className="font-mono text-[11px]">{b?.account ?? "—"}</TD>
                    <TD className="font-mono text-[11px] text-muted-foreground">{b?.ifsc ?? "—"}</TD>
                    <TD className="text-right font-semibold">{formatINR(r.net)}</TD>
                    <TD>{b ? <Badge tone="success">Ready</Badge> : <Badge tone="danger">No bank</Badge>}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {transfers.length > 0 && (
        <Card>
          <CardContent className="py-3">
            <p className="mb-3 text-sm font-bold">Transfer batches</p>
            <Table>
              <THead><TR><TH>Created</TH><TH>Month</TH><TH className="text-right">Count</TH><TH className="text-right">Total</TH><TH>File</TH><TH>Status</TH><TH></TH></TR></THead>
              <TBody>
                {transfers.map((tb) => (
                  <TR key={tb.id}>
                    <TD className="text-muted-foreground">{tb.at}</TD>
                    <TD>{tb.month}</TD>
                    <TD className="text-right">{tb.count}</TD>
                    <TD className="text-right font-semibold">{formatINR(tb.total, true)}</TD>
                    <TD className="font-mono text-[11px] text-muted-foreground">{tb.bankFile}</TD>
                    <TD><Badge tone={tb.status === "Processed" ? "success" : tb.status === "Sent to Bank" ? "info" : "warning"}>{tb.status}</Badge></TD>
                    <TD>
                      {tb.status === "Draft" && <Button size="sm" className="h-6 px-2 text-[10px]" onClick={() => pushToBank(tb.id)}>Push to bank</Button>}
                      {tb.status === "Sent to Bank" && <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => { setTransferStatus(tb.id, "Processed"); push("Payout processed", `${tb.count} salaries credited. Finance day book updated; employees notified.`); }}><CheckCircle2 className="h-3 w-3" /> Confirm</Button>}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="rounded-md bg-accent p-3 text-xs leading-relaxed text-accent-foreground">
        <span className="font-semibold">How it works:</span> generate the NEFT beneficiary file → create a batch → push to the bank via the corporate net-banking API (once the bank enables API access for the account). On confirmation, a salary-payout Payment voucher posts to the Finance day book automatically, so Accounts and the CEO see the same figures.
      </div>
    </>
  );
}

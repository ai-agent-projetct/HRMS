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
import { useHr, attendanceFor, deductionFor, availableMonths, monthLabel, CURRENT_MONTH } from "@/stores/hr";
import { monthSalary } from "@/lib/payroll";
import type { HrEmployee } from "@/lib/hr-data";
import { formatINR } from "@/lib/utils";
import { usePeopleFilters } from "@/components/people-filters";
import { ArrowLeftRight, Landmark, Banknote, ShieldCheck, FileSpreadsheet, Send, CheckCircle2 } from "lucide-react";

export default function TransferPage() {
  const employees = useHr((s) => s.employees);
  const transfers = useHr((s) => s.transfers);
  const addTransfer = useHr((s) => s.addTransfer);
  const setTransferStatus = useHr((s) => s.setTransferStatus);
  const push = useToast((s) => s.push);
  const [bank, setBank] = useState("HDFC Corporate Net Banking");
  const pf = usePeopleFilters();
  const attendance = useHr((s) => s.attendance);
  const deductions = useHr((s) => s.deductions);
  const months = availableMonths(attendance);
  // salary month being paid — default the latest month with register figures
  const [month, setMonth] = useState(() => [...attendance].filter((a) => a.paid).map((a) => a.month).sort().pop() ?? CURRENT_MONTH);
  const tag = `${["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][Number(month.slice(5, 7)) - 1]}${month.slice(2, 4)}`;

  /** Account to credit: latest bank-history entry, else the bank fields on the master. */
  const acct = (e: HrEmployee) => {
    const h = e.bankHistory?.at(-1);
    if (h) return { bank: h.bank, account: h.account, ifsc: h.ifsc };
    return e.bankAccount ? { bank: e.bankName ?? "—", account: e.bankAccount, ifsc: e.bankIfsc ?? "—" } : null;
  };
  // Net pay for the month = exactly what Payroll shows (register figures where paid).
  const rows = employees.filter((e) => pf.match(e)).flatMap((e) => {
    const a = attendanceFor(attendance, e.id, month);
    if (!a || (!a.paid && a.daysWorked <= 0)) return [];
    const net = monthSalary(e, a, deductionFor(deductions, e.id, month)).net;
    return net > 0 ? [{ e, net, bank: acct(e) }] : [];
  });
  const total = rows.reduce((s, r) => s + r.net, 0);
  const withBank = rows.filter((r) => r.bank);

  const downloadBankFile = () =>
    downloadExcel({
      filename: `salary-bank-transfer-${month}`,
      sheetName: "NEFT Batch",
      title: `Salary Bank Transfer (NEFT batch) — ${monthLabel(month)}`,
      columns: [
        { header: "Beneficiary", key: "name", width: 22 }, { header: "Bank", key: "bank", width: 22 },
        { header: "Account No", key: "account", width: 16 }, { header: "IFSC", key: "ifsc", width: 14 },
        { header: "Amount ₹", key: "amount" }, { header: "Narration", key: "narration", width: 24 },
      ],
      rows: withBank.map((r) => ({
        name: r.e.name, bank: r.bank?.bank ?? "—", account: r.bank?.account ?? "—",
        ifsc: r.bank?.ifsc ?? "—", amount: r.net, narration: `SAL ${tag} ${r.e.id}`,
      })),
    });

  const createBatch = () => {
    const file = `SAL-${tag}.neft`;
    addTransfer({ month: monthLabel(month), count: withBank.length, total: withBank.reduce((s, r) => s + r.net, 0), bankFile: file, status: "Draft" });
    push("Transfer batch created", `${withBank.length} beneficiaries · ${formatINR(withBank.reduce((s, r) => s + r.net, 0), true)}. NEFT file ready to push to ${bank}.`);
  };

  const pushToBank = (id: string) => {
    setTransferStatus(id, "Sent to Bank");
    push("Marked as sent to bank", `Upload the NEFT file in ${bank} net banking and confirm once the bank processes it.`, "info");
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
            <div className="flex flex-wrap items-center gap-2"><p className="mr-1 text-sm font-bold">Beneficiary list</p>
              <select value={month} onChange={(e) => setMonth(e.target.value)} className="h-8 rounded-md border border-input bg-card px-2 text-xs font-medium" title="Salary month">
                {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
              {pf.ui}<span className="text-[11px] text-muted-foreground">{rows.length} shown</span></div>
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
                const b = r.bank;
                return (
                  <TR key={r.e.id}>
                    <TD className="font-medium">{r.e.name}<div className="font-mono text-[10px] font-normal text-muted-foreground">{r.e.id}</div></TD>
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
                      {tb.status === "Sent to Bank" && <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => { setTransferStatus(tb.id, "Processed"); push("Payout marked processed", `${tb.count} salaries recorded as credited by the bank.`); }}><CheckCircle2 className="h-3 w-3" /> Confirm</Button>}
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

"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { downloadExcel, downloadExcelWorkbook } from "@/lib/excel";
import {
  useHr, attendanceFor, deductionFor, advanceRecoveryFor, CURRENT_MONTH_LABEL,
} from "@/stores/hr";
import { buildPayslip, buildDailyPayslip, amountInWords, type Payslip } from "@/lib/payroll";
import { categoryById, shiftById } from "@/lib/hr-master";
import type { HrEmployee } from "@/lib/hr-data";
import { formatINR } from "@/lib/utils";
import { Banknote, IndianRupee, Landmark, Send, FileSpreadsheet, MessageSquare, Mail, Eye, Layers } from "lucide-react";

const MONTH = CURRENT_MONTH_LABEL;

export default function PayrollPage() {
  const employees = useHr((s) => s.employees);
  const attendance = useHr((s) => s.attendance);
  const advances = useHr((s) => s.advances);
  const deductions = useHr((s) => s.deductions);
  const logPayslip = useHr((s) => s.logPayslip);
  const payslipLog = useHr((s) => s.payslipLog);
  const push = useToast((s) => s.push);
  const [q, setQ] = useState("");
  const [wage, setWage] = useState<"All" | "Monthly" | "Weekly" | "Daily">("All");
  const [view, setView] = useState<{ e: HrEmployee; slip: Payslip } | null>(null);

  const slipFor = (e: HrEmployee): Payslip => {
    const a = attendanceFor(attendance, e.id);
    const ded = deductionFor(deductions, e.id);
    const adv = advanceRecoveryFor(advances, e.id);
    const pfOn = e.pfApplicable ?? (categoryById(e.category)?.statutory ?? true);
    const tdsOn = e.tdsApplicable ?? (e.wageType === "Monthly");
    if (e.wageType !== "Monthly") {
      return buildDailyPayslip({
        ratePerDay: e.salaryPerDay ?? 0, daysWorked: a?.daysWorked ?? 0, otHours: a?.otHours ?? 0,
        saturdaysWorked: a?.saturdaysWorked ?? 0, totalSaturdays: a?.totalSaturdays ?? 4,
        advanceRecovery: adv, messBill: ded.mess, others: ded.others,
        statutory: pfOn, tds: tdsOn,
      });
    }
    const base = buildPayslip(e.monthlyGross, a?.lop ?? e.leave.lopThisMonth, 0, { pf: pfOn, tds: tdsOn });
    const extra = [
      { label: "Advance Recovery", amount: adv },
      { label: "Mess Bill", amount: ded.mess },
      { label: "Other Deductions", amount: ded.others },
    ].filter((d) => d.amount > 0);
    const dd = [...base.deductions, ...extra];
    const totalDeductions = dd.reduce((s, d) => s + d.amount, 0);
    return { ...base, deductions: dd, totalDeductions, netPay: base.grossEarnings - totalDeductions };
  };

  const allRows = employees.map((e) => ({ e, slip: slipFor(e) }));
  const rows = allRows
    .filter((r) => wage === "All" || r.e.wageType === wage)
    .filter((r) => `${r.e.name} ${r.e.id} ${r.e.role} ${r.e.department}`.toLowerCase().includes(q.toLowerCase()));

  const gross = allRows.reduce((s, r) => s + r.slip.grossEarnings, 0);
  const ded = allRows.reduce((s, r) => s + r.slip.totalDeductions, 0);
  const net = allRows.reduce((s, r) => s + r.slip.netPay, 0);
  const pf = allRows.reduce((s, r) => s + (r.slip.deductions.find((d) => d.label.includes("PF"))?.amount ?? 0), 0);

  const sendAll = (channel: "WhatsApp" | "Email") => {
    rows.forEach((r) => logPayslip({ empId: r.e.id, empName: r.e.name, channel, month: MONTH, netPay: r.slip.netPay }));
    push(`Payslips sent via ${channel}`, `${rows.length} payslips dispatched via ${channel}. Delivery receipts logged.`);
  };

  const comp = (slip: Payslip, label: string) => slip.deductions.find((d) => d.label.includes(label))?.amount ?? 0;

  const exportRegister = () =>
    downloadExcel({
      filename: `payroll-register-${MONTH}`, sheetName: "Payroll", title: `Payroll Register — ${MONTH}`,
      columns: [
        { header: "Emp ID", key: "id" }, { header: "Name", key: "name", width: 20 }, { header: "Category", key: "category" },
        { header: "Wage", key: "wage" }, { header: "Days", key: "days" }, { header: "Gross ₹", key: "gross" },
        { header: "PF ₹", key: "pf" }, { header: "Advance ₹", key: "adv" }, { header: "Mess ₹", key: "mess" },
        { header: "Others ₹", key: "others" }, { header: "Net Pay ₹", key: "net" }, { header: "Bank", key: "bank", width: 22 },
      ],
      rows: allRows.map((r) => ({
        id: r.e.id, name: r.e.name, category: categoryById(r.e.category)?.label, wage: r.e.wageType,
        days: attendanceFor(attendance, r.e.id)?.daysWorked ?? "", gross: r.slip.grossEarnings,
        pf: comp(r.slip, "PF"), adv: comp(r.slip, "Advance"), mess: comp(r.slip, "Mess"), others: comp(r.slip, "Other"),
        net: r.slip.netPay, bank: `${r.e.bankHistory.at(-1)?.bank ?? "—"} ${r.e.bankHistory.at(-1)?.account ?? ""}`,
      })),
    });

  /** The full payroll pack: register, every earning and deduction line per
   *  worker, a category summary and the payslip dispatch log. */
  const bulkExport = () => {
    const lines = allRows.flatMap(({ e, slip }) => [
      ...slip.earnings.map((x) => ({ id: e.id, name: e.name, category: categoryById(e.category)?.label ?? e.category, kind: "Earning", label: x.label, amount: x.amount })),
      ...slip.deductions.map((x) => ({ id: e.id, name: e.name, category: categoryById(e.category)?.label ?? e.category, kind: "Deduction", label: x.label, amount: x.amount })),
    ]);
    const byCat = new Map<string, { workers: number; gross: number; ded: number; net: number }>();
    for (const { e, slip } of allRows) {
      const k = categoryById(e.category)?.label ?? e.category;
      const c = byCat.get(k) ?? { workers: 0, gross: 0, ded: 0, net: 0 };
      c.workers += 1; c.gross += slip.grossEarnings; c.ded += slip.totalDeductions; c.net += slip.netPay;
      byCat.set(k, c);
    }
    downloadExcelWorkbook({
      filename: `payroll-bulk-${MONTH}`,
      sheets: [
        {
          sheetName: "Register", title: `Payroll Register — ${MONTH}`,
          columns: [
            { header: "Emp ID", key: "id" }, { header: "Name", key: "name", width: 22 },
            { header: "Category", key: "category", width: 16 }, { header: "Unit", key: "unit" },
            { header: "Department", key: "dept", width: 16 }, { header: "Wage Type", key: "wageType" },
            { header: "Gross", key: "gross" }, { header: "PF", key: "pf" }, { header: "ESI", key: "esi" },
            { header: "Advance", key: "adv" }, { header: "Mess", key: "mess" },
            { header: "Total Deductions", key: "ded" }, { header: "Net Pay", key: "net" },
            { header: "Bank", key: "bank", width: 16 }, { header: "Account", key: "account", width: 20 },
            { header: "Salary Status", key: "status" },
          ],
          rows: allRows.map(({ e, slip }) => {
            const d = (m: string) => slip.deductions.find((x) => x.label.includes(m))?.amount ?? 0;
            return {
              id: e.id, name: e.name, category: categoryById(e.category)?.label ?? e.category, unit: e.unit ?? "",
              dept: e.department, wageType: e.wageType, gross: slip.grossEarnings,
              pf: d("PF"), esi: d("ESI"), adv: d("Advance"), mess: d("Mess"),
              ded: slip.totalDeductions, net: slip.netPay,
              bank: e.bankName ?? "", account: e.bankAccount ?? "", status: e.salaryStatus ?? "Paid",
            };
          }),
        },
        {
          sheetName: "Salary Lines", title: `Every Earning & Deduction Line — ${MONTH}`,
          columns: [
            { header: "Emp ID", key: "id" }, { header: "Name", key: "name", width: 22 },
            { header: "Category", key: "category", width: 16 }, { header: "Type", key: "kind" },
            { header: "Component", key: "label", width: 32 }, { header: "Amount", key: "amount" },
          ],
          rows: lines,
        },
        {
          sheetName: "Category Summary", title: `Payroll Summary by Category — ${MONTH}`,
          columns: [
            { header: "Category", key: "category", width: 20 }, { header: "Workers", key: "workers" },
            { header: "Gross", key: "gross" }, { header: "Deductions", key: "ded" }, { header: "Net", key: "net" },
          ],
          rows: [...byCat.entries()].map(([category, c]) => ({ category, ...c })),
        },
        {
          sheetName: "Payslip Log", title: `Payslip Dispatch Log — ${MONTH}`,
          columns: [
            { header: "Emp ID", key: "empId" }, { header: "Name", key: "empName", width: 22 },
            { header: "Channel", key: "channel" }, { header: "Month", key: "month", width: 16 },
            { header: "Net Pay", key: "netPay" }, { header: "Sent At", key: "at", width: 22 },
          ],
          rows: payslipLog as unknown as Record<string, unknown>[],
        },
      ],
    });
  };

  return (
    <>
      <PageHeader
        title="Payroll & Payslips"
        description={`${MONTH} — monthly staff and daily-wage workers in one register. Wages, incentives, PF/ESI, advance recovery, mess & other deductions → net pay.`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={bulkExport}><Layers className="h-4 w-4" /> Bulk export</Button>
            <Button variant="outline" size="sm" onClick={exportRegister}><FileSpreadsheet className="h-4 w-4" /> Export register</Button>
            <Button variant="outline" size="sm" onClick={() => sendAll("Email")}><Mail className="h-4 w-4" /> Email all</Button>
            <Button size="sm" onClick={() => sendAll("WhatsApp")}><MessageSquare className="h-4 w-4" /> WhatsApp all</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Gross Payroll" value={formatINR(gross, true)} icon={IndianRupee} sub={`${employees.length} workers`} />
        <KpiCard label="Total Deductions" value={formatINR(ded, true)} icon={Banknote} sub={`PF ${formatINR(pf, true)} + advance/mess/other`} tone="warning" />
        <KpiCard label="Net Payable" value={formatINR(net, true)} icon={Landmark} sub="via bank transfer" tone="success" />
        <KpiCard label="Payslips Sent" value={`${payslipLog.length}`} icon={Send} sub="WhatsApp + email" tone="info" />
      </div>

      <Card>
        <CardContent className="py-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {(["All", "Monthly", "Weekly", "Daily"] as const).map((w) => (
                <Button key={w} variant={wage === w ? "default" : "outline"} size="sm" className="h-7 px-2.5 text-[11px]" onClick={() => setWage(w)}>{w === "All" ? "All" : `${w} wage`}</Button>
              ))}
            </div>
            <Input placeholder="Search name, ID, role…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
          </div>
          <Table>
            <THead>
              <TR>
                <TH>Emp ID</TH><TH>Name</TH><TH>Category</TH><TH className="text-center">Days</TH>
                <TH className="text-right">Gross</TH><TH className="text-right">Deductions</TH><TH className="text-right">Net Pay</TH><TH>Payslip</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => {
                const a = attendanceFor(attendance, r.e.id);
                return (
                  <TR key={r.e.id}>
                    <TD className="font-mono text-xs text-muted-foreground">{r.e.id}</TD>
                    <TD className="font-medium">{r.e.name}<div className="text-xs font-normal text-muted-foreground">{r.e.wageType !== "Monthly" ? `₹${r.e.salaryPerDay}/day · ${r.e.wageType}` : r.e.role}</div></TD>
                    <TD><Badge tone="muted">{categoryById(r.e.category)?.label ?? r.e.category}</Badge></TD>
                    <TD className="text-center">{r.e.wageType !== "Monthly" ? (a?.daysWorked ?? 0) : "—"}</TD>
                    <TD className="text-right">{formatINR(r.slip.grossEarnings)}</TD>
                    <TD className="text-right text-danger">{formatINR(r.slip.totalDeductions)}</TD>
                    <TD className="text-right font-bold text-success">{formatINR(r.slip.netPay)}</TD>
                    <TD>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" className="h-6 w-6 p-0" title="View payslip" onClick={() => setView({ e: r.e, slip: r.slip })}><Eye className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="outline" className="h-6 w-6 p-0" title="WhatsApp" onClick={() => { logPayslip({ empId: r.e.id, empName: r.e.name, channel: "WhatsApp", month: MONTH, netPay: r.slip.netPay }); push(`Payslip sent — ${r.e.name}`, `WhatsApp to ${r.e.phone}.`); }}><MessageSquare className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TD>
                  </TR>
                );
              })}
              <TR>
                <TD colSpan={4} className="font-bold">TOTAL ({rows.length})</TD>
                <TD className="text-right font-bold">{formatINR(rows.reduce((s, r) => s + r.slip.grossEarnings, 0))}</TD>
                <TD className="text-right font-bold text-danger">{formatINR(rows.reduce((s, r) => s + r.slip.totalDeductions, 0))}</TD>
                <TD className="text-right font-bold text-success">{formatINR(rows.reduce((s, r) => s + r.slip.netPay, 0))}</TD>
                <TD />
              </TR>
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {payslipLog.length > 0 && (
        <Card>
          <CardContent className="py-3">
            <p className="mb-3 text-sm font-bold">Payslip dispatch log ({payslipLog.length})</p>
            <Table>
              <THead><TR><TH>Sent</TH><TH>Employee</TH><TH>Channel</TH><TH>Month</TH><TH className="text-right">Net</TH></TR></THead>
              <TBody>
                {payslipLog.slice(0, 12).map((p) => (
                  <TR key={p.id}>
                    <TD className="text-muted-foreground">{p.at}</TD>
                    <TD className="font-medium">{p.empName}</TD>
                    <TD><Badge tone={p.channel === "WhatsApp" ? "success" : "info"}>{p.channel}</Badge></TD>
                    <TD>{p.month}</TD>
                    <TD className="text-right">{formatINR(p.netPay)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {view && (
        <Modal title={`Payslip — ${view.e.name}`} description={`${MONTH} · ${view.e.id} · ${categoryById(view.e.category)?.label} · Shift ${shiftById(view.e.shiftId)?.code}`} onClose={() => setView(null)} wide>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Earnings</p>
              <Table>
                <TBody>
                  {view.slip.earnings.map((c) => (
                    <TR key={c.label}><TD className="py-1.5">{c.label}</TD><TD className="py-1.5 text-right">{formatINR(c.amount)}</TD></TR>
                  ))}
                  <TR><TD className="py-1.5 font-bold">Gross Earnings</TD><TD className="py-1.5 text-right font-bold">{formatINR(view.slip.grossEarnings)}</TD></TR>
                </TBody>
              </Table>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deductions</p>
              <Table>
                <TBody>
                  {view.slip.deductions.length === 0 && <TR><TD className="py-1.5 text-muted-foreground">None</TD><TD /></TR>}
                  {view.slip.deductions.map((c) => (
                    <TR key={c.label}><TD className="py-1.5">{c.label}</TD><TD className="py-1.5 text-right text-danger">{formatINR(c.amount)}</TD></TR>
                  ))}
                  <TR><TD className="py-1.5 font-bold">Total Deductions</TD><TD className="py-1.5 text-right font-bold text-danger">{formatINR(view.slip.totalDeductions)}</TD></TR>
                </TBody>
              </Table>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-lg bg-success/10 px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Net Pay</p>
              <p className="text-[11px] text-muted-foreground">{amountInWords(view.slip.netPay)}</p>
            </div>
            <p className="text-2xl font-bold text-success">{formatINR(view.slip.netPay)}</p>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => { logPayslip({ empId: view.e.id, empName: view.e.name, channel: "Email", month: MONTH, netPay: view.slip.netPay }); push(`Payslip emailed — ${view.e.name}`, `Email to ${view.e.email}.`); }}><Mail className="h-4 w-4" /> Email</Button>
            <Button onClick={() => { logPayslip({ empId: view.e.id, empName: view.e.name, channel: "WhatsApp", month: MONTH, netPay: view.slip.netPay }); push(`Payslip sent — ${view.e.name}`, `WhatsApp to ${view.e.phone}.`); }}><MessageSquare className="h-4 w-4" /> WhatsApp</Button>
          </div>
        </Modal>
      )}
    </>
  );
}

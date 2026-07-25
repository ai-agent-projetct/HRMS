"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FormModal } from "@/components/form-modal";
import { useToast } from "@/components/ui/toast";
import { downloadExcel } from "@/lib/excel";
import { Progress } from "@/components/ui/progress";
import { categoryById } from "@/lib/hr-master";
import { useHr, deductionFor, advanceProjection, CURRENT_MONTH_LABEL, type Advance } from "@/stores/hr";
import { formatINR } from "@/lib/utils";
import { HandCoins, Wallet, UtensilsCrossed, Receipt, Plus, FileSpreadsheet, IndianRupee, Pencil, Undo2 } from "lucide-react";

export default function AdvancesPage() {
  const employees = useHr((s) => s.employees);
  const advances = useHr((s) => s.advances);
  const deductions = useHr((s) => s.deductions);
  const addAdvance = useHr((s) => s.addAdvance);
  const recoverAdvance = useHr((s) => s.recoverAdvance);
  const editAdvance = useHr((s) => s.editAdvance);
  const reverseAdvance = useHr((s) => s.reverseAdvance);
  const setDeduction = useHr((s) => s.setDeduction);
  const push = useToast((s) => s.push);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Advance | null>(null);
  const [dq, setDq] = useState("");

  const totalOutstanding = advances.filter((a) => a.status === "Active").reduce((s, a) => s + (a.amount - a.recovered), 0);
  const thisMonthRecovery = advances.filter((a) => a.status === "Active").reduce((s, a) => s + Math.min(a.monthlyRecovery, a.amount - a.recovered), 0);
  const totalMess = deductions.reduce((s, d) => s + d.mess, 0);
  const totalOthers = deductions.reduce((s, d) => s + d.others, 0);

  const empName = (id: string) => employees.find((e) => e.id === id)?.name ?? id;
  const num = (v: string) => Math.max(0, Number(v) || 0);

  const exportAdvances = () =>
    downloadExcel({
      filename: "salary-advances", sheetName: "Advances", title: "Salary Advances",
      columns: [
        { header: "Advance ID", key: "id" }, { header: "Emp", key: "empName", width: 22 }, { header: "Date", key: "date" },
        { header: "Amount ₹", key: "amount" }, { header: "Recovered ₹", key: "recovered" }, { header: "Balance ₹", key: "balance" },
        { header: "Monthly ₹", key: "monthlyRecovery" }, { header: "Reason", key: "reason", width: 24 }, { header: "Status", key: "status" },
      ],
      rows: advances.map((a) => ({ ...a, balance: a.amount - a.recovered })),
    });

  const dedRows = employees
    .filter((e) => `${e.name} ${e.id}`.toLowerCase().includes(dq.toLowerCase()))
    .map((e) => ({ e, d: deductionFor(deductions, e.id) }))
    .filter((r) => r.e.category.startsWith("HOSTEL") || r.e.category === "ODISHA" || r.d.mess > 0 || r.d.others > 0 || dq !== "");

  const exportDeductions = () =>
    downloadExcel({
      filename: `mess-other-deductions-${CURRENT_MONTH_LABEL}`, sheetName: "Deductions", title: `Mess & Other Deductions — ${CURRENT_MONTH_LABEL}`,
      columns: [
        { header: "Emp ID", key: "id" }, { header: "Name", key: "name", width: 22 }, { header: "Category", key: "category" },
        { header: "Mess ₹", key: "mess" }, { header: "Others ₹", key: "others" }, { header: "Note", key: "othersNote", width: 24 },
      ],
      rows: dedRows.map((r) => ({ id: r.e.id, name: r.e.name, category: categoryById(r.e.category)?.label, mess: r.d.mess, others: r.d.others, othersNote: r.d.othersNote })),
    });

  return (
    <>
      <PageHeader
        title="Advances & Deductions"
        description="Salary advances with an automatic monthly recovery plan, plus hostel mess bills and other deductions — all flow into net pay"
        actions={<Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> New advance</Button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Outstanding advances" value={formatINR(totalOutstanding, true)} icon={Wallet} sub={`${advances.filter((a) => a.status === "Active").length} active`} tone="warning" />
        <KpiCard label="Recovery this month" value={formatINR(thisMonthRecovery, true)} icon={HandCoins} sub="deducted from pay" tone="info" />
        <KpiCard label="Mess bills" value={formatINR(totalMess, true)} icon={UtensilsCrossed} sub={CURRENT_MONTH_LABEL} />
        <KpiCard label="Other deductions" value={formatINR(totalOthers, true)} icon={Receipt} sub={CURRENT_MONTH_LABEL} tone="danger" />
      </div>

      <Tabs defaultValue="advances">
        <TabsList>
          <TabsTrigger value="advances">Salary Advances</TabsTrigger>
          <TabsTrigger value="mess">Mess & Other Deductions</TabsTrigger>
        </TabsList>

        <TabsContent value="advances">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div><CardTitle>Salary advances</CardTitle><CardDescription>“Recover” books this month’s instalment against the balance and reflects on the payslip</CardDescription></div>
              <Button variant="outline" size="sm" onClick={exportAdvances}><FileSpreadsheet className="h-4 w-4" /> Export</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <THead><TR><TH>ID</TH><TH>Employee</TH><TH className="text-right">Amount</TH><TH className="text-right">Balance</TH><TH className="w-44">Recovery</TH><TH>Completes</TH><TH>Status</TH><TH className="text-right">Actions</TH></TR></THead>
                <TBody>
                  {advances.map((a) => {
                    const bal = a.amount - a.recovered;
                    const pct = Math.round((a.recovered / a.amount) * 100);
                    const proj = advanceProjection(a);
                    return (
                      <TR key={a.id}>
                        <TD className="font-mono text-xs text-muted-foreground">{a.id}</TD>
                        <TD className="font-medium">{a.empName}<div className="text-xs font-normal text-muted-foreground">{a.reason} · {a.date}</div></TD>
                        <TD className="text-right">{formatINR(a.amount)}</TD>
                        <TD className="text-right font-semibold">{formatINR(bal)}</TD>
                        <TD>
                          <Progress value={pct} />
                          <div className="mt-1 text-[10px] text-muted-foreground">{formatINR(a.recovered)} of {formatINR(a.amount)} · <span className="font-semibold text-foreground">₹{a.monthlyRecovery}/mo</span></div>
                        </TD>
                        <TD className="text-xs">
                          {a.status === "Cleared" ? <span className="text-success">Cleared</span> : <><span className="font-semibold">{proj.completeLabel}</span><div className="text-[10px] text-muted-foreground">{proj.monthsLeft} mo left</div></>}
                        </TD>
                        <TD><Badge tone={a.status === "Cleared" ? "success" : "warning"}>{a.status}</Badge></TD>
                        <TD>
                          <div className="flex items-center justify-end gap-1">
                            {a.status === "Active" && (
                              <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" title="Book this month's instalment" onClick={() => { recoverAdvance(a.id, Math.min(a.monthlyRecovery, bal)); push(`Recovered ₹${Math.min(a.monthlyRecovery, bal)} from ${a.empName}`, `Balance now ${formatINR(Math.max(0, bal - a.monthlyRecovery))}.`); }}>
                                <IndianRupee className="h-3 w-3" /> Recover
                              </Button>
                            )}
                            {a.recovered > 0 && (
                              <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" title="Reverse last instalment" onClick={() => { reverseAdvance(a.id); push(`Reversed ₹${a.monthlyRecovery} for ${a.empName}`, "Last instalment added back to the balance."); }}>
                                <Undo2 className="h-3 w-3" /> Reverse
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" title="Edit monthly deduction" onClick={() => setEditing(a)}>
                              <Pencil className="h-3 w-3" /> Edit
                            </Button>
                          </div>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
              {advances.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No advances yet.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mess">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div><CardTitle>Mess & other deductions — {CURRENT_MONTH_LABEL}</CardTitle><CardDescription>Edit inline for hostel residents & any ad-hoc recoveries; flows into net pay</CardDescription></div>
              <div className="flex items-center gap-2">
                <Input placeholder="Search…" value={dq} onChange={(e) => setDq(e.target.value)} className="w-44" />
                <Button variant="outline" size="sm" onClick={exportDeductions}><FileSpreadsheet className="h-4 w-4" /> Export</Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <THead><TR><TH>Emp ID</TH><TH>Name</TH><TH>Category</TH><TH className="w-32">Mess ₹</TH><TH className="w-32">Others ₹</TH><TH>Note</TH></TR></THead>
                <TBody>
                  {dedRows.map((r) => (
                    <TR key={r.e.id}>
                      <TD className="font-mono text-xs text-muted-foreground">{r.e.id}</TD>
                      <TD className="font-medium">{r.e.name}</TD>
                      <TD><Badge tone="muted">{categoryById(r.e.category)?.label ?? r.e.category}</Badge></TD>
                      <TD><Input type="text" value={String(r.d.mess)} onChange={(ev) => setDeduction(r.e.id, { mess: num(ev.target.value) })} className="h-7 w-24" /></TD>
                      <TD><Input type="text" value={String(r.d.others)} onChange={(ev) => setDeduction(r.e.id, { others: num(ev.target.value) })} className="h-7 w-24" /></TD>
                      <TD><Input type="text" value={r.d.othersNote} placeholder="reason…" onChange={(ev) => setDeduction(r.e.id, { othersNote: ev.target.value })} className="h-7 w-44" /></TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              {dedRows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No hostel/deduction rows. Search a name to add a deduction for anyone.</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {addOpen && (
        <FormModal
          title="New salary advance"
          description="Advance is disbursed now and recovered monthly from the worker’s pay."
          submitLabel="Book advance"
          onClose={() => setAddOpen(false)}
          fields={[
            { name: "empId", label: "Employee", type: "select", options: employees.map((e) => `${e.id} — ${e.name}`), required: true },
            { name: "date", label: "Date", type: "date", required: true, defaultValue: "2026-07-25" },
            { name: "amount", label: "Advance amount (₹)", type: "number", required: true },
            { name: "monthlyRecovery", label: "Monthly recovery (₹)", type: "number", required: true, defaultValue: "2000" },
            { name: "reason", label: "Reason", required: true, placeholder: "Medical / festival / travel…" },
          ]}
          onSubmit={(v) => {
            const id = v.empId.split(" — ")[0];
            addAdvance({ empId: id, empName: empName(id), date: v.date, amount: Number(v.amount), monthlyRecovery: Number(v.monthlyRecovery), reason: v.reason });
            push(`Advance booked — ${empName(id)}`, `${formatINR(Number(v.amount))} at ₹${v.monthlyRecovery}/month recovery.`);
          }}
        />
      )}

      {editing && (
        <FormModal
          title={`Edit advance — ${editing.empName}`}
          description={`Recovered so far ${formatINR(editing.recovered)} of ${formatINR(editing.amount)}. Change the monthly deduction — the new amount applies from next payroll and updates the completion date.`}
          submitLabel="Update advance"
          onClose={() => setEditing(null)}
          fields={[
            { name: "amount", label: "Total advance (₹)", type: "number", required: true, defaultValue: String(editing.amount) },
            { name: "monthlyRecovery", label: "Monthly deduction (₹)", type: "number", required: true, defaultValue: String(editing.monthlyRecovery) },
            { name: "reason", label: "Reason", required: true, defaultValue: editing.reason },
          ]}
          onSubmit={(v) => {
            const monthlyRecovery = Number(v.monthlyRecovery);
            const amount = Number(v.amount);
            if (monthlyRecovery <= 0) return "Monthly deduction must be greater than zero.";
            editAdvance(editing.id, { amount, monthlyRecovery, reason: v.reason });
            const proj = advanceProjection({ ...editing, amount, monthlyRecovery });
            push(`Advance updated — ${editing.empName}`, `Now deducting ${formatINR(monthlyRecovery)}/month · ${formatINR(proj.remaining)} remaining · completes ${proj.completeLabel}.`);
          }}
        />
      )}
    </>
  );
}

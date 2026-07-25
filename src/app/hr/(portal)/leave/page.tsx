"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { FormModal } from "@/components/form-modal";
import { useToast } from "@/components/ui/toast";
import { useHr, leaveStatusTone, type LeaveType } from "@/stores/hr";
import { CalendarClock, CheckCircle2, Clock, XCircle, Plus } from "lucide-react";

export default function LeavePage() {
  const [applyOpen, setApplyOpen] = useState(false);
  const leave = useHr((s) => s.leave);
  const employees = useHr((s) => s.employees);
  const applyLeave = useHr((s) => s.applyLeave);
  const advanceLeave = useHr((s) => s.advanceLeave);
  const user = useHr((s) => s.user);
  const push = useToast((s) => s.push);

  const pending = leave.filter((l) => l.status === "Pending" || l.status === "Approved by Manager");
  const approved = leave.filter((l) => l.status === "Approved");
  const canFinalApprove = user?.role === "HR Manager" || user?.role === "Admin" || user?.role === "CEO";

  return (
    <>
      <PageHeader
        title="Leave Management"
        description="PL/EL, CL, SL and LOP — two-step Manager → HR approval; approvals reflect to the main Admin & Accounts"
        actions={<Button size="sm" onClick={() => setApplyOpen(true)}><Plus className="h-4 w-4" /> Apply leave</Button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Pending" value={`${leave.filter((l) => l.status === "Pending").length}`} icon={Clock} sub="awaiting manager" tone="warning" />
        <KpiCard label="Manager Approved" value={`${leave.filter((l) => l.status === "Approved by Manager").length}`} icon={CheckCircle2} sub="awaiting HR" tone="info" />
        <KpiCard label="Fully Approved" value={`${approved.length}`} icon={CheckCircle2} sub="posted to attendance" tone="success" />
        <KpiCard label="LOP Requests" value={`${leave.filter((l) => l.type === "LOP").length}`} icon={XCircle} sub="loss of pay" tone="danger" />
      </div>

      <Card>
        <CardContent className="py-3">
          <p className="mb-3 flex items-center gap-2 text-sm font-bold"><CalendarClock className="h-4 w-4 text-primary" /> Leave requests</p>
          <Table>
            <THead>
              <TR>
                <TH>ID</TH><TH>Employee</TH><TH>Type</TH><TH>From</TH><TH>To</TH>
                <TH className="text-right">Days</TH><TH>Reason</TH><TH>Status</TH><TH>Action</TH>
              </TR>
            </THead>
            <TBody>
              {leave.map((l) => (
                <TR key={l.id}>
                  <TD className="font-semibold text-primary">{l.id}</TD>
                  <TD className="font-medium">{l.empName}</TD>
                  <TD><Badge tone={l.type === "LOP" ? "danger" : "muted"}>{l.type}</Badge></TD>
                  <TD>{l.from}</TD>
                  <TD>{l.to}</TD>
                  <TD className="text-right">{l.days}</TD>
                  <TD className="max-w-[180px] truncate text-muted-foreground">{l.reason}</TD>
                  <TD><Badge tone={leaveStatusTone(l.status)}>{l.status}</Badge></TD>
                  <TD>
                    <div className="flex gap-1.5">
                      {l.status === "Pending" && (
                        <Button size="sm" className="h-6 px-2 text-[10px]" onClick={() => { advanceLeave(l.id, "approve", "Manager"); push(`${l.id} — Manager approved`, `${l.empName}'s ${l.type} forwarded to HR for final approval.`, "info"); }}>Manager OK</Button>
                      )}
                      {l.status === "Approved by Manager" && canFinalApprove && (
                        <Button size="sm" className="h-6 px-2 text-[10px]" onClick={() => { advanceLeave(l.id, "approve", "HR Manager"); push(`${l.id} approved`, `${l.empName}'s ${l.type} (${l.days}d) approved. Posted to attendance; reflected in Admin & Accounts. Employee notified on WhatsApp.`); }}>HR Approve</Button>
                      )}
                      {(l.status === "Pending" || l.status === "Approved by Manager") && (
                        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] text-danger" onClick={() => { advanceLeave(l.id, "reject", user?.role ?? "HR Manager"); push(`${l.id} rejected`, `${l.empName} notified.`, "danger"); }}>Reject</Button>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <div className="rounded-md bg-accent p-3 text-xs leading-relaxed text-accent-foreground">
        <span className="font-semibold">Workflow:</span> employee applies → line Manager approves → HR gives final approval. Approved leave updates the employee&apos;s balance, marks attendance, feeds LOP into payroll, and is recorded in the audit log for the CEO / Accounts.
      </div>

      {applyOpen && (
        <FormModal
          title="Apply Leave"
          submitLabel="Submit request"
          onClose={() => setApplyOpen(false)}
          fields={[
            { name: "emp", label: "Employee", type: "select", options: employees.map((e) => `${e.id} — ${e.name}`), required: true },
            { name: "type", label: "Leave type", type: "select", options: ["EL", "CL", "SL", "LOP"], required: true },
            { name: "from", label: "From", type: "date", required: true, defaultValue: "2026-07-21" },
            { name: "to", label: "To", type: "date", required: true, defaultValue: "2026-07-22" },
            { name: "reason", label: "Reason", required: true },
          ]}
          onSubmit={(v) => {
            const [empId, empName] = v.emp.split(" — ");
            const days = Math.max(1, Math.round((new Date(v.to).getTime() - new Date(v.from).getTime()) / 86400000) + 1);
            applyLeave({ empId, empName, type: v.type as LeaveType, from: v.from, to: v.to, days, reason: v.reason });
            push(`Leave applied — ${empName}`, `${v.type} ${days}d. Routed to line manager for approval.`);
          }}
        />
      )}
    </>
  );
}

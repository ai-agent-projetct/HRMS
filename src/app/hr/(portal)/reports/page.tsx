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
import { useHr, leaveStatusTone } from "@/stores/hr";
import { UserCheck, UserX, CalendarClock, Send, FileSpreadsheet, MessageSquare, Mail, ClipboardList, ListChecks } from "lucide-react";

type View = "present" | "lop_absent" | "approved" | "pending" | "requests" | "lop";

export default function ReportsPage() {
  const employees = useHr((s) => s.employees);
  const leave = useHr((s) => s.leave);
  const push = useToast((s) => s.push);
  const [sent, setSent] = useState(false);
  const [view, setView] = useState<View>("present");

  const present = employees.filter((e) => e.leave.lopThisMonth === 0 && e.status !== "Exited");
  const lopAbsent = employees.filter((e) => e.leave.lopThisMonth > 0);
  const approvedLeave = leave.filter((l) => l.status === "Approved");
  const pending = leave.filter((l) => l.status === "Pending" || l.status === "Approved by Manager");
  const lopItems = [
    ...leave.filter((l) => l.type === "LOP"),
    ...lopAbsent.map((e) => ({ id: `LOP-${e.id}`, empName: e.name, type: "LOP" as const, from: "This month", to: "—", days: e.leave.lopThisMonth, reason: "Loss of pay (unpaid days)", status: "Approved" as const })),
  ];

  const CARDS: { key: View; label: string; value: number; icon: typeof UserCheck; tone: "success" | "danger" | "info" | "warning" | "primary" }[] = [
    { key: "present", label: "Present", value: present.length, icon: UserCheck, tone: "success" },
    { key: "lop_absent", label: "LOP / Absent", value: lopAbsent.length, icon: UserX, tone: "danger" },
    { key: "approved", label: "On Approved Leave", value: approvedLeave.length, icon: CalendarClock, tone: "info" },
    { key: "pending", label: "Pending Requests", value: pending.length, icon: Send, tone: "warning" },
    { key: "requests", label: "Leave Status Requests", value: leave.length, icon: ListChecks, tone: "primary" },
    { key: "lop", label: "LOP", value: lopItems.length, icon: ClipboardList, tone: "danger" },
  ];

  const active = CARDS.find((c) => c.key === view)!;

  // Rows for the report Excel export track whatever is currently shown.
  const exportRows = useMemo(() => {
    switch (view) {
      case "present":
        return present.map((e) => ({ name: e.name, dept: e.department, detail: `EL ${e.leave.el} · CL ${e.leave.cl} · SL ${e.leave.sl}`, status: "Present" }));
      case "lop_absent":
        return lopAbsent.map((e) => ({ name: e.name, dept: e.department, detail: `${e.leave.lopThisMonth} LOP day(s)`, status: "LOP / Absent" }));
      case "approved":
        return approvedLeave.map((l) => ({ name: l.empName, dept: "—", detail: `${l.type} · ${l.from} → ${l.to}`, status: l.status }));
      case "pending":
        return pending.map((l) => ({ name: l.empName, dept: "—", detail: `${l.type} · ${l.from} → ${l.to} · ${l.days}d`, status: l.status }));
      case "requests":
        return leave.map((l) => ({ name: l.empName, dept: l.type, detail: `${l.from} → ${l.to} · ${l.reason}`, status: l.status }));
      case "lop":
        return lopItems.map((l) => ({ name: l.empName, dept: l.type, detail: `${l.from} → ${l.to} · ${l.reason}`, status: l.status }));
    }
  }, [view, present, lopAbsent, approvedLeave, pending, leave, lopItems]);

  const sendReport = (channel: "WhatsApp" | "Email") => {
    setSent(true);
    push(
      `Daily report sent via ${channel}`,
      `Manager report for 19 Jul 2026 dispatched: ${present.length} present, ${lopAbsent.length} LOP/absent, ${pending.length} leave requests pending. Also posted to the main Admin dashboard.`
    );
  };

  const exportReport = () =>
    downloadExcel({
      filename: `hr-daily-report-${view}-19jul2026`,
      sheetName: active.label.slice(0, 28),
      title: `HR Daily Report — ${active.label} — 19 Jul 2026`,
      columns: [{ header: "Employee", key: "name", width: 22 }, { header: "Department / Type", key: "dept", width: 20 }, { header: "Detail", key: "detail", width: 44 }, { header: "Status", key: "status", width: 20 }],
      rows: exportRows,
    });

  return (
    <>
      <PageHeader
        title="Daily Report"
        description="Click any card to filter the list — attendance, LOP, approved leave, pending & all leave requests. Also sent to managers and mirrored in the main Admin."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportReport}><FileSpreadsheet className="h-4 w-4" /> Export {active.label}</Button>
            <Button variant="outline" size="sm" onClick={() => sendReport("Email")}><Mail className="h-4 w-4" /> Email managers</Button>
            <Button size="sm" onClick={() => sendReport("WhatsApp")}><MessageSquare className="h-4 w-4" /> WhatsApp managers</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {CARDS.map((c) => (
          <KpiCard
            key={c.key}
            label={c.label}
            value={`${c.value}`}
            icon={c.icon}
            tone={c.tone}
            sub={view === c.key ? "▼ showing below" : "click to view"}
            onClick={() => setView(c.key)}
            active={view === c.key}
          />
        ))}
      </div>

      {sent && (
        <div className="flex items-center gap-2 rounded-md border border-success/40 bg-success/5 p-3 text-xs">
          <Send className="h-4 w-4 text-success" />
          <span>Report delivered to all department managers and mirrored on the management dashboard. Any approvals they make sync back here.</span>
        </div>
      )}

      <Card>
        <CardContent className="py-3">
          <p className="mb-3 flex items-center gap-2 text-sm font-bold">
            <active.icon className="h-4 w-4 text-primary" /> {active.label} — {active.value} {active.value === 1 ? "record" : "records"}
          </p>

          {view === "present" && (
            <Table>
              <THead><TR><TH>Employee</TH><TH>Department</TH><TH>PL / EL Remaining</TH><TH>Status</TH></TR></THead>
              <TBody>
                {present.map((e) => (
                  <TR key={e.id}>
                    <TD className="font-medium">{e.name}</TD>
                    <TD className="text-muted-foreground">{e.department}</TD>
                    <TD>EL {e.leave.el} · CL {e.leave.cl} · SL {e.leave.sl}</TD>
                    <TD><Badge tone="success">Present</Badge></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}

          {view === "lop_absent" && (
            <Table>
              <THead><TR><TH>Employee</TH><TH>Department</TH><TH className="text-right">LOP Days</TH><TH>Note</TH><TH>Status</TH></TR></THead>
              <TBody>
                {lopAbsent.map((e) => (
                  <TR key={e.id}>
                    <TD className="font-medium">{e.name}</TD>
                    <TD className="text-muted-foreground">{e.department}</TD>
                    <TD className="text-right font-semibold text-danger">{e.leave.lopThisMonth}</TD>
                    <TD className="text-muted-foreground">Loss of pay — unpaid days this month</TD>
                    <TD><Badge tone="danger">LOP / Absent</Badge></TD>
                  </TR>
                ))}
                {lopAbsent.length === 0 && <TR><TD colSpan={5} className="py-4 text-center text-xs text-muted-foreground">No LOP/absent today.</TD></TR>}
              </TBody>
            </Table>
          )}

          {(view === "approved" || view === "pending" || view === "requests" || view === "lop") && (
            <Table>
              <THead>
                <TR><TH>ID</TH><TH>Employee</TH><TH>Type</TH><TH>From</TH><TH>To</TH><TH className="text-right">Days</TH><TH>Reason</TH><TH>Status</TH></TR>
              </THead>
              <TBody>
                {(view === "approved" ? approvedLeave : view === "pending" ? pending : view === "lop" ? lopItems : leave).map((l) => (
                  <TR key={l.id}>
                    <TD className="font-semibold text-primary">{l.id}</TD>
                    <TD className="font-medium">{l.empName}</TD>
                    <TD><Badge tone={l.type === "LOP" ? "danger" : "muted"}>{l.type}</Badge></TD>
                    <TD>{l.from}</TD>
                    <TD>{l.to}</TD>
                    <TD className="text-right">{l.days}</TD>
                    <TD className="max-w-[220px] truncate text-muted-foreground">{l.reason}</TD>
                    <TD><Badge tone={leaveStatusTone(l.status)}>{l.status}</Badge></TD>
                  </TR>
                ))}
                {(view === "approved" ? approvedLeave : view === "pending" ? pending : view === "lop" ? lopItems : leave).length === 0 && (
                  <TR><TD colSpan={8} className="py-4 text-center text-xs text-muted-foreground">No records in this view.</TD></TR>
                )}
              </TBody>
            </Table>
          )}

        </CardContent>
      </Card>
    </>
  );
}

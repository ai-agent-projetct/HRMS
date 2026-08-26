"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { downloadExcel } from "@/lib/excel";
import { runGoLiveChecks, type CheckResult } from "@/lib/go-live-checks";
import { useHr, canLockData, canEditData, CURRENT_MONTH, CURRENT_MONTH_LABEL } from "@/stores/hr";
import { ShieldCheck, ShieldAlert, Lock, Unlock, FileSpreadsheet, ChevronRight, CircleCheck, AlertTriangle, Users } from "lucide-react";

export default function GoLivePage() {
  const employees = useHr((s) => s.employees);
  const attendance = useHr((s) => s.attendance);
  const advances = useHr((s) => s.advances);
  const deductions = useHr((s) => s.deductions);
  const dataLock = useHr((s) => s.dataLock);
  const user = useHr((s) => s.user);
  const setDataLock = useHr((s) => s.setDataLock);
  const push = useToast((s) => s.push);

  const [open, setOpen] = useState<CheckResult | null>(null);
  const [confirm, setConfirm] = useState<null | "lock" | "unlock">(null);

  const report = useMemo(
    () => runGoLiveChecks({ employees, attendance, advances, deductions, month: CURRENT_MONTH }),
    [employees, attendance, advances, deductions]
  );

  const mayLock = canLockData(user?.role);
  const mayEdit = canEditData(user?.role, dataLock.locked);
  const failing = report.checks.filter((c) => c.issues.length > 0);
  const passing = report.checks.filter((c) => c.issues.length === 0);

  const exportIssues = () =>
    downloadExcel({
      filename: "go-live-data-verification",
      sheetName: "Verification",
      title: `Go-Live Data Verification — ${CURRENT_MONTH_LABEL} — ${report.blocking} blocking, ${report.warnings} warnings`,
      columns: [
        { header: "Severity", key: "sev", width: 10 }, { header: "Module", key: "mod", width: 14 },
        { header: "Check", key: "chk", width: 34 }, { header: "Emp ID", key: "id", width: 12 },
        { header: "Employee", key: "name", width: 22 }, { header: "Issue", key: "detail", width: 60 },
        { header: "Why it matters", key: "impact", width: 60 },
      ],
      rows: failing.flatMap((c) => c.issues.map((i) => ({
        sev: c.severity === "blocking" ? "BLOCKING" : "Warning", mod: c.module, chk: c.label,
        id: i.empId ?? "", name: i.empName ?? "", detail: i.detail, impact: c.impact,
      }))),
    });

  const doLock = () => {
    const r = setDataLock(true, `Verified at go-live: ${report.employees} employees, 0 blocking issues, ${report.warnings} warning(s) accepted.`);
    if (!r.ok) return push("Couldn't lock", r.error);
    push("Data confirmed & locked", "Master data is frozen. Only CEO / Super Admin can edit from now on.");
    setConfirm(null);
  };
  const doUnlock = () => {
    const r = setDataLock(false, "Re-opened for correction");
    if (!r.ok) return push("Couldn't re-open", r.error);
    push("Data re-opened", "Master data is editable again — lock it back once corrected.");
    setConfirm(null);
  };

  return (
    <>
      <PageHeader
        title="Go-Live — Data Verification & Lock"
        description="Cross-checks every field that feeds salary, PF, ESI, OT, incentives and agent commission. Clear all blocking issues, then confirm to freeze the data."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportIssues} disabled={failing.length === 0}>
              <FileSpreadsheet className="h-4 w-4" /> Export issue list
            </Button>
            {mayLock && (dataLock.locked
              ? <Button size="sm" variant="outline" onClick={() => setConfirm("unlock")}><Unlock className="h-4 w-4" /> Re-open for editing</Button>
              : <Button size="sm" disabled={!report.ready} onClick={() => setConfirm("lock")}><Lock className="h-4 w-4" /> Confirm &amp; lock data</Button>)}
          </>
        }
      />

      {/* Lock status banner */}
      <Card className={dataLock.locked ? "border-success/40 bg-success/5" : "border-warning/40 bg-warning/5"}>
        <CardContent className="flex flex-wrap items-center gap-3 py-4">
          {dataLock.locked
            ? <ShieldCheck className="h-6 w-6 shrink-0 text-success" />
            : <ShieldAlert className="h-6 w-6 shrink-0 text-warning" />}
          <div className="flex-1">
            <p className="text-sm font-bold">
              {dataLock.locked ? "Data is LOCKED — live" : "Data-entry mode — master data is editable"}
            </p>
            <p className="text-xs text-muted-foreground">
              {dataLock.locked
                ? `Locked by ${dataLock.by} on ${dataLock.at}. Edit and delete controls are hidden for everyone except CEO and Super Admin.${dataLock.note ? ` ${dataLock.note}` : ""}`
                : "Admin and HR Manager can edit every field while you feed the old data. Once verification passes, confirm to freeze it — after that only CEO / Super Admin can change anything."}
            </p>
          </div>
          <Badge tone={mayEdit ? "success" : "muted"}>
            You ({user?.role}) {mayEdit ? "can edit" : "cannot edit"}
          </Badge>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Employees verified" value={`${report.employees}`} icon={Users} sub="on-roll (exited excluded)" />
        <KpiCard label="Blocking issues" value={`${report.blocking}`} icon={ShieldAlert} sub={report.blocking ? "must be zero to lock" : "clear"} tone={report.blocking ? "danger" : "success"} />
        <KpiCard label="Warnings" value={`${report.warnings}`} icon={AlertTriangle} sub="fix if you can" tone={report.warnings ? "warning" : "success"} />
        <KpiCard label="Checks passed" value={`${passing.length}/${report.checks.length}`} icon={CircleCheck} sub="validation rules" tone="info" />
      </div>

      {failing.length === 0 && (
        <Card className="border-success/40 bg-success/5">
          <CardContent className="flex items-center gap-3 py-5">
            <CircleCheck className="h-6 w-6 text-success" />
            <div>
              <p className="text-sm font-bold text-success">All {report.checks.length} checks passed</p>
              <p className="text-xs text-muted-foreground">The data is complete and internally consistent. Safe to confirm and lock.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {failing.length > 0 && (
        <Card>
          <CardContent className="py-3">
            <p className="mb-3 text-sm font-bold">Issues to fix ({failing.length} check{failing.length === 1 ? "" : "s"})</p>
            <Table>
              <THead>
                <TR><TH>Severity</TH><TH>Module</TH><TH>Check</TH><TH className="text-center">Count</TH><TH>Why it matters</TH><TH></TH></TR>
              </THead>
              <TBody>
                {failing.map((c) => (
                  <TR key={c.id} className="cursor-pointer" onClick={() => setOpen(c)}>
                    <TD><Badge tone={c.severity === "blocking" ? "danger" : "warning"}>{c.severity === "blocking" ? "Blocking" : "Warning"}</Badge></TD>
                    <TD className="text-xs">{c.module}</TD>
                    <TD className="font-medium">{c.label}</TD>
                    <TD className="text-center font-semibold">{c.issues.length}</TD>
                    <TD className="max-w-[380px] text-xs text-muted-foreground">{c.impact}</TD>
                    <TD className="text-right"><ChevronRight className="h-4 w-4 text-muted-foreground" /></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {passing.length > 0 && (
        <Card>
          <CardContent className="py-3">
            <p className="mb-2 text-sm font-bold">Passed ({passing.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {passing.map((c) => (
                <Badge key={c.id} tone="success"><CircleCheck className="h-3 w-3" /> {c.label}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {open && (
        <Modal title={open.label} description={`${open.module} · ${open.issues.length} record(s) · ${open.impact}`} onClose={() => setOpen(null)} wide>
          <div className="space-y-3">
            <div className="max-h-[52vh] overflow-auto rounded-lg border">
              <Table>
                <THead><TR><TH>Emp ID</TH><TH>Employee</TH><TH>Issue</TH><TH></TH></TR></THead>
                <TBody>
                  {open.issues.map((i, n) => (
                    <TR key={n}>
                      <TD className="font-mono text-xs text-muted-foreground">{i.empId ?? "—"}</TD>
                      <TD className="font-medium">{i.empName ?? "—"}</TD>
                      <TD className="text-xs">{i.detail}</TD>
                      <TD className="text-right">
                        {i.empId && (
                          <Link href={`/hr/employee/${i.empId}`}>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]">Open <ChevronRight className="h-3 w-3" /></Button>
                          </Link>
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
            <div className="flex justify-end"><Button variant="outline" onClick={() => setOpen(null)}>Close</Button></div>
          </div>
        </Modal>
      )}

      {confirm === "lock" && (
        <Modal title="Confirm data is correct & lock" description="This freezes the master data for go-live." onClose={() => setConfirm(null)}>
          <div className="space-y-4 text-sm">
            <p className="rounded-md bg-success/10 px-3 py-2 text-success">
              {report.employees} employees verified · 0 blocking issues{report.warnings ? ` · ${report.warnings} warning(s) accepted` : ""}.
            </p>
            <p className="text-muted-foreground">
              After locking, edit and delete controls disappear across every module for Admin, HR Manager, HR Executive and Manager.
              Only <b>CEO</b> and <b>Super Admin</b> keep the ability to change data. Every change stays recorded in the Audit Log.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
              <Button onClick={doLock}><Lock className="h-4 w-4" /> Yes — data is correct, lock it</Button>
            </div>
          </div>
        </Modal>
      )}

      {confirm === "unlock" && (
        <Modal title="Re-open data for editing" description="Unfreezes the master data." onClose={() => setConfirm(null)}>
          <div className="space-y-4 text-sm">
            <p className="rounded-md bg-warning/10 px-3 py-2 text-warning">
              These figures may already back a filed return. Re-opening is recorded in the Audit Log against your login.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
              <Button variant="danger" onClick={doUnlock}><Unlock className="h-4 w-4" /> Re-open for editing</Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

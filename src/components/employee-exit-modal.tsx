"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { EXIT_REASONS, type HrEmployee, type ExitRecord } from "@/lib/hr-data";
import { AGENTS, agentById, categoryById } from "@/lib/hr-master";
import { useHr, attendanceFor, deductionFor, outstandingAdvance, TODAY } from "@/stores/hr";
import { settlement } from "@/lib/statutory";
import { formatINR, formatDate } from "@/lib/utils";
import { LogOut, RotateCcw, AlertTriangle, CheckCircle2, Handshake, Wallet } from "lucide-react";

const selectCls = "flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const textareaCls = "w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-muted-foreground">
        {label}{required && <span className="text-danger"> *</span>}
      </label>
      {children}
    </div>
  );
}

/** Records an exit, or brings a previously-left worker back onto the rolls. */
export function EmployeeExitModal({
  employee, mode, onClose,
}: {
  employee: HrEmployee;
  mode: "leave" | "rejoin";
  onClose: () => void;
}) {
  const e = employee;
  const attendance = useHr((s) => s.attendance);
  const advances = useHr((s) => s.advances);
  const deductions = useHr((s) => s.deductions);
  const markLeft = useHr((s) => s.markLeft);
  const markRejoin = useHr((s) => s.markRejoin);
  const [error, setError] = useState("");

  // Live F&F figure so whoever records the exit sees what is still owed.
  const a = attendanceFor(attendance, e.id);
  const pendingWages = e.wageType === "Monthly" ? e.monthlyGross : Math.round((e.salaryPerDay ?? 0) * (a?.daysWorked ?? 0));
  const fnf = settlement(e, {
    pendingWages,
    outstandingAdvance: outstandingAdvance(advances, e.id),
    messDue: deductionFor(deductions, e.id).mess,
  });

  const [f, setF] = useState({
    exitDate: TODAY,
    lastWorkingDay: TODAY,
    reason: EXIT_REASONS[0] as string,
    reasonNote: "",
    noticeServed: true,
    agentIdAtExit: e.agentId ?? "",
    settled: false,
    settledOn: "",
    settledAmount: String(Math.max(0, fnf.net)),
    rehireEligible: true,
    remarks: "",
  });
  const [rejoin, setRejoin] = useState({ rejoinDate: TODAY, note: "" });

  const submitLeave = () => {
    if (!f.exitDate) return setError("Exit date is required.");
    if (f.settled && !f.settledOn) return setError("Enter the date the settlement was paid.");
    const exit: Omit<ExitRecord, "recordedBy" | "recordedAt"> = {
      exitDate: f.exitDate,
      lastWorkingDay: f.lastWorkingDay || undefined,
      reason: f.reason as ExitRecord["reason"],
      reasonNote: f.reasonNote.trim() || undefined,
      noticeServed: f.noticeServed,
      agentIdAtExit: f.agentIdAtExit || undefined,
      settled: f.settled,
      settledOn: f.settled ? f.settledOn : undefined,
      settledAmount: f.settled ? Number(f.settledAmount) || 0 : undefined,
      rehireEligible: f.rehireEligible,
      remarks: f.remarks.trim() || undefined,
    };
    const r = markLeft(e.id, exit);
    if (!r.ok) return setError(r.error);
    onClose();
  };

  const submitRejoin = () => {
    if (!rejoin.rejoinDate) return setError("Re-join date is required.");
    const r = markRejoin(e.id, { rejoinDate: rejoin.rejoinDate, note: rejoin.note.trim() || undefined });
    if (!r.ok) return setError(r.error);
    onClose();
  };

  if (mode === "rejoin") {
    return (
      <Modal
        title={`Re-join — ${e.name}`}
        description={`${e.id} · previously left ${e.exit ? formatDate(e.exit.exitDate) : "—"}`}
        onClose={onClose}
      >
        <div className="space-y-4">
          {e.exit && (
            <div className="rounded-lg border p-3 text-xs">
              <p className="font-semibold">Previous exit</p>
              <p className="mt-1 text-muted-foreground">
                {e.exit.reason} on {formatDate(e.exit.exitDate)}
                {e.exit.agentIdAtExit ? ` · via ${agentById(e.exit.agentIdAtExit)?.name}` : ""}
              </p>
              {e.exit.settled
                ? <Badge tone="success" className="mt-1"><CheckCircle2 className="h-3 w-3" /> Settled {e.exit.settledOn ? formatDate(e.exit.settledOn) : ""} {e.exit.settledAmount ? `· ${formatINR(e.exit.settledAmount)}` : ""}</Badge>
                : <Badge tone="danger" className="mt-1"><AlertTriangle className="h-3 w-3" /> Settlement was never marked paid</Badge>}
              {e.exit.rehireEligible === false && (
                <p className="mt-2 rounded-md bg-danger/10 px-2.5 py-1.5 font-semibold text-danger">
                  This worker was marked NOT eligible for rehire{e.exit.remarks ? ` — ${e.exit.remarks}` : ""}.
                </p>
              )}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Re-join date" required>
              <Input type="date" value={rejoin.rejoinDate} onChange={(ev) => setRejoin({ ...rejoin, rejoinDate: ev.target.value })} />
            </Field>
          </div>
          <Field label="Note">
            <textarea rows={2} className={textareaCls} value={rejoin.note} placeholder="e.g. Returned after harvest season; same department" onChange={(ev) => setRejoin({ ...rejoin, note: ev.target.value })} />
          </Field>
          <p className="rounded-md bg-info/10 px-3 py-2 text-xs text-info">
            The worker goes back on the roll as Active, conduct resets to Proper, and a Re-join is logged in the on-roll movement ledger. The previous exit is kept in their history.
          </p>
          {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-xs font-medium text-danger">{error}</p>}
          <div className="flex justify-end gap-2 border-t pt-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={submitRejoin}><RotateCcw className="h-4 w-4" /> Confirm re-join</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={`Mark as left — ${e.name}`}
      description={`${e.id} · ${categoryById(e.category)?.label ?? e.category} · ${e.department}`}
      onClose={onClose}
      wide
    >
      <div className="space-y-5">
        <section className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Exit</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Exit date" required><Input type="date" value={f.exitDate} onChange={(ev) => setF({ ...f, exitDate: ev.target.value })} /></Field>
            <Field label="Last working day"><Input type="date" value={f.lastWorkingDay} onChange={(ev) => setF({ ...f, lastWorkingDay: ev.target.value })} /></Field>
            <Field label="Reason" required>
              <select className={selectCls} value={f.reason} onChange={(ev) => setF({ ...f, reason: ev.target.value })}>
                {EXIT_REASONS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Reason detail"><Input value={f.reasonNote} placeholder="e.g. Going back to Odisha" onChange={(ev) => setF({ ...f, reasonNote: ev.target.value })} /></Field>
            <Field label="Agent at exit">
              <select className={selectCls} value={f.agentIdAtExit} onChange={(ev) => setF({ ...f, agentIdAtExit: ev.target.value })}>
                <option value="">Direct hire — no agent</option>
                {AGENTS.map((ag) => <option key={ag.id} value={ag.id}>{ag.name} · {ag.place}</option>)}
              </select>
            </Field>
            <div className="flex items-end gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-xs"><input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={f.noticeServed} onChange={(ev) => setF({ ...f, noticeServed: ev.target.checked })} /> Notice served</label>
              <label className="flex cursor-pointer items-center gap-2 text-xs"><input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={f.rehireEligible} onChange={(ev) => setF({ ...f, rehireEligible: ev.target.checked })} /> Eligible for rehire</label>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Full &amp; final settlement</p>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <THead><TR><TH>Component</TH><TH className="text-right">Credit</TH><TH className="text-right">Debit</TH></TR></THead>
              <TBody>
                {fnf.lines.map((l, i) => (
                  <TR key={i}>
                    <TD className="text-xs">{l.label}</TD>
                    <TD className="text-right text-xs">{l.kind === "credit" && l.amount ? formatINR(l.amount) : "—"}</TD>
                    <TD className="text-right text-xs">{l.kind === "debit" && l.amount ? formatINR(l.amount) : "—"}</TD>
                  </TR>
                ))}
                <TR className="border-t-2">
                  <TD className="font-bold">Net payable</TD>
                  <TD className="text-right font-bold text-success" colSpan={2}>{formatINR(fnf.net)}</TD>
                </TR>
              </TBody>
            </Table>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex items-end">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={f.settled} onChange={(ev) => setF({ ...f, settled: ev.target.checked })} />
                Fully settled
              </label>
            </div>
            <Field label="Settled on"><Input type="date" disabled={!f.settled} value={f.settledOn} onChange={(ev) => setF({ ...f, settledOn: ev.target.value })} /></Field>
            <Field label="Amount paid (₹)"><Input disabled={!f.settled} value={f.settledAmount} onChange={(ev) => setF({ ...f, settledAmount: ev.target.value })} /></Field>
          </div>
          {!f.settled && (
            <p className="flex items-center gap-2 rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
              <AlertTriangle className="h-3.5 w-3.5" /> Marked unsettled — {e.name} will show as <b>settlement pending</b> on the employee record and in Full &amp; Final Settlement.
            </p>
          )}
        </section>

        <Field label="Remarks">
          <textarea rows={2} className={textareaCls} value={f.remarks} placeholder="Anything HR should see if this person applies again" onChange={(ev) => setF({ ...f, remarks: ev.target.value })} />
        </Field>

        {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-xs font-medium text-danger">{error}</p>}
        <div className="flex justify-end gap-2 border-t pt-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={submitLeave}><LogOut className="h-4 w-4" /> Mark as left</Button>
        </div>
      </div>
    </Modal>
  );
}

/** Read-only exit summary — the "show entire details" view for a left worker. */
export function ExitDetails({ e }: { e: HrEmployee }) {
  if (!e.exit) return null;
  const x = e.exit;
  const ag = agentById(x.agentIdAtExit ?? e.agentId);
  return (
    <div className="space-y-2 rounded-lg border border-danger/40 bg-danger/5 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="danger"><LogOut className="h-3 w-3" /> Left</Badge>
        <span className="text-sm font-bold">{x.reason}</span>
        <span className="text-xs text-muted-foreground">on {formatDate(x.exitDate)}</span>
        {x.settled
          ? <Badge tone="success"><CheckCircle2 className="h-3 w-3" /> Fully settled</Badge>
          : <Badge tone="danger"><AlertTriangle className="h-3 w-3" /> Settlement pending</Badge>}
        {x.rehireEligible === false && <Badge tone="danger">Not eligible for rehire</Badge>}
      </div>
      <div className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
        <Row k="Exit date" v={formatDate(x.exitDate)} />
        <Row k="Last working day" v={x.lastWorkingDay ? formatDate(x.lastWorkingDay) : "—"} />
        <Row k="Reason" v={`${x.reason}${x.reasonNote ? ` — ${x.reasonNote}` : ""}`} />
        <Row k="Notice served" v={x.noticeServed ? "Yes" : "No"} />
        <Row k="Agent at exit" v={ag ? `${ag.name} · ${ag.place}` : "Direct hire — no agent"} />
        <Row k="Referred by" v={e.referredBy || "—"} />
        <Row k="Settlement" v={x.settled ? `Paid ${x.settledOn ? formatDate(x.settledOn) : ""} — ${formatINR(x.settledAmount ?? 0)}` : "Pending"} />
        <Row k="Eligible for rehire" v={x.rehireEligible === false ? "No" : "Yes"} />
        <Row k="Recorded by" v={`${x.recordedBy ?? "—"}${x.recordedAt ? ` · ${x.recordedAt}` : ""}`} />
      </div>
      {x.remarks && <p className="rounded-md bg-card p-2.5 text-xs"><span className="font-semibold">Remarks: </span>{x.remarks}</p>}
      {ag && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Handshake className="h-3 w-3" /> Agent commission for this worker stops from the exit date.
        </p>
      )}
      {!x.settled && (
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-danger">
          <Wallet className="h-3 w-3" /> Outstanding dues — clear this in Full &amp; Final Settlement.
        </p>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/40 py-0.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}

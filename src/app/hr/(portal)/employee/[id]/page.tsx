"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Modal } from "@/components/ui/modal";
import { EmployeeEditModal } from "@/components/employee-edit-modal";
import { EmployeeExitModal, ExitDetails } from "@/components/employee-exit-modal";
import { useToast } from "@/components/ui/toast";
import { downloadExcel } from "@/lib/excel";
import { tenure, totalExperience, bmi, bmiBand } from "@/lib/hr-data";
import { useHr, attendanceFor, advanceProjection, canManageExits, useCanEdit } from "@/stores/hr";
import { buildPayslip, amountInWords } from "@/lib/payroll";
import { categoryById, shiftById, agentById } from "@/lib/hr-master";
import { COMPANY } from "@/lib/company";
import { buildPaymentRecord } from "@/lib/payment-record";
import { downloadPaymentRecordPdf } from "@/lib/pdf";
import { formatINR, formatDate } from "@/lib/utils";
import {
  ArrowLeft, Mail, Phone, MapPin, MessageSquare, FileSpreadsheet, CheckCircle2, LogOut, RotateCcw,
  XCircle, Landmark, CalendarClock, ShieldCheck, User, Banknote, Clock, HeartPulse, Handshake, FileText, Pencil, Trash2, GraduationCap,
} from "lucide-react";

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const employees = useHr((s) => s.employees);
  const attendance = useHr((s) => s.attendance);
  const advances = useHr((s) => s.advances);
  const logPayslip = useHr((s) => s.logPayslip);
  const updateEmployee = useHr((s) => s.updateEmployee);
  const deleteEmployee = useHr((s) => s.deleteEmployee);
  const push = useToast((s) => s.push);
  const [payslipOpen, setPayslipOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const mayEdit = useCanEdit();
  const [confirmDel, setConfirmDel] = useState(false);
  const [exitMode, setExitMode] = useState<"leave" | "rejoin" | null>(null);
  const mayExit = canManageExits(useHr((s) => s.user)?.role);

  const e = employees.find((x) => x.id === id);
  if (!e) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground">Employee {id} not found.</p>
        <Link href="/hr/employees"><Button variant="outline" size="sm" className="mt-3"><ArrowLeft className="h-4 w-4" /> Back to directory</Button></Link>
      </div>
    );
  }

  const t = tenure(e.doj);
  const slip = buildPayslip(e.monthlyGross, e.leave.lopThisMonth, 0);
  const cat = categoryById(e.category);
  const sh = shiftById(e.shiftId);
  const agent = agentById(e.agentId);
  const b = bmi(e.health);
  const band = bmiBand(b);
  const payRec = buildPaymentRecord(e);

  const exportPaymentExcel = () =>
    downloadExcel({
      filename: `payment-record-${e.id}`, sheetName: "Payment Record",
      title: `Payment Record — ${e.name} (${e.id})`,
      columns: [
        { header: "Month", key: "label", width: 14 }, { header: "Gross ₹", key: "gross" },
        ...(payRec.pfApplicable ? [{ header: "PF ₹", key: "pf" }, { header: "ESI ₹", key: "esi" }] : []),
        ...(payRec.tdsApplicable ? [{ header: "TDS ₹", key: "tds" }] : []),
        { header: "Deductions ₹", key: "deductions" }, { header: "Net Paid ₹", key: "net" },
      ],
      rows: [
        ...payRec.rows,
        { label: `TOTAL (${payRec.monthsPaid} months)`, gross: payRec.totalGross, pf: payRec.totalPf, esi: payRec.totalEsi, tds: payRec.totalTds, deductions: payRec.totalDeductions, net: payRec.totalNet },
      ] as unknown as Record<string, unknown>[],
    });

  const sendPayslip = (channel: "WhatsApp" | "Email") => {
    logPayslip({ empId: e.id, empName: e.name, channel, month: "June 2026", netPay: slip.netPay });
    push(`Payslip sent via ${channel}`, `${e.name} — June 2026 (net ${formatINR(slip.netPay)}) sent to ${channel === "WhatsApp" ? e.phone : e.email}. Logged in the payslip register.`);
  };

  return (
    <>
      <PageHeader
        title={`${e.salutation} ${e.name}`}
        description={`${e.id} · ${e.role} · ${e.department}`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => router.push("/hr/employees")}><ArrowLeft className="h-4 w-4" /> Directory</Button>
            {mayEdit && <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" /> Edit</Button>}
            {mayExit && (e.status === "Exited"
              ? <Button variant="outline" size="sm" onClick={() => setExitMode("rejoin")}><RotateCcw className="h-4 w-4" /> Re-join</Button>
              : <Button variant="outline" size="sm" className="text-danger" onClick={() => setExitMode("leave")}><LogOut className="h-4 w-4" /> Mark as left</Button>)}
            {mayEdit && <Button variant="danger" size="sm" onClick={() => setConfirmDel(true)}><Trash2 className="h-4 w-4" /> Delete</Button>}
            <Button size="sm" onClick={() => setPayslipOpen(true)}><Banknote className="h-4 w-4" /> Payslip</Button>
          </>
        }
      />

      {/* Header card */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600/15 text-lg font-bold text-emerald-600">
              {e.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold">{e.name}</h2>
                <Badge tone={e.status === "Active" ? "success" : e.status === "Probation" ? "warning" : "muted"}>{e.status}</Badge>
                <Badge tone={e.employmentType === "Fresher" ? "info" : "muted"}>{e.employmentType}</Badge>
                <Badge tone={(e.salaryStatus ?? "Paid") === "Paid" ? "success" : (e.salaryStatus === "On Hold" ? "danger" : "warning")}>
                  Salary: {e.salaryStatus ?? "Paid"}
                </Badge>
              </div>
              {e.salaryStatus && e.salaryStatus !== "Paid" && e.salaryStatusReason && (
                <p className="mt-0.5 text-[11px] text-warning">Reason: {e.salaryStatusReason}</p>
              )}
              <p className="text-xs text-muted-foreground">{e.role} · Grade {e.grade} · Reports to {e.reportsTo}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Tenure" value={t.label} />
            <Stat label="Total Exp" value={`${totalExperience(e)} yrs`} />
            <Stat label="Prev Exp" value={`${e.prevExpYears} yrs`} />
          </div>
        </CardContent>
      </Card>

      {e.exit && <ExitDetails e={e} />}
      {(e.rejoins ?? []).length > 0 && (
        <Card>
          <CardContent className="py-3">
            <p className="mb-1.5 text-xs font-bold">Re-join history ({e.rejoins!.length})</p>
            {e.rejoins!.map((r, i) => (
              <p key={i} className="text-[11px] text-muted-foreground">
                Re-joined {formatDate(r.rejoinDate)}{r.previousExitDate ? ` (after leaving ${formatDate(r.previousExitDate)})` : ""}{r.note ? ` — ${r.note}` : ""}
                {r.recordedBy ? ` · recorded by ${r.recordedBy}` : ""}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="workforce">Workforce & Health</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="salary">Salary & Bank</TabsTrigger>
          <TabsTrigger value="payments">Payment Record</TabsTrigger>
          <TabsTrigger value="statutory">PF / ESI / TDS</TabsTrigger>
          <TabsTrigger value="leave">Attendance & Leave</TabsTrigger>
        </TabsList>

        {/* Profile */}
        <TabsContent value="profile">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="space-y-2.5 py-4">
                <p className="flex items-center gap-2 text-xs font-bold"><User className="h-4 w-4 text-primary" /> Personal</p>
                <Grid rows={[["Gender", e.gender], ["Father / Guardian", e.fatherName ?? "—"], ["Date of Birth", formatDate(e.dob)], ["Blood Group", e.bloodGroup], ["Aadhaar", e.aadhaar], ["PAN", e.pan]]} />
                <p className="flex items-center gap-2 pt-2 text-xs font-bold"><Phone className="h-4 w-4 text-primary" /> Contact</p>
                <div className="space-y-1.5 text-xs">
                  <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /> {e.phone}{e.altPhone !== "—" ? ` · ${e.altPhone}` : ""}</p>
                  <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /> {e.email}</p>
                  <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" /> <span><span className="font-medium">Permanent:</span> {e.address}</span></p>
                  {e.temporaryAddress && <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" /> <span><span className="font-medium">Temporary:</span> {e.temporaryAddress}</span></p>}
                  {e.accommodation && <p className="text-muted-foreground">Accommodation / transport: <span className="font-medium text-foreground">{e.accommodation}</span></p>}
                  <p className="text-muted-foreground">Emergency: {e.emergencyContact}{e.emergencyPhone ? ` · ${e.emergencyPhone}` : ""}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-2.5 py-4">
                <p className="flex items-center gap-2 text-xs font-bold"><ShieldCheck className="h-4 w-4 text-primary" /> Employment</p>
                <Grid rows={[["Date of Joining", formatDate(e.doj)], ["Tenure", t.label + ` (${t.totalDays} days)`], ["Employment Type", e.employmentType], ["Grade", e.grade], ["Reports To", e.reportsTo], ["Company Branch / Unit", e.unit ?? "—"], ["Location / Area", e.location ?? "—"], ["Referred By", e.referredBy ?? "—"], ["Status", e.status]]} />
                <p className="pt-2 text-xs font-bold">Previous Experience</p>
                <div className="rounded-md bg-muted/50 p-2.5 text-xs">
                  {e.prevExpYears > 0 ? <><span className="font-semibold">{e.prevExpYears} years</span> — {e.prevExpDetail}</> : "Fresher — first job"}
                </div>
                <p className="pt-2 text-xs font-bold">Qualification</p>
                <Grid rows={[["Highest Qualification", e.qualification], ["Institution", e.institution], ["Year", `${e.passYear}`]]} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Workforce & Health */}
        <TabsContent value="workforce">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="space-y-2.5 py-4">
                <p className="flex items-center gap-2 text-xs font-bold"><Clock className="h-4 w-4 text-primary" /> Workforce classification</p>
                <Grid rows={[
                  ["Category", e.category === "MC_OTHERS" && e.categoryOther ? e.categoryOther : cat?.label ?? e.category],
                  ["Wage Type", e.wageType + (e.wageType !== "Monthly" ? ` · ₹${e.salaryPerDay}/day` : "")],
                  ["Department", e.department],
                  ["Section", e.section ?? "—"],
                  ["Shift", sh ? `${sh.code} — ${sh.name} (${sh.time})` : "—"],
                  ["Conduct", e.conduct],
                  ["PF / ESI", (e.pfApplicable ?? cat?.statutory) ? "Applicable" : "Not applicable"],
                  ["TDS", e.tdsApplicable ? "Applicable" : "Not applicable"],
                ]} />
                <p className="flex items-center gap-2 pt-2 text-xs font-bold"><Handshake className="h-4 w-4 text-primary" /> Agent / Through</p>
                {agent ? (
                  <div className="rounded-md bg-muted/50 p-2.5 text-xs">
                    <p className="font-semibold">{agent.name}</p>
                    <p className="text-muted-foreground">{agent.place} · {agent.phone}</p>
                    <p className="mt-1 text-muted-foreground">Commission {formatINR(agent.commissionPerWorker)}/mo — {e.conduct === "Proper" ? <span className="font-semibold text-success">payable</span> : <span className="font-semibold text-danger">stopped ({e.conduct})</span>}</p>
                  </div>
                ) : <p className="rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground">Direct hire — no agent.</p>}
                {(() => {
                  const a = attendanceFor(attendance, e.id);
                  return a ? <p className="pt-1 text-[11px] text-muted-foreground">This month: {a.daysWorked} days worked · {a.saturdaysWorked}/{a.totalSaturdays} Saturdays · {a.otHours} OT hr.</p> : null;
                })()}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-2.5 py-4">
                <p className="flex items-center gap-2 text-xs font-bold"><HeartPulse className="h-4 w-4 text-primary" /> Health record</p>
                <Grid rows={[
                  ["Height / Weight", `${e.health?.heightCm ?? "—"} cm · ${e.health?.weightKg ?? "—"} kg`],
                  ["BMI", b !== null ? `${b} (${band.label})` : "—"],
                  ["Blood Pressure", e.health?.bloodPressure ?? "—"],
                  ["Haemoglobin", e.health?.hemoglobin !== undefined ? `${e.health.hemoglobin} g/dL` : "—"],
                  ["Last Checkup", e.health?.lastCheckup ?? "—"],
                ]} />
                {e.gender === "Female" && (
                  <>
                    <p className="pt-2 text-xs font-bold">Women’s health</p>
                    <Grid rows={[
                      ["Last Period (LMP)", e.health?.lastPeriodDate ?? "—"],
                      ["Cycle Length", e.health?.cycleDays ? `${e.health.cycleDays} days` : "—"],
                      ["Pregnant", e.health?.pregnant ? "Yes" : "No"],
                    ]} />
                    {e.health?.pregnancyNote && <div className="rounded-md border border-warning/40 bg-warning/5 p-2.5 text-xs">{e.health.pregnancyNote}</div>}
                  </>
                )}
                {e.health?.ailments && <div className="rounded-md bg-muted/50 p-2.5 text-xs"><span className="font-semibold">Ailments:</span> {e.health.ailments}</div>}
                <p className="pt-1 text-[11px] text-muted-foreground">Update health details from the <Link href="/hr/health" className="font-semibold text-primary hover:underline">Health Check</Link> page.</p>

                <p className="flex items-center gap-2 pt-3 text-xs font-bold"><GraduationCap className="h-4 w-4 text-primary" /> Cross-skill training</p>
                {(e.training ?? []).length === 0 ? (
                  <p className="rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground">No cross-department training on record.</p>
                ) : (
                  <div className="space-y-1.5">
                    {(e.training ?? []).map((t, i) => (
                      <div key={i} className="rounded-md border p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold">{t.skill}</p>
                          <Badge tone={t.level === "Certified" ? "success" : t.level === "Intermediate" ? "info" : "muted"}>{t.level}</Badge>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Qualified for <span className="font-medium text-foreground">{t.department}</span> · completed {formatDate(t.completedOn)}{t.trainer ? ` · ${t.trainer}` : ""}
                        </p>
                      </div>
                    ))}
                    <p className="text-[11px] text-muted-foreground">The AI proposes this worker as cover when one of these departments is short-staffed.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents">
          <Card>
            <CardContent className="py-4">
              <p className="mb-3 text-xs font-bold">Document checklist — {e.documents.filter((d) => d.submitted).length}/{e.documents.length} submitted</p>
              <Table>
                <THead>
                  <TR><TH>Document</TH><TH>File / Ref</TH><TH>Submitted</TH><TH>Verified</TH><TH></TH></TR>
                </THead>
                <TBody>
                  {e.documents.map((d) => (
                    <TR key={d.type}>
                      <TD className="font-medium">{d.type}</TD>
                      <TD className="font-mono text-xs text-muted-foreground">{d.fileName ?? d.number}</TD>
                      <TD>{d.submitted ? <Badge tone="success"><CheckCircle2 className="h-3 w-3" /> Yes</Badge> : <Badge tone="danger"><XCircle className="h-3 w-3" /> Missing</Badge>}</TD>
                      <TD>{d.verified ? <Badge tone="success">Verified</Badge> : <Badge tone="warning">Pending</Badge>}</TD>
                      <TD>{d.dataUrl ? <a href={d.dataUrl} download={d.fileName} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><FileText className="h-3.5 w-3.5" /> Download</a> : null}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              {e.documents.some((d) => !d.submitted) && (
                <div className="mt-3 rounded-md border border-warning/40 bg-warning/5 p-3 text-xs">
                  <span className="font-semibold">Pending:</span> {e.documents.filter((d) => !d.submitted).map((d) => d.type).join(", ")} — reminder can be sent to the employee on WhatsApp.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Salary & Bank */}
        <TabsContent value="salary">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="py-4">
                <p className="mb-3 text-xs font-bold">Salary history (last {e.salaryHistory.length} year{e.salaryHistory.length > 1 ? "s" : ""})</p>
                <Table>
                  <THead>
                    <TR><TH>FY</TH><TH className="text-right">Monthly</TH><TH className="text-right">Annual Paid</TH><TH>Credited To</TH></TR>
                  </THead>
                  <TBody>
                    {e.salaryHistory.map((y) => (
                      <TR key={y.fy}>
                        <TD className="font-semibold">{y.fy}</TD>
                        <TD className="text-right">{formatINR(y.monthlyGross)}</TD>
                        <TD className="text-right">{y.annualPaid ? formatINR(y.annualPaid, true) : "—"}</TD>
                        <TD className="text-muted-foreground">{y.bank} {y.account}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
                <p className="mt-2 text-[11px] text-muted-foreground">Current CTC {formatINR(e.ctc, true)} · gross {formatINR(e.monthlyGross)}/mo · credited {e.salaryHistory.at(-1)?.creditedDay}.</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="mb-3 flex items-center gap-2 text-xs font-bold"><Landmark className="h-4 w-4 text-primary" /> Bank account history</p>
                {e.bankHistory.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">No bank on file yet.</p>
                ) : (
                  <div className="space-y-2">
                    {e.bankHistory.map((b, i) => (
                      <div key={i} className={`rounded-md border p-3 ${b.to === "Current" ? "border-success/40 bg-success/5" : ""}`}>
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold">{b.bank}</p>
                          <Badge tone={b.to === "Current" ? "success" : "muted"}>{b.to === "Current" ? "Active" : "Closed"}</Badge>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">A/c {b.account} · IFSC {b.ifsc}</p>
                        <p className="text-[11px] text-muted-foreground">{formatDate(b.from)} → {b.to === "Current" ? "present" : formatDate(b.to)}</p>
                      </div>
                    ))}
                    {e.bankHistory.length > 1 && (
                      <p className="rounded-md bg-accent p-2.5 text-[11px] text-accent-foreground">
                        Bank changed {e.bankHistory.length - 1} time{e.bankHistory.length > 2 ? "s" : ""} — salary credit account switched on {formatDate(e.bankHistory[1].from)}.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {(() => {
            const empAdvances = advances.filter((x) => x.empId === e.id);
            if (empAdvances.length === 0) return null;
            return (
              <Card className="mt-4">
                <CardContent className="py-4">
                  <p className="mb-3 flex items-center gap-2 text-xs font-bold"><Banknote className="h-4 w-4 text-primary" /> Advances & recovery</p>
                  <div className="space-y-3">
                    {empAdvances.map((a) => {
                      const p = advanceProjection(a);
                      const pct = Math.round((a.recovered / a.amount) * 100);
                      return (
                        <div key={a.id} className="rounded-md border p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-semibold">Took {formatINR(a.amount)} on {formatDate(a.date)} <span className="font-normal text-muted-foreground">· {a.reason}</span></p>
                            <Badge tone={a.status === "Cleared" ? "success" : "warning"}>{a.status}</Badge>
                          </div>
                          <div className="mt-2"><Progress value={pct} tone={a.status === "Cleared" ? "success" : "primary"} /></div>
                          <p className="mt-1.5 text-[11px] text-muted-foreground">
                            Recovered <span className="font-semibold text-foreground">{formatINR(a.recovered)}</span> · deducting <span className="font-semibold text-foreground">{formatINR(a.monthlyRecovery)}/month</span> · remaining <span className="font-semibold text-foreground">{formatINR(p.remaining)}</span>
                            {a.status === "Cleared" ? " · fully recovered" : ` · completes ${p.completeLabel} (${p.monthsLeft} mo left)`}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">Manage recovery amounts on the <Link href="/hr/advances" className="font-semibold text-primary hover:underline">Advances & Deductions</Link> page.</p>
                </CardContent>
              </Card>
            );
          })()}
        </TabsContent>

        {/* Payment Record */}
        <TabsContent value="payments">
          <Card>
            <CardContent className="py-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold">Payment record — {payRec.monthsPaid} months paid</p>
                  <p className="text-xs text-muted-foreground">
                    From {formatDate(e.doj)} to date · Total net paid <span className="font-semibold text-success">{formatINR(payRec.totalNet)}</span> ·
                    PF/ESI {payRec.pfApplicable ? "included" : "not applicable"} · TDS {payRec.tdsApplicable ? "included" : "not applicable"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={exportPaymentExcel}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
                  <Button size="sm" onClick={async () => { await downloadPaymentRecordPdf(e, payRec); push("Payment record PDF downloaded", `payment-record-${e.id}.pdf`); }}><FileText className="h-4 w-4" /> PDF</Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Months paid" value={`${payRec.monthsPaid}`} />
                <Stat label="Total gross" value={formatINR(payRec.totalGross, true)} />
                <Stat label={payRec.pfApplicable ? "Total PF" : "PF"} value={payRec.pfApplicable ? formatINR(payRec.totalPf, true) : "N/A"} />
                <Stat label="Total net paid" value={formatINR(payRec.totalNet, true)} />
              </div>
              <div className="mt-4 max-h-[420px] overflow-y-auto">
                <Table>
                  <THead>
                    <TR>
                      <TH>Month</TH><TH className="text-right">Gross</TH>
                      {payRec.pfApplicable && <TH className="text-right">PF</TH>}
                      {payRec.pfApplicable && <TH className="text-right">ESI</TH>}
                      {payRec.tdsApplicable && <TH className="text-right">TDS</TH>}
                      <TH className="text-right">Deductions</TH><TH className="text-right">Net Paid</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {payRec.rows.map((r) => (
                      <TR key={r.ym}>
                        <TD className="font-medium">{r.label}</TD>
                        <TD className="text-right">{formatINR(r.gross)}</TD>
                        {payRec.pfApplicable && <TD className="text-right">{r.pf ? formatINR(r.pf) : "—"}</TD>}
                        {payRec.pfApplicable && <TD className="text-right">{r.esi ? formatINR(r.esi) : "—"}</TD>}
                        {payRec.tdsApplicable && <TD className="text-right">{r.tds ? formatINR(r.tds) : "—"}</TD>}
                        <TD className="text-right text-danger">{formatINR(r.deductions)}</TD>
                        <TD className="text-right font-semibold text-success">{formatINR(r.net)}</TD>
                      </TR>
                    ))}
                    <TR>
                      <TD className="font-bold">TOTAL</TD>
                      <TD className="text-right font-bold">{formatINR(payRec.totalGross)}</TD>
                      {payRec.pfApplicable && <TD className="text-right font-bold">{formatINR(payRec.totalPf)}</TD>}
                      {payRec.pfApplicable && <TD className="text-right font-bold">{formatINR(payRec.totalEsi)}</TD>}
                      {payRec.tdsApplicable && <TD className="text-right font-bold">{formatINR(payRec.totalTds)}</TD>}
                      <TD className="text-right font-bold text-danger">{formatINR(payRec.totalDeductions)}</TD>
                      <TD className="text-right font-bold text-success">{formatINR(payRec.totalNet)}</TD>
                    </TR>
                  </TBody>
                </Table>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">Representative monthly figures from the standing wage and statutory settings. Download as Excel or PDF for records.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Statutory */}
        <TabsContent value="statutory">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="py-4">
                <p className="mb-3 text-xs font-bold">Statutory identifiers</p>
                <Grid rows={[["PF UAN", e.uan], ["ESI No", e.esiNo], ["PAN", e.pan], ["Aadhaar", e.aadhaar]]} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="mb-3 text-xs font-bold">Monthly deductions (June 2026)</p>
                <Table>
                  <TBody>
                    {slip.deductions.map((d) => (
                      <TR key={d.label}><TD className="text-muted-foreground">{d.label}</TD><TD className="text-right">{formatINR(d.amount)}</TD></TR>
                    ))}
                    <TR><TD className="font-bold">Total deductions</TD><TD className="text-right font-bold text-danger">{formatINR(slip.totalDeductions)}</TD></TR>
                  </TBody>
                </Table>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  PF 12% of basic (capped ₹15k) · ESI 0.75% if gross ≤ ₹21k · PT slab · TDS if gross &gt; ₹50k. Net pay {formatINR(slip.netPay)}.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Attendance & Leave */}
        <TabsContent value="leave">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="py-4">
                <p className="mb-3 flex items-center gap-2 text-xs font-bold"><CalendarClock className="h-4 w-4 text-primary" /> Leave balance</p>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <LeaveStat label="EL" value={e.leave.el} />
                  <LeaveStat label="CL" value={e.leave.cl} />
                  <LeaveStat label="SL" value={e.leave.sl} />
                  <LeaveStat label="LOP" value={e.leave.lopThisMonth} tone="danger" />
                </div>
                <p className="mt-3 text-[11px] text-muted-foreground">Entitlement: EL 15/yr · CL 12/yr · SL 12/yr. LOP days reduce that month&apos;s payslip pro-rata.</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="mb-3 text-xs font-bold">Attendance summary (June)</p>
                <Grid rows={[["Paid days", `${30 - e.leave.lopThisMonth}/30`], ["LOP days", `${e.leave.lopThisMonth}`], ["Leave taken (EL+CL+SL used)", `${Math.max(0, 33 - e.leave.el - e.leave.cl - e.leave.sl)}`], ["Shift pattern", "General / rotational"]]} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {payslipOpen && (
        <Modal title={`Payslip — ${e.name}`} description={`${e.id} · June 2026 · net ${formatINR(slip.netPay)}`} onClose={() => setPayslipOpen(false)} wide>
          <div className="rounded-lg border p-4">
            <div className="mb-3 flex items-center justify-between border-b pb-3">
              <div>
                <p className="text-sm font-bold">{COMPANY.name}</p>
                <p className="text-[11px] text-muted-foreground">Payslip · June 2026 · Paid {slip.paidDays}/30{e.leave.lopThisMonth ? ` · LOP ${e.leave.lopThisMonth}d` : ""}</p>
              </div>
              <div className="text-right text-[11px] text-muted-foreground"><p>{e.id} · {e.department}</p><p>{e.role}</p></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Earnings</p>
                <Table><TBody>
                  {slip.earnings.map((x) => (<TR key={x.label}><TD className="text-muted-foreground">{x.label}</TD><TD className="text-right">{formatINR(x.amount)}</TD></TR>))}
                  <TR><TD className="font-bold">Gross</TD><TD className="text-right font-bold">{formatINR(slip.grossEarnings)}</TD></TR>
                </TBody></Table>
              </div>
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Deductions</p>
                <Table><TBody>
                  {slip.deductions.map((x) => (<TR key={x.label}><TD className="text-muted-foreground">{x.label}</TD><TD className="text-right">{formatINR(x.amount)}</TD></TR>))}
                  <TR><TD className="font-bold">Total</TD><TD className="text-right font-bold text-danger">{formatINR(slip.totalDeductions)}</TD></TR>
                </TBody></Table>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-md bg-success/10 p-3">
              <span className="text-sm font-bold text-success">Net Pay</span>
              <span className="text-lg font-bold text-success">{formatINR(slip.netPay)}</span>
            </div>
            <p className="mt-1.5 text-[11px] italic text-muted-foreground">{amountInWords(slip.netPay)}</p>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Button onClick={() => sendPayslip("WhatsApp")}><MessageSquare className="h-4 w-4" /> WhatsApp</Button>
            <Button variant="outline" onClick={() => sendPayslip("Email")}><Mail className="h-4 w-4" /> Email</Button>
            <Button variant="outline" onClick={async () => {
              await downloadExcel({ filename: `payslip-${e.id}`, sheetName: "Payslip", title: `Payslip — ${e.name} (${e.id}) · June 2026`, columns: [{ header: "Component", key: "c", width: 26 }, { header: "Earnings ₹", key: "e" }, { header: "Deductions ₹", key: "d" }], rows: [...slip.earnings.map((x) => ({ c: x.label, e: x.amount, d: "" })), ...slip.deductions.map((x) => ({ c: x.label, e: "", d: x.amount })), { c: "NET PAY", e: slip.netPay, d: "" }, { c: amountInWords(slip.netPay), e: "", d: "" }] });
              push("Payslip downloaded", `payslip-${e.id}.xlsx`);
            }}><FileSpreadsheet className="h-4 w-4" /> Download</Button>
          </div>
        </Modal>
      )}

      {editOpen && (
        <EmployeeEditModal
          employee={e}
          onClose={() => setEditOpen(false)}
          onSave={(updated) => {
            updateEmployee(e.id, updated);
            push(`${updated.name} updated`, "Employee master saved — the change is recorded in the Audit Log.");
          }}
        />
      )}

      {exitMode && (
        <EmployeeExitModal
          employee={e}
          mode={exitMode}
          onClose={() => {
            push(exitMode === "leave" ? `${e.name} marked as left` : `${e.name} re-joined`,
              exitMode === "leave" ? "Exit recorded with settlement status and logged to the on-roll ledger." : "Back on the roll as Active.");
            setExitMode(null);
          }}
        />
      )}

      {confirmDel && (
        <Modal title={`Delete ${e.name}?`} description="The employee moves to Deleted Items — you can restore it. Permanent deletion is CEO/Admin only." onClose={() => setConfirmDel(false)}>
          <div className="space-y-4">
            <p className="rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">This removes {e.name} ({e.id}) from the active workforce and places the record in the recycle bin.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDel(false)}>Cancel</Button>
              <Button variant="danger" onClick={() => { deleteEmployee(e.id); push(`${e.name} deleted`, "Moved to Deleted Items. Restore any time."); router.push("/hr/employees"); }}><Trash2 className="h-4 w-4" /> Move to recycle bin</Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-muted/50 px-3 py-1.5"><p className="text-sm font-bold">{value}</p><p className="text-[10px] text-muted-foreground">{label}</p></div>;
}
function LeaveStat({ label, value, tone }: { label: string; value: number; tone?: "danger" }) {
  return <div className="rounded-md bg-muted/50 p-2"><p className={`text-lg font-bold ${tone === "danger" && value > 0 ? "text-danger" : ""}`}>{value}</p><p className="text-[10px] text-muted-foreground">{label}</p></div>;
}
function Grid({ rows }: { rows: [string, string][] }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
      {rows.map(([k, v]) => (
        <div key={k}><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{k}</p><p className="font-medium">{v}</p></div>
      ))}
    </div>
  );
}

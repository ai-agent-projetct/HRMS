"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { GARMENT_ROLES, type HrEmployee, type EmpDocument, type DocType } from "@/lib/hr-data";
import { WORKER_CATEGORIES, SHIFTS, AGENTS, type WorkerCategoryId } from "@/lib/hr-master";
import { useHr } from "@/stores/hr";
import { Upload, Check, FileText } from "lucide-react";

const UPLOAD_DOCS: DocType[] = ["Aadhaar", "PAN", "Degree Certificate", "Experience Certificate", "Bank Passbook", "Photo", "Offer Letter"];
const ACCOMMODATION = ["Own arrangement", "Company Bus", "Hosteller", "Hosteller + Mess", "Mess only"];
const MAX_DATAURL = 1_500_000;
type Uploaded = { fileName: string; dataUrl?: string };

const selectCls = "flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

/** Full edit of an employee master record — every field plus document uploads. */
export function EmployeeEditModal({
  employee, onSave, onClose,
}: {
  employee: HrEmployee;
  onSave: (updated: HrEmployee) => void;
  onClose: () => void;
}) {
  const e = employee;
  const units = useHr((s) => s.units);
  const bank = e.bankHistory.at(-1);
  const roleIsStd = (GARMENT_ROLES as readonly string[]).includes(e.role);
  const [f, setF] = useState({
    name: e.name, fatherName: e.fatherName ?? "", salutation: e.salutation, gender: e.gender, dob: e.dob, bloodGroup: e.bloodGroup,
    category: WORKER_CATEGORIES.find((c) => c.id === e.category)?.label ?? "Permanent", categoryOther: e.categoryOther ?? "",
    role: roleIsStd ? e.role : "Others…", roleOther: roleIsStd ? "" : e.role,
    department: e.department, section: e.section ?? "", shift: e.shiftId, employmentType: e.employmentType,
    status: e.status, doj: e.doj, grade: e.grade, reportsTo: e.reportsTo,
    unit: e.unit ?? "", location: e.location ?? "", agentId: e.agentId ?? "",
    wageType: e.wageType, pay: String(e.wageType === "Monthly" ? e.monthlyGross : e.salaryPerDay ?? 0),
    salaryStatus: e.salaryStatus ?? "Paid", salaryStatusReason: e.salaryStatusReason ?? "",
    phone: e.phone, altPhone: e.altPhone === "—" ? "" : e.altPhone, email: e.email === "—" ? "" : e.email,
    emergencyContact: e.emergencyContact === "—" ? "" : e.emergencyContact, emergencyPhone: e.emergencyPhone ?? "",
    address: e.address === "—" ? "" : e.address, temporaryAddress: e.temporaryAddress ?? "", accommodation: e.accommodation ?? ACCOMMODATION[0],
    aadhaar: e.aadhaar === "—" ? "" : e.aadhaar, pan: e.pan === "—" ? "" : e.pan, uan: e.uan === "—" ? "" : e.uan, esiNo: e.esiNo === "—" ? "" : e.esiNo,
    qualification: e.qualification === "—" ? "" : e.qualification, institution: e.institution === "—" ? "" : e.institution, passYear: String(e.passYear || ""),
    bankName: e.bankName ?? bank?.bank ?? "", bankBranch: e.bankBranch ?? "", account: e.bankAccount ?? bank?.account ?? "", ifsc: e.bankIfsc ?? bank?.ifsc ?? "",
  });
  const [pf, setPf] = useState(e.pfApplicable ?? true);
  const [tds, setTds] = useState(e.tdsApplicable ?? false);
  const [docs, setDocs] = useState<Record<string, Uploaded>>(() => {
    const init: Record<string, Uploaded> = {};
    e.documents.forEach((d) => { if (d.fileName || d.dataUrl) init[d.type] = { fileName: d.fileName ?? d.number, dataUrl: d.dataUrl }; });
    return init;
  });
  const [error, setError] = useState("");
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const isDaily = f.wageType !== "Monthly";
  const isMcOthers = f.category === "MC & Others";
  const isCustomRole = f.role === "Others…";

  const onFile = (type: string, file?: File) => {
    if (!file) return;
    if (file.size <= MAX_DATAURL) {
      const reader = new FileReader();
      reader.onload = () => setDocs((d) => ({ ...d, [type]: { fileName: file.name, dataUrl: reader.result as string } }));
      reader.readAsDataURL(file);
    }
    setDocs((d) => ({ ...d, [type]: { fileName: file.name } }));
  };

  const save = () => {
    if (!f.name.trim()) return setError("Full name is required.");
    if (isMcOthers && !f.categoryOther.trim()) return setError("Specify the category for “MC & Others”.");
    if (isCustomRole && !f.roleOther.trim()) return setError("Enter the custom role.");
    if (!f.pay.trim() || isNaN(Number(f.pay))) return setError("Enter a valid pay amount.");

    const catDef = WORKER_CATEGORIES.find((c) => c.label === f.category)!;
    const pay = Number(f.pay);
    const monthly = isDaily ? pay * 26 : pay;
    // merge documents: keep non-upload existing types, override the upload set
    const keptOther = e.documents.filter((d) => !docs[d.type]);
    const uploaded: EmpDocument[] = Object.entries(docs).map(([type, up]) => {
      const prev = e.documents.find((d) => d.type === type);
      return { type: type as DocType, number: up.fileName, submitted: true, verified: prev?.verified ?? false, fileName: up.fileName, dataUrl: up.dataUrl ?? prev?.dataUrl };
    });

    const updated: HrEmployee = {
      ...e,
      name: f.name.trim(), fatherName: f.fatherName.trim() || undefined, salutation: f.salutation, gender: f.gender as HrEmployee["gender"], dob: f.dob, bloodGroup: f.bloodGroup || "—",
      role: isCustomRole ? f.roleOther.trim() : f.role,
      department: f.department.trim(), section: f.section.trim() || undefined, shiftId: f.shift,
      employmentType: f.employmentType as HrEmployee["employmentType"], status: f.status as HrEmployee["status"],
      doj: f.doj, grade: f.grade, reportsTo: f.reportsTo || "—",
      unit: f.unit.trim() || undefined, location: f.location.trim() || undefined, agentId: f.agentId || undefined,
      wageType: catDef.wageType === f.wageType ? (f.wageType as HrEmployee["wageType"]) : (f.wageType as HrEmployee["wageType"]),
      category: catDef.id as WorkerCategoryId, categoryOther: isMcOthers ? f.categoryOther.trim() : undefined,
      salaryPerDay: isDaily ? pay : undefined, monthlyGross: monthly, ctc: monthly * 13,
      pfApplicable: pf, tdsApplicable: tds,
      salaryStatus: f.salaryStatus as HrEmployee["salaryStatus"], salaryStatusReason: f.salaryStatus === "Paid" ? undefined : f.salaryStatusReason.trim(),
      phone: f.phone.trim() || "—", altPhone: f.altPhone.trim() || "—", email: f.email.trim() || "—",
      emergencyContact: f.emergencyContact.trim() || "—", emergencyPhone: f.emergencyPhone.trim() || undefined,
      address: f.address.trim() || "—", temporaryAddress: f.temporaryAddress.trim() || undefined, accommodation: f.accommodation,
      aadhaar: f.aadhaar.trim() || "—", pan: f.pan.trim() || "—", uan: f.uan.trim() || "—", esiNo: f.esiNo.trim() || "—",
      qualification: f.qualification.trim() || "—", institution: f.institution.trim() || "—", passYear: Number(f.passYear) || 0,
      bankName: f.bankName.trim() || undefined, bankBranch: f.bankBranch.trim() || undefined,
      bankAccount: f.account.trim() || undefined, bankIfsc: f.ifsc.trim() || undefined,
      bankHistory: f.bankName.trim()
        ? [...e.bankHistory.slice(0, -1), { bank: f.bankName.trim(), account: f.account.trim(), ifsc: f.ifsc.trim(), from: bank?.from ?? e.doj, to: "Current" }]
        : e.bankHistory,
      documents: [...keptOther, ...uploaded],
    };
    onSave(updated);
    onClose();
  };

  const textarea = "w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <Modal title={`Edit — ${e.name}`} description={`${e.id} · edit any field and upload documents`} onClose={onClose} wide>
      <div className="space-y-5">
        <section className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Personal</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Salutation"><select className={selectCls} value={f.salutation} onChange={(ev) => set("salutation", ev.target.value)}><option>Mr.</option><option>Ms.</option><option>Mrs.</option><option>Dr.</option></select></Field>
            <Field label="Full name"><Input value={f.name} onChange={(ev) => set("name", ev.target.value)} /></Field>
            <Field label="Father's / guardian name"><Input value={f.fatherName} onChange={(ev) => set("fatherName", ev.target.value)} /></Field>
            <Field label="Gender"><select className={selectCls} value={f.gender} onChange={(ev) => set("gender", ev.target.value)}><option>Male</option><option>Female</option></select></Field>
            <Field label="Date of birth"><Input type="date" value={f.dob} onChange={(ev) => set("dob", ev.target.value)} /></Field>
            <Field label="Blood group"><Input value={f.bloodGroup} onChange={(ev) => set("bloodGroup", ev.target.value)} /></Field>
            <Field label="Aadhaar no."><Input value={f.aadhaar} onChange={(ev) => set("aadhaar", ev.target.value)} /></Field>
            <Field label="PAN"><Input value={f.pan} onChange={(ev) => set("pan", ev.target.value)} /></Field>
            <Field label="PF UAN"><Input value={f.uan} onChange={(ev) => set("uan", ev.target.value)} /></Field>
            <Field label="ESI no."><Input value={f.esiNo} onChange={(ev) => set("esiNo", ev.target.value)} /></Field>
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Role & category</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Worker category"><select className={selectCls} value={f.category} onChange={(ev) => set("category", ev.target.value)}>{WORKER_CATEGORIES.map((c) => <option key={c.id}>{c.label}</option>)}</select></Field>
            {isMcOthers && <Field label="Specify category"><Input value={f.categoryOther} onChange={(ev) => set("categoryOther", ev.target.value)} /></Field>}
            <Field label="Role"><select className={selectCls} value={f.role} onChange={(ev) => set("role", ev.target.value)}>{GARMENT_ROLES.map((r) => <option key={r}>{r}</option>)}<option value="Others…">Others…</option></select></Field>
            {isCustomRole && <Field label="Enter role"><Input value={f.roleOther} onChange={(ev) => set("roleOther", ev.target.value)} /></Field>}
            <Field label="Department"><Input value={f.department} onChange={(ev) => set("department", ev.target.value)} /></Field>
            <Field label="Section"><Input value={f.section} onChange={(ev) => set("section", ev.target.value)} /></Field>
            <Field label="Shift"><select className={selectCls} value={f.shift} onChange={(ev) => set("shift", ev.target.value)}>{SHIFTS.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}</select></Field>
            <Field label="Employment type"><select className={selectCls} value={f.employmentType} onChange={(ev) => set("employmentType", ev.target.value)}><option>Fresher</option><option>Experienced</option></select></Field>
            <Field label="Status"><select className={selectCls} value={f.status} onChange={(ev) => set("status", ev.target.value)}><option>Active</option><option>Probation</option><option>On Notice</option><option>Exited</option></select></Field>
            <Field label="Date of joining"><Input type="date" value={f.doj} onChange={(ev) => set("doj", ev.target.value)} /></Field>
            <Field label="Grade"><Input value={f.grade} onChange={(ev) => set("grade", ev.target.value)} /></Field>
            <Field label="Reports to"><Input value={f.reportsTo} onChange={(ev) => set("reportsTo", ev.target.value)} /></Field>
            <Field label="Company branch / unit"><select className={selectCls} value={f.unit} onChange={(ev) => set("unit", ev.target.value)}><option value="">— Select branch —</option>{units.map((u) => <option key={u} value={u}>{u}</option>)}</select></Field>
            <Field label="Location / area"><Input value={f.location} onChange={(ev) => set("location", ev.target.value)} /></Field>
            <Field label="Agent / through"><select className={selectCls} value={f.agentId} onChange={(ev) => set("agentId", ev.target.value)}><option value="">Direct hire — no agent</option>{AGENTS.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.place}</option>)}</select></Field>
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Wage & statutory</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Wage type"><div className="flex gap-1.5">{(["Daily", "Weekly", "Monthly"] as const).map((w) => <Button key={w} type="button" variant={f.wageType === w ? "default" : "outline"} size="sm" className="flex-1" onClick={() => set("wageType", w)}>{w}</Button>)}</div></Field>
            <Field label={isDaily ? "Wage per day (₹)" : "Monthly gross (₹)"}><Input value={f.pay} onChange={(ev) => set("pay", ev.target.value)} /></Field>
            <Field label="Salary status"><select className={selectCls} value={f.salaryStatus} onChange={(ev) => set("salaryStatus", ev.target.value)}><option>Paid</option><option>Pending</option><option>On Hold</option></select></Field>
            {f.salaryStatus !== "Paid" && <Field label="Salary status reason"><Input value={f.salaryStatusReason} onChange={(ev) => set("salaryStatusReason", ev.target.value)} /></Field>}
          </div>
          <div className="flex flex-wrap gap-4 rounded-lg border border-dashed p-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={pf} onChange={(ev) => setPf(ev.target.checked)} className="h-4 w-4 accent-emerald-600" /> PF / ESI applicable</label>
            <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={tds} onChange={(ev) => setTds(ev.target.checked)} className="h-4 w-4 accent-emerald-600" /> TDS applicable</label>
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Contact, address & bank</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Phone"><Input value={f.phone} onChange={(ev) => set("phone", ev.target.value)} /></Field>
            <Field label="Alt phone"><Input value={f.altPhone} onChange={(ev) => set("altPhone", ev.target.value)} /></Field>
            <Field label="Email"><Input value={f.email} onChange={(ev) => set("email", ev.target.value)} /></Field>
            <Field label="Emergency contact (name)"><Input value={f.emergencyContact} onChange={(ev) => set("emergencyContact", ev.target.value)} /></Field>
            <Field label="Emergency contact no."><Input value={f.emergencyPhone} onChange={(ev) => set("emergencyPhone", ev.target.value)} /></Field>
            <Field label="Accommodation / transport"><select className={selectCls} value={f.accommodation} onChange={(ev) => set("accommodation", ev.target.value)}>{ACCOMMODATION.map((a) => <option key={a}>{a}</option>)}</select></Field>
            <Field label="Permanent address"><textarea rows={2} className={textarea} value={f.address} onChange={(ev) => set("address", ev.target.value)} /></Field>
            <Field label="Temporary address"><textarea rows={2} className={textarea} value={f.temporaryAddress} onChange={(ev) => set("temporaryAddress", ev.target.value)} /></Field>
            <Field label="Bank name"><Input value={f.bankName} onChange={(ev) => set("bankName", ev.target.value)} /></Field>
            <Field label="Branch"><Input value={f.bankBranch} onChange={(ev) => set("bankBranch", ev.target.value)} /></Field>
            <Field label="Account no."><Input value={f.account} onChange={(ev) => set("account", ev.target.value)} /></Field>
            <Field label="IFSC"><Input value={f.ifsc} onChange={(ev) => set("ifsc", ev.target.value)} /></Field>
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Qualification</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Highest qualification"><Input value={f.qualification} onChange={(ev) => set("qualification", ev.target.value)} /></Field>
            <Field label="Institution"><Input value={f.institution} onChange={(ev) => set("institution", ev.target.value)} /></Field>
            <Field label="Pass year"><Input value={f.passYear} onChange={(ev) => set("passYear", ev.target.value)} /></Field>
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Documents</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {UPLOAD_DOCS.map((t) => {
              const up = docs[t];
              return (
                <label key={t} className="flex cursor-pointer items-center justify-between gap-2 rounded-md border p-2.5 text-sm transition-colors hover:bg-muted">
                  <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /> {t}</span>
                  {up ? <Badge tone="success"><Check className="h-3 w-3" /> {up.fileName.length > 16 ? up.fileName.slice(0, 14) + "…" : up.fileName}</Badge> : <span className="flex items-center gap-1 text-xs text-primary"><Upload className="h-3.5 w-3.5" /> Upload</span>}
                  <input type="file" className="hidden" accept={t === "Photo" ? "image/*" : "image/*,.pdf"} onChange={(ev) => onFile(t, ev.target.files?.[0])} />
                </label>
              );
            })}
          </div>
        </section>

        {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-xs font-medium text-danger">{error}</p>}
        <div className="flex justify-end gap-2 border-t pt-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save changes</Button>
        </div>
      </div>
    </Modal>
  );
}

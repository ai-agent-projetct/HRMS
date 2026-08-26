"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { GARMENT_ROLES, DOC_TYPES, type HrEmployee, type EmpDocument, type DocType } from "@/lib/hr-data";
import { allCategories, allDepartments, SHIFTS, AGENTS, type WorkerCategoryId } from "@/lib/hr-master";
import { useHr } from "@/stores/hr";
import { Upload, Check, FileText } from "lucide-react";

const UPLOAD_DOCS: DocType[] = ["Aadhaar", "PAN", "Degree Certificate", "Experience Certificate", "Bank Passbook", "Photo"];
const ACCOMMODATION = ["Own arrangement", "Company Bus", "Hosteller", "Hosteller + Mess", "Mess only"];
const MAX_DATAURL = 1_500_000; // keep localStorage sane — store preview only for small files

type Uploaded = { fileName: string; dataUrl?: string };

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

const selectCls = "flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function AddEmployeeModal({
  nextIndex, onSubmit, onClose,
}: {
  nextIndex: number;
  onSubmit: (emp: HrEmployee) => void;
  onClose: () => void;
}) {
  const units = useHr((s) => s.units);
  const [f, setF] = useState({
    name: "", fatherName: "", gender: "Male", category: "Permanent", categoryOther: "",
    role: GARMENT_ROLES[0] as string, roleOther: "",
    department: "", section: "", shift: SHIFTS[0].id, wageType: "Monthly",
    pay: "", employmentType: "Fresher", doj: "2026-07-25",
    unit: units[0] ?? "", location: "", agentId: "",
    aadhaar: "", pan: "",
    bankName: "", bankBranch: "", bankAccount: "", bankIfsc: "",
    phone: "", emergencyContact: "", emergencyPhone: "",
    permanentAddress: "", temporaryAddress: "", accommodation: ACCOMMODATION[0],
  });
  const [pf, setPf] = useState(true);
  const [tds, setTds] = useState(false);
  const [docs, setDocs] = useState<Record<string, Uploaded>>({});
  const [error, setError] = useState("");

  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const isMcOthers = f.category === "MC & Others";
  const isCustomRole = f.role === "Others…";
  const isDaily = f.wageType !== "Monthly";

  const onFile = (type: string, file?: File) => {
    if (!file) { setDocs((d) => { const n = { ...d }; delete n[type]; return n; }); return; }
    const rec: Uploaded = { fileName: file.name };
    if (file.size <= MAX_DATAURL) {
      const reader = new FileReader();
      reader.onload = () => setDocs((d) => ({ ...d, [type]: { fileName: file.name, dataUrl: reader.result as string } }));
      reader.readAsDataURL(file);
    }
    setDocs((d) => ({ ...d, [type]: rec }));
  };

  const submit = () => {
    if (!f.name.trim()) return setError("Full name is required.");
    if (isMcOthers && !f.categoryOther.trim()) return setError("Please specify the category for “MC & Others”.");
    if (isCustomRole && !f.roleOther.trim()) return setError("Please enter the custom role.");
    if (!f.department.trim()) return setError("Department is required.");
    if (!f.unit.trim()) return setError("Company branch / unit is required.");
    if (!f.pay.trim() || isNaN(Number(f.pay))) return setError("Enter a valid pay amount.");
    if (!f.phone.trim()) return setError("Phone is required.");

    const catDef = allCategories().find((c) => c.label === f.category)!;
    const category = catDef.id as WorkerCategoryId;
    const role = isCustomRole ? f.roleOther.trim() : f.role;
    const pay = Number(f.pay);
    const monthly = isDaily ? pay * 26 : pay;
    const id = `EMP-${String(900 + nextIndex).padStart(4, "0")}`;

    const documents: EmpDocument[] = UPLOAD_DOCS.map((t) => {
      const up = docs[t];
      return { type: t, number: up?.fileName ?? "—", submitted: !!up, verified: false, fileName: up?.fileName, dataUrl: up?.dataUrl };
    });

    const aadhaar = f.aadhaar.trim() || (docs["Aadhaar"]?.fileName ? "Uploaded" : "—");
    const pan = f.pan.trim() || (docs["PAN"]?.fileName ? "Uploaded" : "—");
    const bankName = f.bankName.trim();
    const bankBranch = f.bankBranch.trim();
    const bankAccount = f.bankAccount.trim();
    const bankIfsc = f.bankIfsc.trim();
    const hasBank = !!(bankName || bankAccount || bankIfsc);

    const emp: HrEmployee = {
      id, salutation: f.gender === "Female" ? "Ms." : "Mr.", name: f.name.trim(),
      fatherName: f.fatherName.trim() || undefined,
      gender: f.gender as "Male" | "Female", dob: "1995-01-01", bloodGroup: "—",
      role, department: f.department.trim(), section: f.section.trim() || undefined,
      grade: "W1", reportsTo: "—", employmentType: f.employmentType as HrEmployee["employmentType"],
      status: "Probation", doj: f.doj, prevExpYears: f.employmentType === "Fresher" ? 0 : 1,
      prevExpDetail: f.employmentType === "Fresher" ? "Fresher" : "Prior experience — to verify",
      phone: f.phone.trim(), altPhone: "—",
      email: `${f.name.toLowerCase().replace(/[^a-z]/g, ".")}@company.in`,
      address: f.permanentAddress.trim() || "—", temporaryAddress: f.temporaryAddress.trim() || undefined,
      unit: f.unit.trim() || undefined, location: f.location.trim() || undefined,
      accommodation: f.accommodation, emergencyContact: f.emergencyContact.trim() || "—",
      emergencyPhone: f.emergencyPhone.trim() || undefined,
      qualification: "—", institution: "—", passYear: 0,
      aadhaar, pan,
      uan: "—", esiNo: "—", monthlyGross: monthly, ctc: monthly * 13,
      wageType: f.wageType as HrEmployee["wageType"], category,
      categoryOther: isMcOthers ? f.categoryOther.trim() : undefined,
      shiftId: f.shift, salaryPerDay: isDaily ? pay : undefined,
      agentId: f.agentId || undefined, conduct: "Proper",
      pfApplicable: pf, tdsApplicable: tds,
      bankName: bankName || undefined, bankBranch: bankBranch || undefined,
      bankAccount: bankAccount || undefined, bankIfsc: bankIfsc || undefined,
      health: { heightCm: undefined, weightKg: undefined },
      documents,
      salaryHistory: [{ fy: "2026-27", monthlyGross: monthly, annualPaid: 0, bank: bankName || "—", account: bankAccount || "—", creditedDay: "7th of month" }],
      bankHistory: hasBank ? [{ bank: bankName || "—", account: bankAccount || "—", ifsc: bankIfsc || "—", from: f.doj, to: "Current" }] : [],
      leave: { el: 0, cl: 0, sl: 0, lopThisMonth: 0 },
    };
    onSubmit(emp);
    onClose();
  };

  return (
    <Modal title="Add employee" description="Full onboarding — profile, wage, statutory settings and document uploads." onClose={onClose} wide>
      <div className="space-y-5">
        {/* Personal */}
        <section className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Personal</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name" required><Input value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
            <Field label="Father's / guardian name"><Input value={f.fatherName} placeholder="for statutory register" onChange={(e) => set("fatherName", e.target.value)} /></Field>
            <Field label="Gender"><select className={selectCls} value={f.gender} onChange={(e) => set("gender", e.target.value)}><option>Male</option><option>Female</option></select></Field>
          </div>
        </section>

        {/* Role & category */}
        <section className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Role & category</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Worker category" required>
              <select className={selectCls} value={f.category} onChange={(e) => set("category", e.target.value)}>
                {allCategories().map((c) => <option key={c.id} value={c.label}>{c.label}</option>)}
              </select>
            </Field>
            {isMcOthers && (
              <Field label="Specify category" required>
                <Input value={f.categoryOther} placeholder="e.g. Contract Maintenance" onChange={(e) => set("categoryOther", e.target.value)} />
              </Field>
            )}
            <Field label="Role" required>
              <select className={selectCls} value={f.role} onChange={(e) => set("role", e.target.value)}>
                {GARMENT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                <option value="Others…">Others…</option>
              </select>
            </Field>
            {isCustomRole && (
              <Field label="Enter role" required>
                <Input value={f.roleOther} placeholder="e.g. Bleaching Operator" onChange={(e) => set("roleOther", e.target.value)} />
              </Field>
            )}
            <Field label="Department" required><Input list="dept-options" value={f.department} placeholder="e.g. Dyeing" onChange={(e) => set("department", e.target.value)} /><datalist id="dept-options">{allDepartments().map((d) => <option key={d} value={d} />)}</datalist></Field>
            <Field label="Section"><Input value={f.section} placeholder="e.g. Soft-flow machines" onChange={(e) => set("section", e.target.value)} /></Field>
            <Field label="Shift">
              <select className={selectCls} value={f.shift} onChange={(e) => set("shift", e.target.value)}>
                {SHIFTS.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name} ({s.time})</option>)}
              </select>
            </Field>
            <Field label="Employment type"><select className={selectCls} value={f.employmentType} onChange={(e) => set("employmentType", e.target.value)}><option>Fresher</option><option>Experienced</option></select></Field>
            <Field label="Date of joining" required><Input type="date" value={f.doj} onChange={(e) => set("doj", e.target.value)} /></Field>
            <Field label="Company branch / unit" required>
              <select className={selectCls} value={f.unit} onChange={(e) => set("unit", e.target.value)}>
                <option value="">— Select branch —</option>
                {units.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
            <Field label="Location / area"><Input value={f.location} placeholder="e.g. Tiruppur (native place)" onChange={(e) => set("location", e.target.value)} /></Field>
            <Field label="Agent / through">
              <select className={selectCls} value={f.agentId} onChange={(e) => set("agentId", e.target.value)}>
                <option value="">Direct hire — no agent</option>
                {AGENTS.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.place}</option>)}
              </select>
            </Field>
          </div>
        </section>

        {/* Identity (KYC) */}
        <section className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Identity (KYC)</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Aadhaar card no."><Input value={f.aadhaar} placeholder="e.g. 1234 5678 9012" onChange={(e) => set("aadhaar", e.target.value)} /></Field>
            <Field label="PAN card no."><Input value={f.pan} placeholder="e.g. ABCDE1234F" onChange={(e) => set("pan", e.target.value.toUpperCase())} /></Field>
          </div>
        </section>

        {/* Bank details */}
        <section className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Bank details</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Bank name"><Input value={f.bankName} placeholder="e.g. HDFC Bank" onChange={(e) => set("bankName", e.target.value)} /></Field>
            <Field label="Branch"><Input value={f.bankBranch} placeholder="e.g. Tiruppur Main" onChange={(e) => set("bankBranch", e.target.value)} /></Field>
            <Field label="Account no."><Input value={f.bankAccount} placeholder="e.g. 50100XXXXXXXX" onChange={(e) => set("bankAccount", e.target.value)} /></Field>
            <Field label="IFSC code"><Input value={f.bankIfsc} placeholder="e.g. HDFC0001234" onChange={(e) => set("bankIfsc", e.target.value.toUpperCase())} /></Field>
          </div>
        </section>

        {/* Wage & statutory */}
        <section className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Wage & statutory</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Wage type" required>
              <div className="flex gap-1.5">
                {(["Daily", "Weekly", "Monthly"] as const).map((w) => (
                  <Button key={w} type="button" variant={f.wageType === w ? "default" : "outline"} size="sm" className="flex-1" onClick={() => set("wageType", w)}>{w}</Button>
                ))}
              </div>
            </Field>
            <Field label={isDaily ? "Wage per day (₹)" : "Monthly gross (₹)"} required>
              <Input value={f.pay} placeholder={isDaily ? "e.g. 620" : "e.g. 28000"} onChange={(e) => set("pay", e.target.value)} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-4 rounded-lg border border-dashed p-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={pf} onChange={(e) => setPf(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
              PF / ESI applicable
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={tds} onChange={(e) => setTds(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
              TDS applicable
            </label>
            <span className="text-[11px] text-muted-foreground">Untick to exempt this worker from a statutory deduction.</span>
          </div>
        </section>

        {/* Contact & address */}
        <section className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Contact & address</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Phone" required><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
            <Field label="Accommodation / transport">
              <select className={selectCls} value={f.accommodation} onChange={(e) => set("accommodation", e.target.value)}>
                {ACCOMMODATION.map((a) => <option key={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="Emergency contact (name)"><Input value={f.emergencyContact} placeholder="e.g. Father — Palani" onChange={(e) => set("emergencyContact", e.target.value)} /></Field>
            <Field label="Emergency contact no."><Input value={f.emergencyPhone} placeholder="+91 …" onChange={(e) => set("emergencyPhone", e.target.value)} /></Field>
            <Field label="Permanent address"><textarea rows={2} className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={f.permanentAddress} onChange={(e) => set("permanentAddress", e.target.value)} /></Field>
            <Field label="Temporary / local address"><textarea rows={2} className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={f.temporaryAddress} onChange={(e) => set("temporaryAddress", e.target.value)} /></Field>
          </div>
        </section>

        {/* Documents */}
        <section className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Documents</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {UPLOAD_DOCS.map((t) => {
              const up = docs[t];
              return (
                <label key={t} className="flex cursor-pointer items-center justify-between gap-2 rounded-md border p-2.5 text-sm transition-colors hover:bg-muted">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" /> {t}
                  </span>
                  {up ? (
                    <Badge tone="success"><Check className="h-3 w-3" /> {up.fileName.length > 16 ? up.fileName.slice(0, 14) + "…" : up.fileName}</Badge>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-primary"><Upload className="h-3.5 w-3.5" /> Upload</span>
                  )}
                  <input type="file" className="hidden" accept={t === "Photo" ? "image/*" : "image/*,.pdf"} onChange={(e) => onFile(t, e.target.files?.[0])} />
                </label>
              );
            })}
          </div>
        </section>

        {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-xs font-medium text-danger">{error}</p>}
        <div className="flex justify-end gap-2 border-t pt-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Add employee</Button>
        </div>
      </div>
    </Modal>
  );
}

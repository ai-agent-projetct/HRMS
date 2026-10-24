"use client";

import { useRef, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { FormModal } from "@/components/form-modal";
import { useToast } from "@/components/ui/toast";
import { downloadExcel, parseExcelFile } from "@/lib/excel";
import { bmi, bmiBand, type HrEmployee } from "@/lib/hr-data";
import { useHr , useCanEdit, TODAY } from "@/stores/hr";
import { HeartPulse, Users, Baby, Droplet, Stethoscope, FileSpreadsheet, Pencil, FileUp } from "lucide-react";

const selCls = "h-8 rounded-md border border-input bg-card px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring";

/** Age in whole years from a YYYY-MM-DD dob ("" when unknown / placeholder). */
function ageOf(dob?: string): number | "" {
  if (!dob || !/^\d{4}-\d{2}-\d{2}/.test(dob)) return "";
  const [y, m, d] = dob.slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = TODAY.split("-").map(Number);
  const a = ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
  return a >= 0 && a < 120 ? a : "";
}

export default function HealthPage() {
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<"All" | "Boys" | "Girls" | "Alerts">("All");
  const [deptF, setDeptF] = useState("All");
  const [unitF, setUnitF] = useState("All");
  const [edit, setEdit] = useState<HrEmployee | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mayEdit = useCanEdit();
  const employees = useHr((s) => s.employees);
  const units = useHr((s) => s.units);
  const updateHealth = useHr((s) => s.updateHealth);
  const push = useToast((s) => s.push);
  const departments = [...new Set(employees.map((e) => e.department).filter((d) => d && d !== "—"))].sort();

  const withAlert = (e: HrEmployee) => {
    const b = bmi(e.health);
    return (e.health?.hemoglobin !== undefined && e.health.hemoglobin < 11) || e.health?.pregnant || (b !== null && (b < 18.5 || b >= 30)) || !!e.health?.ailments;
  };

  const onRoll = employees.filter((e) => e.status !== "Exited"); // health register = current workforce
  const rows = onRoll
    .filter((e) => scope === "All" || (scope === "Girls" ? e.gender === "Female" : scope === "Boys" ? e.gender === "Male" : withAlert(e)))
    .filter((e) => deptF === "All" || e.department === deptF)
    .filter((e) => unitF === "All" || (e.unit ?? "") === unitF)
    .filter((e) => `${e.name} ${e.id} ${e.department}`.toLowerCase().includes(q.toLowerCase()));

  const women = onRoll.filter((e) => e.gender === "Female");
  const men = onRoll.filter((e) => e.gender === "Male");
  const pregnant = women.filter((e) => e.health?.pregnant).length;
  const anaemia = onRoll.filter((e) => e.health?.hemoglobin !== undefined && e.health.hemoglobin < 11).length;

  // Import health readings from Excel: one row per worker keyed by Emp ID / Emp No.
  // Only the columns present are written; blank cells leave the old value alone.
  const importHealth = async (file?: File) => {
    if (!file) return;
    try {
      const { rows: xr } = await parseExcelFile(file, { headerContains: ["Emp ID", "Emp No", "EMP NO", "Emp. No"] });
      const pick = (r: Record<string, string | number>, ...names: string[]) => {
        const key = Object.keys(r).find((k) => names.some((n) => k.trim().toLowerCase() === n.toLowerCase()));
        const v = key ? String(r[key]).trim() : "";
        return v === "" ? undefined : v;
      };
      const num = (v?: string) => (v !== undefined && !isNaN(Number(v)) ? Number(v) : undefined);
      let updated = 0, missing = 0;
      for (const r of xr) {
        const id = pick(r, "Emp ID", "Emp No", "Emp. No", "Employee ID");
        if (!id) continue;
        const emp = employees.find((e) => e.id.toLowerCase() === id.toLowerCase() || (e.tokenNo ?? "").toLowerCase() === id.toLowerCase());
        if (!emp) { missing++; continue; }
        const patch: Partial<NonNullable<HrEmployee["health"]>> = {};
        const h = num(pick(r, "Height cm", "Height", "Height (cm)")); if (h !== undefined) patch.heightCm = h;
        const w = num(pick(r, "Weight kg", "Weight", "Weight (kg)")); if (w !== undefined) patch.weightKg = w;
        const bp = pick(r, "BP", "Blood pressure"); if (bp) patch.bloodPressure = bp;
        const hb = num(pick(r, "Hb g/dL", "Hb", "Haemoglobin", "Hemoglobin")); if (hb !== undefined) patch.hemoglobin = hb;
        const chk = pick(r, "Last checkup", "Checkup date", "Date"); if (chk) patch.lastCheckup = chk;
        const notes = pick(r, "Notes", "Ailments", "Remarks"); if (notes) patch.ailments = notes;
        if (Object.keys(patch).length) { updateHealth(emp.id, patch); updated++; }
      }
      push("Health records imported", `${updated} updated${missing ? ` · ${missing} Emp ID(s) not found` : ""}.`);
    } catch (err) {
      push("Import failed", err instanceof Error ? err.message : "Could not read the Excel file.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const exportHealth = () =>
    downloadExcel({
      filename: `health-records${scope === "Boys" ? "-boys" : scope === "Girls" ? "-girls" : ""}`, sheetName: "Health",
      title: `Workforce Health Records${scope === "Boys" ? " — Boys / Men" : scope === "Girls" ? " — Girls / Women" : ""} (confidential)`,
      columns: [
        { header: "Emp No", key: "id" }, { header: "Name", key: "name", width: 22 }, { header: "Father's Name", key: "father", width: 20 },
        { header: "Age", key: "age" }, { header: "Phone No", key: "phone", width: 14 }, { header: "Aadhaar", key: "aadhaar", width: 16 },
        { header: "Address", key: "address", width: 34 }, { header: "Gender", key: "gender" },
        { header: "Department", key: "dept" }, { header: "Unit", key: "unit" },
        { header: "Height cm", key: "h" }, { header: "Weight kg", key: "w" }, { header: "BMI", key: "bmi" },
        { header: "BP", key: "bp" }, { header: "Hb g/dL", key: "hb" }, { header: "Last checkup", key: "chk" },
        { header: "Last period", key: "lp" }, { header: "Cycle", key: "cyc" }, { header: "Pregnant", key: "preg" }, { header: "Notes", key: "notes", width: 30 },
      ],
      rows: rows.map((e) => ({
        id: e.id, name: e.name, father: e.fatherName ?? "", age: ageOf(e.dob),
        phone: e.phone && e.phone !== "—" ? e.phone : "", aadhaar: e.aadhaar && e.aadhaar !== "—" ? e.aadhaar : "",
        address: e.address && e.address !== "—" ? e.address : (e.temporaryAddress ?? ""),
        dept: e.department, unit: e.unit ?? "",
        gender: e.gender, h: e.health?.heightCm ?? "", w: e.health?.weightKg ?? "",
        bmi: bmi(e.health) ?? "", bp: e.health?.bloodPressure ?? "", hb: e.health?.hemoglobin ?? "", chk: e.health?.lastCheckup ?? "",
        lp: e.gender === "Female" ? e.health?.lastPeriodDate ?? "" : "", cyc: e.gender === "Female" ? e.health?.cycleDays ?? "" : "",
        preg: e.gender === "Female" ? (e.health?.pregnant ? "Yes" : "No") : "", notes: e.health?.ailments ?? e.health?.pregnancyNote ?? "",
      })),
    });

  return (
    <>
      <PageHeader
        title="Health Check"
        description="Occupational health register — height/weight (BMI), blood pressure, haemoglobin and periodic checkups, plus menstrual & maternity tracking for women workers"
        actions={
          <>
            {mayEdit && (
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} title="Import health readings — columns: Emp ID, Height cm, Weight kg, BP, Hb g/dL, Last checkup, Notes">
                <FileUp className="h-4 w-4" /> Import
              </Button>
            )}
            <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={(ev) => importHealth(ev.target.files?.[0])} />
            <Button variant="outline" size="sm" onClick={exportHealth}><FileSpreadsheet className="h-4 w-4" /> Export</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Records" value={`${onRoll.length}`} icon={Users} sub={`${men.length} boys/men · ${women.length} girls/women`} />
        <KpiCard label="Girls / women" value={`${women.length}`} icon={HeartPulse} sub="menstrual/maternity tracked" tone="info" />
        <KpiCard label="Pregnant" value={`${pregnant}`} icon={Baby} sub="lighter duty / maternity" tone="warning" />
        <KpiCard label="Low haemoglobin" value={`${anaemia}`} icon={Droplet} sub="anaemia screening (<11)" tone="danger" />
      </div>

      <Card>
        <CardContent className="py-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {(["All", "Boys", "Girls", "Alerts"] as const).map((s) => (
                <Button key={s} variant={scope === s ? "default" : "outline"} size="sm" className="h-7 px-2.5 text-[11px]" onClick={() => setScope(s)}>
                  {s}{s === "Boys" ? ` (${men.length})` : s === "Girls" ? ` (${women.length})` : ""}
                </Button>
              ))}
              <select value={deptF} onChange={(e) => setDeptF(e.target.value)} className={`${selCls} ml-1`} title="Department">
                <option value="All">All departments</option>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={unitF} onChange={(e) => setUnitF(e.target.value)} className={selCls} title="Unit">
                <option value="All">All units</option>
                {units.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <Input placeholder="Search name, ID, dept…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
          </div>
          <Table>
            <THead>
              <TR><TH>Emp ID</TH><TH>Name</TH><TH>Dept</TH><TH>Unit</TH><TH className="text-center">Age</TH><TH className="text-center">Wt / Ht</TH><TH>BMI</TH><TH>BP</TH><TH>Hb</TH><TH>Last checkup</TH><TH>Women’s health</TH><TH></TH></TR>
            </THead>
            <TBody>
              {rows.map((e) => {
                const b = bmi(e.health);
                const band = bmiBand(b);
                const lowHb = e.health?.hemoglobin !== undefined && e.health.hemoglobin < 11;
                return (
                  <TR key={e.id}>
                    <TD className="font-mono text-xs text-muted-foreground">{e.id}</TD>
                    <TD className="font-medium">{e.name}<div className="text-xs font-normal text-muted-foreground">{e.gender}{e.fatherName ? ` · F/o ${e.fatherName}` : ""}</div></TD>
                    <TD className="text-xs">{e.department}</TD>
                    <TD className="text-xs">{e.unit ?? "—"}</TD>
                    <TD className="text-center text-xs">{ageOf(e.dob) || "—"}</TD>
                    <TD className="text-center">{e.health?.weightKg ?? "—"}kg / {e.health?.heightCm ?? "—"}cm</TD>
                    <TD>{b !== null ? <span className="inline-flex items-center gap-1.5">{b}<Badge tone={band.tone}>{band.label}</Badge></span> : "—"}</TD>
                    <TD className="text-muted-foreground">{e.health?.bloodPressure ?? "—"}</TD>
                    <TD>{e.health?.hemoglobin !== undefined ? <span className={lowHb ? "font-semibold text-danger" : ""}>{e.health.hemoglobin}</span> : "—"}</TD>
                    <TD className="text-muted-foreground">{e.health?.lastCheckup ?? "—"}</TD>
                    <TD>
                      {e.gender === "Female" ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {e.health?.pregnant && <Badge tone="warning">Pregnant</Badge>}
                          <span className="text-xs text-muted-foreground">LMP {e.health?.lastPeriodDate ?? "—"} · {e.health?.cycleDays ?? "—"}d</span>
                        </div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TD>
                    <TD>
                      {mayEdit && <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => setEdit(e)}><Pencil className="h-3 w-3" /> Update</Button>}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          {rows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No records match.</p>}
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><Stethoscope className="h-3.5 w-3.5" /> Confidential — visible to HR & the factory nurse only.</p>
        </CardContent>
      </Card>

      {edit && (
        <FormModal
          title={`Health — ${edit.name}`}
          description="Recorded by the factory nurse; women’s fields appear only for women workers."
          submitLabel="Save health record"
          onClose={() => setEdit(null)}
          fields={[
            { name: "heightCm", label: "Height (cm)", type: "number", defaultValue: String(edit.health?.heightCm ?? "") },
            { name: "weightKg", label: "Weight (kg)", type: "number", defaultValue: String(edit.health?.weightKg ?? "") },
            { name: "bloodPressure", label: "Blood pressure", defaultValue: edit.health?.bloodPressure ?? "", placeholder: "120/80" },
            { name: "hemoglobin", label: "Haemoglobin (g/dL)", type: "number", defaultValue: String(edit.health?.hemoglobin ?? "") },
            { name: "lastCheckup", label: "Last checkup", type: "date", defaultValue: edit.health?.lastCheckup ?? TODAY },
            { name: "ailments", label: "Ailments / notes", type: "textarea", defaultValue: edit.health?.ailments ?? "" },
            ...(edit.gender === "Female" ? [
              { name: "lastPeriodDate", label: "Last period date", type: "date" as const, defaultValue: edit.health?.lastPeriodDate ?? "" },
              { name: "cycleDays", label: "Cycle length (days)", type: "number" as const, defaultValue: String(edit.health?.cycleDays ?? "") },
              { name: "pregnant", label: "Pregnant?", type: "select" as const, options: ["No", "Yes"], defaultValue: edit.health?.pregnant ? "Yes" : "No" },
              { name: "pregnancyNote", label: "Maternity note", type: "textarea" as const, defaultValue: edit.health?.pregnancyNote ?? "" },
            ] : []),
          ]}
          onSubmit={(v) => {
            updateHealth(edit.id, {
              heightCm: v.heightCm ? Number(v.heightCm) : undefined,
              weightKg: v.weightKg ? Number(v.weightKg) : undefined,
              bloodPressure: v.bloodPressure || undefined,
              hemoglobin: v.hemoglobin ? Number(v.hemoglobin) : undefined,
              lastCheckup: v.lastCheckup || undefined,
              ailments: v.ailments || undefined,
              ...(edit.gender === "Female" ? {
                lastPeriodDate: v.lastPeriodDate || undefined,
                cycleDays: v.cycleDays ? Number(v.cycleDays) : undefined,
                pregnant: v.pregnant === "Yes",
                pregnancyNote: v.pregnancyNote || undefined,
              } : {}),
            });
            push(`Health record updated — ${edit.name}`, "Saved to the confidential occupational health register.");
          }}
        />
      )}
    </>
  );
}

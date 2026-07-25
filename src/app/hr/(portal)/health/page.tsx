"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { FormModal } from "@/components/form-modal";
import { useToast } from "@/components/ui/toast";
import { downloadExcel } from "@/lib/excel";
import { bmi, bmiBand, type HrEmployee } from "@/lib/hr-data";
import { useHr } from "@/stores/hr";
import { HeartPulse, Users, Baby, Droplet, Stethoscope, FileSpreadsheet, Pencil } from "lucide-react";

export default function HealthPage() {
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<"All" | "Women" | "Alerts">("All");
  const [edit, setEdit] = useState<HrEmployee | null>(null);
  const employees = useHr((s) => s.employees);
  const updateHealth = useHr((s) => s.updateHealth);
  const push = useToast((s) => s.push);

  const withAlert = (e: HrEmployee) => {
    const b = bmi(e.health);
    return (e.health?.hemoglobin !== undefined && e.health.hemoglobin < 11) || e.health?.pregnant || (b !== null && (b < 18.5 || b >= 30)) || !!e.health?.ailments;
  };

  const rows = employees
    .filter((e) => scope === "All" || (scope === "Women" ? e.gender === "Female" : withAlert(e)))
    .filter((e) => `${e.name} ${e.id} ${e.department}`.toLowerCase().includes(q.toLowerCase()));

  const women = employees.filter((e) => e.gender === "Female");
  const pregnant = women.filter((e) => e.health?.pregnant).length;
  const anaemia = employees.filter((e) => e.health?.hemoglobin !== undefined && e.health.hemoglobin < 11).length;

  const exportHealth = () =>
    downloadExcel({
      filename: "health-records", sheetName: "Health", title: "Workforce Health Records (confidential)",
      columns: [
        { header: "Emp ID", key: "id" }, { header: "Name", key: "name", width: 22 }, { header: "Gender", key: "gender" },
        { header: "Height cm", key: "h" }, { header: "Weight kg", key: "w" }, { header: "BMI", key: "bmi" },
        { header: "BP", key: "bp" }, { header: "Hb g/dL", key: "hb" }, { header: "Last checkup", key: "chk" },
        { header: "Last period", key: "lp" }, { header: "Cycle", key: "cyc" }, { header: "Pregnant", key: "preg" }, { header: "Notes", key: "notes", width: 30 },
      ],
      rows: rows.map((e) => ({
        id: e.id, name: e.name, gender: e.gender, h: e.health?.heightCm ?? "", w: e.health?.weightKg ?? "",
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
        actions={<Button variant="outline" size="sm" onClick={exportHealth}><FileSpreadsheet className="h-4 w-4" /> Export</Button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Records" value={`${employees.length}`} icon={Users} sub="workforce covered" />
        <KpiCard label="Women workers" value={`${women.length}`} icon={HeartPulse} sub="menstrual/maternity tracked" tone="info" />
        <KpiCard label="Pregnant" value={`${pregnant}`} icon={Baby} sub="lighter duty / maternity" tone="warning" />
        <KpiCard label="Low haemoglobin" value={`${anaemia}`} icon={Droplet} sub="anaemia screening (<11)" tone="danger" />
      </div>

      <Card>
        <CardContent className="py-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {(["All", "Women", "Alerts"] as const).map((s) => (
                <Button key={s} variant={scope === s ? "default" : "outline"} size="sm" className="h-7 px-2.5 text-[11px]" onClick={() => setScope(s)}>{s}</Button>
              ))}
            </div>
            <Input placeholder="Search name, ID, dept…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
          </div>
          <Table>
            <THead>
              <TR><TH>Emp ID</TH><TH>Name</TH><TH className="text-center">Wt / Ht</TH><TH>BMI</TH><TH>BP</TH><TH>Hb</TH><TH>Last checkup</TH><TH>Women’s health</TH><TH></TH></TR>
            </THead>
            <TBody>
              {rows.map((e) => {
                const b = bmi(e.health);
                const band = bmiBand(b);
                const lowHb = e.health?.hemoglobin !== undefined && e.health.hemoglobin < 11;
                return (
                  <TR key={e.id}>
                    <TD className="font-mono text-xs text-muted-foreground">{e.id}</TD>
                    <TD className="font-medium">{e.name}<div className="text-xs font-normal text-muted-foreground">{e.gender}</div></TD>
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
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => setEdit(e)}><Pencil className="h-3 w-3" /> Update</Button>
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
            { name: "lastCheckup", label: "Last checkup", type: "date", defaultValue: edit.health?.lastCheckup ?? "2026-07-01" },
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

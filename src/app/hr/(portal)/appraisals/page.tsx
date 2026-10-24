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
import { useHr, type AppraisalRecord , useCanEdit, TODAY, CURRENT_MONTH } from "@/stores/hr";
import { suggestedAppraisal, ratingBand, overallFromScores, APPRAISAL_CYCLE } from "@/lib/appraisal";
import { categoryById, categoryIdOf, allCategories } from "@/lib/hr-master";
import type { HrEmployee } from "@/lib/hr-data";
import { Star, Award, TrendingUp, AlertTriangle, FileSpreadsheet, Pencil, CheckCircle2 } from "lucide-react";

const selCls = "h-8 rounded-md border border-input bg-card px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring";

export default function AppraisalsPage() {
  const [q, setQ] = useState("");
  const [deptF, setDeptF] = useState("All");
  const [unitF, setUnitF] = useState("All");
  const [catF, setCatF] = useState("All");
  const employees = useHr((s) => s.employees);
  const units = useHr((s) => s.units);
  const departments = [...new Set(employees.map((e) => e.department).filter((d) => d && d !== "—"))].sort();
  const usedCats = new Set(employees.map((e) => categoryIdOf(e.category)));
  const attendance = useHr((s) => s.attendance);
  const appraisals = useHr((s) => s.appraisals);
  const setAppraisal = useHr((s) => s.setAppraisal);
  const push = useToast((s) => s.push);
  const [editing, setEditing] = useState<HrEmployee | null>(null);
  const mayEdit = useCanEdit();

  const active = employees.filter((e) => e.status !== "Exited");
  const stored = (id: string) => appraisals.find((a) => a.empId === id && a.cycle === APPRAISAL_CYCLE);

  const rows = active
    .filter((e) => deptF === "All" || e.department === deptF)
    .filter((e) => unitF === "All" || (e.unit ?? "") === unitF)
    .filter((e) => catF === "All" || categoryIdOf(e.category) === catF)
    .filter((e) => `${e.name} ${e.id} ${e.role} ${e.department}`.toLowerCase().includes(q.toLowerCase()))
    .map((e) => {
      const s = stored(e.id);
      const sug = suggestedAppraisal(e, attendance, CURRENT_MONTH);
      const overall = s?.overall ?? sug.overall;
      const band = ratingBand(overall);
      const incrementPct = s?.incrementPct ?? sug.incrementPct;
      return { e, sug, overall, band, incrementPct, finalized: !!s };
    });

  const avg = rows.length ? (rows.reduce((s, r) => s + r.overall, 0) / rows.length).toFixed(1) : "0";
  const topRated = rows.filter((r) => r.overall >= 3.8).length;
  const needsImprovement = rows.filter((r) => r.overall < 3).length;
  const finalized = rows.filter((r) => r.finalized).length;

  const exportAppraisals = () =>
    downloadExcel({
      filename: `appraisals-${APPRAISAL_CYCLE}`, sheetName: "Appraisals", title: `Performance Appraisals — ${APPRAISAL_CYCLE}`,
      columns: [
        { header: "Emp ID", key: "id" }, { header: "Name", key: "name", width: 22 }, { header: "Role", key: "role", width: 18 },
        { header: "Department", key: "dept" }, { header: "Unit", key: "unit" }, { header: "Category", key: "cat", width: 16 },
        { header: "Productivity", key: "productivity" }, { header: "Quality", key: "quality" }, { header: "Attendance", key: "attendance" },
        { header: "Discipline", key: "discipline" }, { header: "Teamwork", key: "teamwork" },
        { header: "Overall (5)", key: "overall" }, { header: "Band", key: "band" }, { header: "Increment %", key: "inc" }, { header: "Finalized", key: "fin" },
        { header: "Reviewer note", key: "note", width: 30 }, { header: "Study / remarks", key: "study", width: 30 },
      ],
      rows: rows.map((r) => {
        const s = stored(r.e.id) ?? r.sug;
        const st = stored(r.e.id);
        return { note: st?.note ?? "", study: st?.study ?? "", dept: r.e.department, unit: r.e.unit ?? "", cat: categoryById(r.e.category)?.label ?? r.e.category, id: r.e.id, name: r.e.name, role: r.e.role, productivity: s.productivity, quality: s.quality, attendance: s.attendance, discipline: s.discipline, teamwork: s.teamwork, overall: r.overall, band: r.band.band, inc: r.incrementPct, fin: r.finalized ? "Yes" : "Suggested" };
      }),
    });

  return (
    <>
      <PageHeader
        title="Performance & Appraisals"
        description={`${APPRAISAL_CYCLE} — ratings suggested from attendance, conduct and output; adjust and finalise with a recommended increment`}
        actions={<Button variant="outline" size="sm" onClick={exportAppraisals}><FileSpreadsheet className="h-4 w-4" /> Export</Button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Average rating" value={`${avg} / 5`} icon={Star} sub={`${active.length} appraisals`} />
        <KpiCard label="Top rated" value={`${topRated}`} icon={TrendingUp} sub="Exceeds / Outstanding" tone="success" />
        <KpiCard label="Needs improvement" value={`${needsImprovement}`} icon={AlertTriangle} sub="below Meets" tone="warning" />
        <KpiCard label="Finalized" value={`${finalized}/${active.length}`} icon={CheckCircle2} sub="HR-confirmed" tone="info" />
      </div>

      <Card>
        <CardContent className="py-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="mr-1 text-sm font-bold">Appraisal register — {APPRAISAL_CYCLE}</p>
              <select value={deptF} onChange={(e) => setDeptF(e.target.value)} className={selCls} title="Department">
                <option value="All">All departments</option>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={unitF} onChange={(e) => setUnitF(e.target.value)} className={selCls} title="Unit">
                <option value="All">All units</option>
                {units.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              <select value={catF} onChange={(e) => setCatF(e.target.value)} className={selCls} title="Category">
                <option value="All">All categories</option>
                {allCategories().map((c) => <option key={c.id} value={c.id}>{c.label}{usedCats.has(c.id) ? "" : " (0)"}</option>)}
              </select>
              <span className="text-[11px] text-muted-foreground">{rows.length} shown</span>
            </div>
            <Input placeholder="Search name, ID, role…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
          </div>
          <Table>
            <THead>
              <TR><TH>Emp ID</TH><TH>Employee</TH><TH>Dept</TH><TH>Unit</TH><TH>Category</TH><TH className="text-center">Prod</TH><TH className="text-center">Qual</TH><TH className="text-center">Attd</TH><TH className="text-center">Disc</TH><TH className="text-center">Team</TH><TH className="text-center">Overall</TH><TH>Band</TH><TH className="text-center">Incr.</TH><TH></TH></TR>
            </THead>
            <TBody>
              {rows.map((r) => {
                const s = stored(r.e.id) ?? r.sug;
                return (
                  <TR key={r.e.id}>
                    <TD className="font-mono text-xs text-muted-foreground">{r.e.id}</TD>
                    <TD className="font-medium">{r.e.name}<div className="text-[10px] font-normal text-muted-foreground">{r.e.role}</div></TD>
                    <TD className="text-xs">{r.e.department}</TD>
                    <TD className="text-xs">{r.e.unit ?? "—"}</TD>
                    <TD><Badge tone="muted">{categoryById(r.e.category)?.label ?? r.e.category}</Badge></TD>
                    <TD className="text-center">{s.productivity}</TD>
                    <TD className="text-center">{s.quality}</TD>
                    <TD className="text-center">{s.attendance}</TD>
                    <TD className="text-center">{s.discipline}</TD>
                    <TD className="text-center">{s.teamwork}</TD>
                    <TD className="text-center font-bold">{r.overall}</TD>
                    <TD><Badge tone={r.band.tone}>{r.band.band}</Badge>{r.finalized ? "" : <span className="ml-1 text-[10px] text-muted-foreground">(suggested)</span>}</TD>
                    <TD className="text-center font-semibold text-success">{r.incrementPct}%</TD>
                    <TD>{mayEdit && <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => setEditing(r.e)}><Pencil className="h-3 w-3" /> {r.finalized ? "Edit" : "Review"}</Button>}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {editing && (() => {
        const s = stored(editing.id) ?? suggestedAppraisal(editing, attendance, CURRENT_MONTH);
        return (
          <FormModal
            title={`Appraisal — ${editing.name}`}
            description={`${APPRAISAL_CYCLE} · rate 1–5 on each factor; overall and increment recompute on save.`}
            submitLabel="Finalize appraisal"
            onClose={() => setEditing(null)}
            fields={[
              { name: "productivity", label: "Productivity (1–5)", type: "number", defaultValue: String(s.productivity), required: true },
              { name: "quality", label: "Quality (1–5)", type: "number", defaultValue: String(s.quality), required: true },
              { name: "attendance", label: "Attendance (1–5)", type: "number", defaultValue: String(s.attendance), required: true },
              { name: "discipline", label: "Discipline (1–5)", type: "number", defaultValue: String(s.discipline), required: true },
              { name: "teamwork", label: "Teamwork (1–5)", type: "number", defaultValue: String(s.teamwork), required: true },
              { name: "note", label: "Reviewer note", type: "textarea", defaultValue: (stored(editing.id)?.note) ?? "", placeholder: "Strengths, focus areas, promotion readiness…" },
              { name: "study", label: "Study / extra remarks", type: "textarea", defaultValue: (stored(editing.id)?.study) ?? "", placeholder: "Observations from the review study — behaviour, skill gaps, training needed…" },
            ]}
            onSubmit={(v) => {
              const sc = { productivity: Number(v.productivity), quality: Number(v.quality), attendance: Number(v.attendance), discipline: Number(v.discipline), teamwork: Number(v.teamwork) };
              if (Object.values(sc).some((n) => n < 1 || n > 5)) return "Each factor must be between 1 and 5.";
              const overall = overallFromScores(sc);
              const band = ratingBand(overall);
              const rec: AppraisalRecord = { empId: editing.id, cycle: APPRAISAL_CYCLE, ...sc, overall, incrementPct: band.incrementPct, note: v.note.trim(), study: (v.study ?? "").trim(), finalizedOn: TODAY };
              setAppraisal(rec);
              push(`Appraisal finalized — ${editing.name}`, `Overall ${overall}/5 · ${band.band} · recommended increment ${band.incrementPct}%.`);
            }}
          />
        );
      })()}
    </>
  );
}

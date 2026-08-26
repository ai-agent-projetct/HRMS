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
import { useHr, attendanceFor, type AppraisalRecord , useCanEdit } from "@/stores/hr";
import { suggestedAppraisal, ratingBand, overallFromScores, APPRAISAL_CYCLE } from "@/lib/appraisal";
import { categoryById } from "@/lib/hr-master";
import type { HrEmployee } from "@/lib/hr-data";
import { Star, Award, TrendingUp, AlertTriangle, FileSpreadsheet, Pencil, CheckCircle2 } from "lucide-react";

export default function AppraisalsPage() {
  const [q, setQ] = useState("");
  const employees = useHr((s) => s.employees);
  const attendance = useHr((s) => s.attendance);
  const appraisals = useHr((s) => s.appraisals);
  const setAppraisal = useHr((s) => s.setAppraisal);
  const push = useToast((s) => s.push);
  const [editing, setEditing] = useState<HrEmployee | null>(null);
  const mayEdit = useCanEdit();

  const active = employees.filter((e) => e.status !== "Exited");
  const stored = (id: string) => appraisals.find((a) => a.empId === id && a.cycle === APPRAISAL_CYCLE);

  const rows = active
    .filter((e) => `${e.name} ${e.id} ${e.role}`.toLowerCase().includes(q.toLowerCase()))
    .map((e) => {
      const s = stored(e.id);
      const sug = suggestedAppraisal(e, attendanceFor(attendance, e.id));
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
        { header: "Productivity", key: "productivity" }, { header: "Quality", key: "quality" }, { header: "Attendance", key: "attendance" },
        { header: "Discipline", key: "discipline" }, { header: "Teamwork", key: "teamwork" },
        { header: "Overall (5)", key: "overall" }, { header: "Band", key: "band" }, { header: "Increment %", key: "inc" }, { header: "Finalized", key: "fin" },
      ],
      rows: rows.map((r) => {
        const s = stored(r.e.id) ?? r.sug;
        return { id: r.e.id, name: r.e.name, role: r.e.role, productivity: s.productivity, quality: s.quality, attendance: s.attendance, discipline: s.discipline, teamwork: s.teamwork, overall: r.overall, band: r.band.band, inc: r.incrementPct, fin: r.finalized ? "Yes" : "Suggested" };
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
            <p className="text-sm font-bold">Appraisal register — {APPRAISAL_CYCLE}</p>
            <Input placeholder="Search name, ID, role…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
          </div>
          <Table>
            <THead>
              <TR><TH>Employee</TH><TH className="text-center">Prod</TH><TH className="text-center">Qual</TH><TH className="text-center">Attd</TH><TH className="text-center">Disc</TH><TH className="text-center">Team</TH><TH className="text-center">Overall</TH><TH>Band</TH><TH className="text-center">Incr.</TH><TH></TH></TR>
            </THead>
            <TBody>
              {rows.map((r) => {
                const s = stored(r.e.id) ?? r.sug;
                return (
                  <TR key={r.e.id}>
                    <TD className="font-medium">{r.e.name}<div className="text-[10px] font-normal text-muted-foreground">{r.e.role} · {categoryById(r.e.category)?.label}</div></TD>
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
        const s = stored(editing.id) ?? suggestedAppraisal(editing, attendanceFor(attendance, editing.id));
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
            ]}
            onSubmit={(v) => {
              const sc = { productivity: Number(v.productivity), quality: Number(v.quality), attendance: Number(v.attendance), discipline: Number(v.discipline), teamwork: Number(v.teamwork) };
              if (Object.values(sc).some((n) => n < 1 || n > 5)) return "Each factor must be between 1 and 5.";
              const overall = overallFromScores(sc);
              const band = ratingBand(overall);
              const rec: AppraisalRecord = { empId: editing.id, cycle: APPRAISAL_CYCLE, ...sc, overall, incrementPct: band.incrementPct, note: v.note.trim(), finalizedOn: "2026-07-25" };
              setAppraisal(rec);
              push(`Appraisal finalized — ${editing.name}`, `Overall ${overall}/5 · ${band.band} · recommended increment ${band.incrementPct}%.`);
            }}
          />
        );
      })()}
    </>
  );
}

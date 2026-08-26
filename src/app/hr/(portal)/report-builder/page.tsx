"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { downloadExcel } from "@/lib/excel";
import { REPORT_FIELDS, runReport, scopeEmployees, type ReportField } from "@/lib/report-builder";
import { useHr, canManageMasters, type CustomReport, type ReportScope } from "@/stores/hr";
import { allCategories, allDepartments, categoryById } from "@/lib/hr-master";
import { COMPANY } from "@/lib/company";
import { FilePlus2, FileSpreadsheet, Printer, Trash2, Pencil, Play, Users, LayoutList } from "lucide-react";

const selectCls = "flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const GROUPS: ReportField["group"][] = ["Profile", "Job", "Statutory", "Bank", "Attendance", "Pay"];

const SCOPES: { id: ReportScope; label: string; hint: string }[] = [
  { id: "all", label: "All employees", hint: "Everyone on the roll" },
  { id: "category", label: "By category", hint: "Pick one or more worker categories" },
  { id: "unit", label: "By unit / branch", hint: "Pick one or more units" },
  { id: "department", label: "By department", hint: "Pick one or more departments" },
  { id: "employees", label: "Specific employees", hint: "Pick individual people" },
];

const BLANK = { name: "", description: "", fields: ["id", "name", "category", "department"], scope: "all" as ReportScope, scopeValues: [] as string[] };

export default function ReportBuilderPage() {
  const employees = useHr((s) => s.employees);
  const attendance = useHr((s) => s.attendance);
  const advances = useHr((s) => s.advances);
  const deductions = useHr((s) => s.deductions);
  const units = useHr((s) => s.units);
  const reports = useHr((s) => s.reports);
  const saveReport = useHr((s) => s.saveReport);
  const deleteReport = useHr((s) => s.deleteReport);
  const user = useHr((s) => s.user);
  const mayManage = canManageMasters(user?.role);
  const push = useToast((s) => s.push);

  const [editing, setEditing] = useState<(typeof BLANK & { id?: string }) | null>(null);
  const [running, setRunning] = useState<CustomReport | null>(null);
  const [empQ, setEmpQ] = useState("");

  const ctx = useMemo(() => ({ employees, attendance, advances, deductions }), [employees, attendance, advances, deductions]);
  const result = useMemo(() => (running ? runReport(running, ctx) : null), [running, ctx]);

  const scopeOptions = (scope: ReportScope): { value: string; label: string }[] => {
    switch (scope) {
      case "category": return allCategories().map((c) => ({ value: c.id, label: c.label }));
      case "unit": return units.map((u) => ({ value: u, label: u }));
      case "department": return [...new Set([...allDepartments(), ...employees.map((e) => e.department).filter(Boolean)])].sort().map((d) => ({ value: d, label: d }));
      case "employees": return employees
        .filter((e) => `${e.name} ${e.id}`.toLowerCase().includes(empQ.toLowerCase()))
        .slice(0, 300).map((e) => ({ value: e.id, label: `${e.name} (${e.id})` }));
      default: return [];
    }
  };

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const submit = () => {
    if (!editing) return;
    const r = saveReport(editing);
    if (!r.ok) return push("Couldn't save report", r.error);
    push(editing.id ? "Report updated" : "Report created", `${editing.name} — ${editing.fields.length} column(s).`);
    setEditing(null);
  };

  const exportResult = () => {
    if (!running || !result) return;
    downloadExcel({
      filename: running.name,
      sheetName: running.name.slice(0, 28) || "Report",
      title: `${running.name} — ${result.count} employee(s)${running.description ? ` · ${running.description}` : ""}`,
      columns: result.columns.map((c) => ({ header: c.label, key: c.key, width: c.key === "name" ? 22 : undefined })),
      rows: result.rows,
    });
  };

  const printResult = () => {
    if (!running || !result) return;
    const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
    const head = result.columns.map((c) => `<th>${esc(c.label)}</th>`).join("");
    const body = result.rows.map((r) => `<tr>${result.columns.map((c) => `<td class="${c.numeric ? "n" : ""}">${esc(r[c.key])}</td>`).join("")}</tr>`).join("");
    const hasTotals = result.columns.some((c) => c.numeric);
    const totals = hasTotals
      ? `<tr class="tot">${result.columns.map((c, i) => `<td>${i === 0 ? "TOTAL" : c.numeric ? esc(result.totals[c.key]) : ""}</td>`).join("")}</tr>`
      : "";
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(running.name)}</title>
      <style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial,sans-serif;color:#000}
      h1{font-size:14px;text-align:center;margin:0}h2{font-size:10px;text-align:center;font-weight:normal;margin:2px 0 10px}
      table{border-collapse:collapse;width:100%}th,td{border:1px solid #444;font-size:9px;padding:2px 4px;text-align:left}
      td.n{text-align:right}th{background:#eee}.tot td{font-weight:bold;background:#eee}</style></head><body>
      <h1>${esc(COMPANY.name)} — ${esc(running.name)}</h1>
      <h2>${esc(running.description ?? "")} · ${result.count} employee(s) · generated ${new Date().toLocaleString("en-IN")}</h2>
      <table><thead><tr>${head}</tr></thead><tbody>${body}${totals}</tbody></table>
      <script>window.onload=function(){window.print()}</script></body></html>`;
    const w = window.open("", "_blank");
    if (!w) { push("Pop-up blocked", "Allow pop-ups to print the report."); return; }
    w.document.write(html); w.document.close();
  };

  const scopeLabel = (r: CustomReport) => {
    if (r.scope === "all") return "All employees";
    const names = r.scope === "category" ? r.scopeValues.map((v) => categoryById(v)?.label ?? v) : r.scopeValues;
    return `${SCOPES.find((s) => s.id === r.scope)?.label}: ${names.slice(0, 3).join(", ")}${names.length > 3 ? ` +${names.length - 3}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Report Builder"
        description="Build a report once — pick the columns and who it covers — and run it any time against live data. Export to Excel or print."
        actions={mayManage ? <Button size="sm" onClick={() => setEditing({ ...BLANK })}><FilePlus2 className="h-4 w-4" /> New report</Button> : null}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Saved reports" value={`${reports.length}`} icon={LayoutList} sub="run any time" />
        <KpiCard label="Available columns" value={`${REPORT_FIELDS.length}`} icon={FileSpreadsheet} sub="profile → pay" tone="info" />
        <KpiCard label="Employees" value={`${employees.length}`} icon={Users} sub="reportable" tone="success" />
        <KpiCard label="Your access" value={mayManage ? "Full" : "View"} icon={Pencil} sub={mayManage ? "create & edit" : "run & export only"} tone={mayManage ? "success" : "warning"} />
      </div>

      <Card>
        <CardContent className="py-3">
          <p className="mb-3 text-sm font-bold">Saved reports</p>
          {reports.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No reports yet.{mayManage ? " Click “New report” to build one." : " Ask an Admin to create one."}
            </p>
          ) : (
            <Table>
              <THead><TR><TH>Report</TH><TH>Scope</TH><TH className="text-center">Columns</TH><TH className="text-center">Covers</TH><TH>Created</TH><TH></TH></TR></THead>
              <TBody>
                {reports.map((r) => (
                  <TR key={r.id}>
                    <TD className="font-medium">{r.name}{r.description && <div className="text-[11px] font-normal text-muted-foreground">{r.description}</div>}</TD>
                    <TD className="text-xs">{scopeLabel(r)}</TD>
                    <TD className="text-center">{r.fields.length}</TD>
                    <TD className="text-center font-semibold">{scopeEmployees(r, employees).length}</TD>
                    <TD className="text-[11px] text-muted-foreground">{r.createdAt}<div>{r.createdBy}</div></TD>
                    <TD>
                      <div className="flex items-center justify-end gap-1.5">
                        <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => setRunning(r)}><Play className="h-3 w-3" /> Run</Button>
                        {mayManage && <Button size="sm" variant="outline" className="h-7 w-7 p-0" title="Edit" onClick={() => setEditing({ ...r, description: r.description ?? "" })}><Pencil className="h-3.5 w-3.5" /></Button>}
                        {mayManage && <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-danger" title="Delete" onClick={() => { deleteReport(r.id); push("Report deleted", r.name); }}><Trash2 className="h-3.5 w-3.5" /></Button>}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Builder */}
      {editing && (
        <Modal
          title={editing.id ? "Edit report" : "New report"}
          description="Name it, choose the columns, then choose who it covers."
          onClose={() => setEditing(null)}
          wide
        >
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Report name<span className="text-danger"> *</span></label>
                <Input value={editing.name} placeholder="e.g. PF Return — Unit 1" onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Description</label>
                <Input value={editing.description} placeholder="What this report is for" onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
            </div>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Columns ({editing.fields.length} selected)</p>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => setEditing({ ...editing, fields: [] })}>Clear all</Button>
              </div>
              {GROUPS.map((g) => (
                <div key={g}>
                  <p className="mb-1 text-[11px] font-semibold text-muted-foreground">{g}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {REPORT_FIELDS.filter((f) => f.group === g).map((f) => {
                      const on = editing.fields.includes(f.key);
                      return (
                        <button
                          key={f.key}
                          onClick={() => setEditing({ ...editing, fields: toggle(editing.fields, f.key) })}
                          className={`rounded-md border px-2 py-1 text-[11px] transition-colors ${on ? "border-primary bg-primary/10 font-semibold text-primary" : "hover:bg-muted"}`}
                        >
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </section>

            <section className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Who does it cover?</p>
              <div className="flex flex-wrap gap-1.5">
                {SCOPES.map((sc) => (
                  <Button
                    key={sc.id}
                    variant={editing.scope === sc.id ? "default" : "outline"}
                    size="sm" className="h-7 px-2.5 text-[11px]"
                    onClick={() => setEditing({ ...editing, scope: sc.id, scopeValues: [] })}
                    title={sc.hint}
                  >
                    {sc.label}
                  </Button>
                ))}
              </div>
              {editing.scope !== "all" && (
                <div className="space-y-2 rounded-lg border border-dashed p-3">
                  {editing.scope === "employees" && (
                    <Input value={empQ} placeholder="Search employees…" className="max-w-xs" onChange={(e) => setEmpQ(e.target.value)} />
                  )}
                  <div className="flex max-h-44 flex-wrap gap-1.5 overflow-auto">
                    {scopeOptions(editing.scope).map((o) => {
                      const on = editing.scopeValues.includes(o.value);
                      return (
                        <button
                          key={o.value}
                          onClick={() => setEditing({ ...editing, scopeValues: toggle(editing.scopeValues, o.value) })}
                          className={`rounded-md border px-2 py-1 text-[11px] transition-colors ${on ? "border-primary bg-primary/10 font-semibold text-primary" : "hover:bg-muted"}`}
                        >
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{editing.scopeValues.length} selected</p>
                </div>
              )}
            </section>

            <div className="flex items-center justify-between border-t pt-3">
              <p className="text-[11px] text-muted-foreground">
                Covers {scopeEmployees({ ...editing, id: "", createdAt: "", createdBy: "" } as CustomReport, employees).length} employee(s)
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button onClick={submit}>{editing.id ? "Save changes" : "Create report"}</Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Runner */}
      {running && result && (
        <Modal
          title={running.name}
          description={`${result.count} employee(s) · ${result.columns.length} column(s)${running.description ? ` · ${running.description}` : ""}`}
          onClose={() => setRunning(null)}
          wide
        >
          <div className="space-y-3">
            <div className="max-h-[55vh] overflow-auto rounded-lg border">
              <Table>
                <THead>
                  <TR>{result.columns.map((c) => <TH key={c.key} className={c.numeric ? "text-right" : ""}>{c.label}</TH>)}</TR>
                </THead>
                <TBody>
                  {result.rows.map((r, i) => (
                    <TR key={i}>
                      {result.columns.map((c) => (
                        <TD key={c.key} className={c.numeric ? "text-right" : ""}>
                          {typeof r[c.key] === "number" ? (r[c.key] as number).toLocaleString("en-IN") : String(r[c.key] ?? "")}
                        </TD>
                      ))}
                    </TR>
                  ))}
                  {result.columns.some((c) => c.numeric) && (
                    <TR className="border-t-2">
                      {result.columns.map((c, i) => (
                        <TD key={c.key} className={`font-bold ${c.numeric ? "text-right" : ""}`}>
                          {i === 0 ? "TOTAL" : c.numeric ? result.totals[c.key].toLocaleString("en-IN") : ""}
                        </TD>
                      ))}
                    </TR>
                  )}
                </TBody>
              </Table>
            </div>
            {result.count === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No employees match this report's scope.</p>}
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="outline" onClick={() => setRunning(null)}>Close</Button>
              <Button variant="outline" onClick={printResult}><Printer className="h-4 w-4" /> Print</Button>
              <Button onClick={exportResult}><FileSpreadsheet className="h-4 w-4" /> Export Excel</Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

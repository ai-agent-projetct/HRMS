"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { downloadExcel } from "@/lib/excel";
import { buildOnRollReport, ONROLL_UNASSIGNED, type OnRollCell } from "@/lib/onroll";
import { useHr, TODAY } from "@/stores/hr";
import { COMPANY } from "@/lib/company";
import { UserPlus, UserMinus, Users, RefreshCw, FileSpreadsheet, Printer, CheckCircle2, AlertTriangle } from "lucide-react";

const COLS: { key: keyof OnRollCell; label: string }[] = [
  { key: "opening", label: "Opening" },
  { key: "newJoin", label: "New Join" },
  { key: "reJoin", label: "Re-join" },
  { key: "left", label: "Left" },
  { key: "present", label: "Present" },
  { key: "leaveAbs", label: "Leave & Abs" },
  { key: "closing", label: "Closing" },
];

export default function OnRollPage() {
  const employees = useHr((s) => s.employees);
  const movements = useHr((s) => s.movements);
  const leave = useHr((s) => s.leave);
  const daily = useHr((s) => s.dailyAttendance);
  const units = useHr((s) => s.units);
  const push = useToast((s) => s.push);

  const [date, setDate] = useState(TODAY);
  const [scope, setScope] = useState("All");

  const report = useMemo(
    () => buildOnRollReport({ employees, movements, leave, daily, date, units }),
    [employees, movements, leave, daily, date, units]
  );

  const cols = scope === "All" ? [...units, ONROLL_UNASSIGNED] : [scope];
  const cellOf = (r: (typeof report.rows)[number]) =>
    scope === "All" ? r.total : (r.perUnit[scope] ?? { opening: 0, newJoin: 0, reJoin: 0, left: 0, present: 0, leaveAbs: 0, closing: 0 });
  const grandCell = scope === "All"
    ? report.grand
    : report.rows.reduce((t, r) => {
        const c = cellOf(r);
        return { opening: t.opening + c.opening, newJoin: t.newJoin + c.newJoin, reJoin: t.reJoin + c.reJoin, left: t.left + c.left, present: t.present + c.present, leaveAbs: t.leaveAbs + c.leaveAbs, closing: t.closing + c.closing };
      }, { opening: 0, newJoin: 0, reJoin: 0, left: 0, present: 0, leaveAbs: 0, closing: 0 } as OnRollCell);

  const todaysMovements = movements.filter((m) => m.date === date);

  const exportReport = () =>
    downloadExcel({
      filename: `onroll-daily-report-${date}`,
      sheetName: "ONROLL",
      title: `${COMPANY.name}, ONROLL STATEMENT — ${date}${scope === "All" ? "" : ` — ${scope}`}`,
      columns: [
        { header: "CATEGORY", key: "category", width: 18 },
        ...(scope === "All"
          ? cols.flatMap((u) => COLS.map((c) => ({ header: `${u} · ${c.label}`, key: `${u}|${c.key}`, width: 12 })))
          : COLS.map((c) => ({ header: c.label, key: c.key, width: 12 }))),
      ],
      rows: [
        ...report.rows.map((r) => {
          const base: Record<string, unknown> = { category: r.category };
          if (scope === "All") {
            for (const u of cols) for (const c of COLS) base[`${u}|${c.key}`] = r.perUnit[u]?.[c.key] ?? 0;
          } else {
            const cell = cellOf(r);
            for (const c of COLS) base[c.key] = cell[c.key];
          }
          return base;
        }),
        (() => {
          const base: Record<string, unknown> = { category: "GRAND TOTAL" };
          if (scope === "All") {
            for (const u of cols) for (const c of COLS) base[`${u}|${c.key}`] = report.rows.reduce((s, r) => s + (r.perUnit[u]?.[c.key] ?? 0), 0);
          } else {
            for (const c of COLS) base[c.key] = grandCell[c.key];
          }
          return base;
        })(),
      ],
    });

  const printReport = () => {
    const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
    const head = `<tr><th>Category</th>${COLS.map((c) => `<th>${esc(c.label)}</th>`).join("")}</tr>`;
    const body = report.rows.map((r) => {
      const c = cellOf(r);
      return `<tr><td class="nm">${esc(r.category)}</td>${COLS.map((k) => `<td>${c[k.key] || ""}</td>`).join("")}</tr>`;
    }).join("");
    const tot = `<tr class="tot"><td class="nm">GRAND TOTAL</td>${COLS.map((k) => `<td>${grandCell[k.key]}</td>`).join("")}</tr>`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>On-roll ${esc(date)}</title>
      <style>@page{size:A4;margin:12mm}body{font-family:Arial,sans-serif;color:#000}
      h1{font-size:14px;text-align:center;margin:0}h2{font-size:11px;text-align:center;font-weight:normal;margin:2px 0 10px}
      table{border-collapse:collapse;width:100%}th,td{border:1px solid #444;font-size:10px;padding:3px 6px;text-align:center}
      td.nm{text-align:left}th{background:#eee}.tot td{font-weight:bold;background:#eee}</style></head><body>
      <h1>${esc(COMPANY.name)} — ONROLL STATEMENT</h1>
      <h2>${esc(scope === "All" ? "All Units" : scope)} · ${esc(date)} · Opening + New Join + Re-join − Left = Closing</h2>
      <table><thead>${head}</thead><tbody>${body}${tot}</tbody></table>
      <script>window.onload=function(){window.print()}</script></body></html>`;
    const w = window.open("", "_blank");
    if (!w) { push("Pop-up blocked", "Allow pop-ups to print the on-roll statement."); return; }
    w.document.write(html); w.document.close();
  };

  return (
    <>
      <PageHeader
        title="On-Roll Daily Report"
        description="Category-wise movement statement — Opening + New Join + Re-join − Left = Closing, with Present and Leave & Absent for the day."
        actions={
          <>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 w-40" />
            <select value={scope} onChange={(e) => setScope(e.target.value)} className="h-8 rounded-md border border-input bg-card px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="All">All units</option>
              {units.map((u) => <option key={u} value={u}>{u}</option>)}
              <option value={ONROLL_UNASSIGNED}>{ONROLL_UNASSIGNED}</option>
            </select>
            <Button variant="outline" size="sm" onClick={printReport}><Printer className="h-4 w-4" /> Print</Button>
            <Button variant="outline" size="sm" onClick={exportReport}><FileSpreadsheet className="h-4 w-4" /> Export</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Closing on-roll" value={`${grandCell.closing}`} icon={Users} sub={`opening ${grandCell.opening}`} />
        <KpiCard label="New joins" value={`${grandCell.newJoin}`} icon={UserPlus} sub={date} tone="success" />
        <KpiCard label="Re-joins" value={`${grandCell.reJoin}`} icon={RefreshCw} sub="returned to roll" tone="info" />
        <KpiCard label="Left" value={`${grandCell.left}`} icon={UserMinus} sub="exited on this date" tone={grandCell.left ? "danger" : "success"} />
      </div>

      <Card className={report.balanced ? "border-success/40 bg-success/5" : "border-danger/40 bg-danger/5"}>
        <CardContent className="flex items-center gap-3 py-3">
          {report.balanced ? <CheckCircle2 className="h-5 w-5 text-success" /> : <AlertTriangle className="h-5 w-5 text-danger" />}
          <p className="text-xs">
            {report.balanced
              ? <><b className="text-success">Balanced.</b> Every category satisfies Opening + New Join + Re-join − Left = Closing.</>
              : <><b className="text-danger">Out of balance.</b> A category does not reconcile — check the movement ledger below.</>}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-3">
          <p className="mb-3 text-sm font-bold">
            Category-wise movement — {scope === "All" ? "all units" : scope} · {date}
          </p>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR><TH>Category</TH>{COLS.map((c) => <TH key={c.key} className="text-center">{c.label}</TH>)}</TR>
              </THead>
              <TBody>
                {report.rows.map((r) => {
                  const c = cellOf(r);
                  return (
                    <TR key={r.categoryId}>
                      <TD className="font-medium">{r.category}</TD>
                      <TD className="text-center">{c.opening || "—"}</TD>
                      <TD className="text-center">{c.newJoin ? <Badge tone="success">+{c.newJoin}</Badge> : "—"}</TD>
                      <TD className="text-center">{c.reJoin ? <Badge tone="info">+{c.reJoin}</Badge> : "—"}</TD>
                      <TD className="text-center">{c.left ? <Badge tone="danger">−{c.left}</Badge> : "—"}</TD>
                      <TD className="text-center font-medium text-success">{c.present || "—"}</TD>
                      <TD className="text-center text-muted-foreground">{c.leaveAbs || "—"}</TD>
                      <TD className="text-center font-bold">{c.closing}</TD>
                    </TR>
                  );
                })}
                <TR className="border-t-2">
                  <TD className="font-bold">GRAND TOTAL</TD>
                  {COLS.map((c) => <TD key={c.key} className="text-center font-bold">{grandCell[c.key]}</TD>)}
                </TR>
              </TBody>
            </Table>
          </div>
          {report.rows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No on-roll data for {date}.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-3">
          <p className="mb-3 text-sm font-bold">Movement ledger — {date} ({todaysMovements.length})</p>
          {todaysMovements.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No joins, re-joins or exits recorded on this date.</p>
          ) : (
            <Table>
              <THead><TR><TH>Type</TH><TH>Emp ID</TH><TH>Name</TH><TH>Unit</TH><TH>Department</TH><TH>Recorded by</TH><TH>Note</TH></TR></THead>
              <TBody>
                {todaysMovements.map((m) => (
                  <TR key={m.id}>
                    <TD><Badge tone={m.type === "Left" ? "danger" : m.type === "Re-join" ? "info" : "success"}>{m.type}</Badge></TD>
                    <TD className="font-mono text-xs text-muted-foreground">{m.empId}</TD>
                    <TD className="font-medium">{m.empName}</TD>
                    <TD className="text-xs">{m.unit ?? "—"}</TD>
                    <TD className="text-xs">{m.department ?? "—"}</TD>
                    <TD className="text-xs text-muted-foreground">{m.by ?? "—"}</TD>
                    <TD className="text-xs text-muted-foreground">{m.note ?? "—"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Movements are logged automatically when an employee is added or their status changes to / from Exited, so this ledger always reconciles with the employee master.
          </p>
        </CardContent>
      </Card>
    </>
  );
}

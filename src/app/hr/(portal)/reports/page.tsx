"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { downloadExcel } from "@/lib/excel";
import { useHr, leaveStatusTone, attendanceFor, dailyFor, shiftForWeek, TODAY, CURRENT_WEEK_ROW } from "@/stores/hr";
import { WORKER_CATEGORIES, shiftById } from "@/lib/hr-master";
import { formatINR } from "@/lib/utils";
import { shareMessage } from "@/lib/share";
import { COMPANY } from "@/lib/company";
import type { HrEmployee } from "@/lib/hr-data";
import { UserCheck, UserX, CalendarClock, Send, FileSpreadsheet, MessageSquare, Mail, ClipboardList, ListChecks, LayoutGrid, Printer } from "lucide-react";

type View = "present" | "lop_absent" | "not_marked" | "approved" | "pending" | "requests" | "lop";

export default function ReportsPage() {
  const employees = useHr((s) => s.employees);
  const leave = useHr((s) => s.leave);
  const attendance = useHr((s) => s.attendance);
  const dailyAttendance = useHr((s) => s.dailyAttendance);
  const units = useHr((s) => s.units);
  const push = useToast((s) => s.push);
  const [sent, setSent] = useState(false);
  const [view, setView] = useState<View>("present");
  const [absUnit, setAbsUnit] = useState("All");

  // Today's register: present / absent come from the day marks, nothing assumed.
  const markToday = (e: HrEmployee) => dailyFor(dailyAttendance, e.id, TODAY)?.status;
  const roster = employees.filter((e) => e.status !== "Exited");
  const present = roster.filter((e) => markToday(e) === "Present" || markToday(e) === "Half Day");
  const lopAbsent = roster.filter((e) => markToday(e) === "Absent");
  const notMarked = roster.filter((e) => !markToday(e));
  const todayLabel = new Date(`${TODAY}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const approvedLeave = leave.filter((l) => l.status === "Approved");
  const pending = leave.filter((l) => l.status === "Pending" || l.status === "Approved by Manager");
  const lopItems = [
    ...leave.filter((l) => l.type === "LOP"),
    ...lopAbsent.map((e) => ({ id: `LOP-${e.id}`, empName: e.name, type: "LOP" as const, from: TODAY, to: TODAY, days: 1, reason: "Absent today (unpaid)", status: "Approved" as const })),
  ];

  const CARDS: { key: View; label: string; value: number; icon: typeof UserCheck; tone: "success" | "danger" | "info" | "warning" | "primary" }[] = [
    { key: "present", label: "Present", value: present.length, icon: UserCheck, tone: "success" },
    { key: "lop_absent", label: "Absent today", value: lopAbsent.length, icon: UserX, tone: "danger" },
    { key: "not_marked", label: "Not marked yet", value: notMarked.length, icon: ClipboardList, tone: "warning" },
    { key: "approved", label: "On Approved Leave", value: approvedLeave.length, icon: CalendarClock, tone: "info" },
    { key: "pending", label: "Pending Requests", value: pending.length, icon: Send, tone: "warning" },
    { key: "requests", label: "Leave Status Requests", value: leave.length, icon: ListChecks, tone: "primary" },
    { key: "lop", label: "LOP", value: lopItems.length, icon: ClipboardList, tone: "danger" },
  ];

  const active = CARDS.find((c) => c.key === view)!;

  // Rows for the report Excel export track whatever is currently shown.
  const exportRows = useMemo(() => {
    switch (view) {
      case "present":
        return present.map((e) => ({ name: e.name, dept: e.department, detail: `${e.id} · ${dailyFor(dailyAttendance, e.id, TODAY)?.shift ?? markToday(e)}`, status: "Present" }));
      case "lop_absent":
        return lopAbsent.map((e) => ({ name: e.name, dept: e.department, detail: e.id, status: "Absent" }));
      case "not_marked":
        return notMarked.map((e) => ({ name: e.name, dept: e.department, detail: e.id, status: "Not marked" }));
      case "approved":
        return approvedLeave.map((l) => ({ name: l.empName, dept: "—", detail: `${l.type} · ${l.from} → ${l.to}`, status: l.status }));
      case "pending":
        return pending.map((l) => ({ name: l.empName, dept: "—", detail: `${l.type} · ${l.from} → ${l.to} · ${l.days}d`, status: l.status }));
      case "requests":
        return leave.map((l) => ({ name: l.empName, dept: l.type, detail: `${l.from} → ${l.to} · ${l.reason}`, status: l.status }));
      case "lop":
        return lopItems.map((l) => ({ name: l.empName, dept: l.type, detail: `${l.from} → ${l.to} · ${l.reason}`, status: l.status }));
    }
  }, [view, present, lopAbsent, notMarked, approvedLeave, pending, leave, lopItems]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Category-wise Daily Abstract (DAILY REPORT format) -----------------
  // Present today = marked Present / Half Day only. Each
  // present worker is bucketed by their current shift into Day / Night / General.
  const presentToday = (e: HrEmployee): boolean => {
    const d = dailyFor(dailyAttendance, e.id, TODAY)?.status;
    return d === "Present" || d === "Half Day";
  };
  /** Half-day marks are reported in their own column (H) of the daily abstract. */
  const halfDayToday = (e: HrEmployee): boolean => dailyFor(dailyAttendance, e.id, TODAY)?.status === "Half Day";
  const shiftBucket = (e: HrEmployee): "D" | "N" | "G" => {
    const code = shiftById(shiftForWeek(attendance, e.id, CURRENT_WEEK_ROW, e.shiftId))?.code;
    if (code === "G") return "G";
    if (code === "C" || code === "E") return "N";
    return "D";
  };
  const wagePerDay = (e: HrEmployee) => (e.salaryPerDay && e.salaryPerDay > 0 ? e.salaryPerDay : Math.round(e.monthlyGross / 26));

  const abstract = useMemo(() => {
    const pool = employees.filter((e) => absUnit === "All" || (e.unit ?? "") === absUnit);
    return WORKER_CATEGORIES.map((c) => {
      const inCat = pool.filter((e) => e.category === c.id);
      const present = inCat.filter(presentToday);
      const full = present.filter((e) => !halfDayToday(e));
      const H = present.filter(halfDayToday).length;
      const D = full.filter((e) => shiftBucket(e) === "D").length;
      const N = full.filter((e) => shiftBucket(e) === "N").length;
      const G = full.filter((e) => shiftBucket(e) === "G").length;
      const TP = D + H + N + G;
      const wd = inCat.length ? Math.round(inCat.reduce((s, e) => s + wagePerDay(e), 0) / inCat.length) : 0;
      // Half days are paid at 0.5 — the wage total reflects that.
      return { category: c.label, D, H, N, G, TP, onRoll: inCat.length, wagePerDay: wd, total: Math.round((D + N + G + H * 0.5) * wd) };
    }).filter((r) => r.onRoll > 0);
  }, [employees, dailyAttendance, attendance, absUnit]); // eslint-disable-line react-hooks/exhaustive-deps

  const absTotals = abstract.reduce((t, r) => ({ D: t.D + r.D, H: t.H + r.H, N: t.N + r.N, G: t.G + r.G, TP: t.TP + r.TP, onRoll: t.onRoll + r.onRoll, total: t.total + r.total }), { D: 0, H: 0, N: 0, G: 0, TP: 0, onRoll: 0, total: 0 });

  const exportDailyAbstract = () =>
    downloadExcel({
      filename: "daily-report-category-wise",
      sheetName: "Daily Abstract",
      title: `MEHALA CARONA TEXTILES P LTD. - DAILY ABSTRACT - CATEGORY WISE — ${absUnit === "All" ? "All Units" : absUnit} — ${TODAY}`,
      columns: [
        { header: "CATEGORY", key: "category", width: 18 },
        { header: "D", key: "D" }, { header: "H", key: "H" }, { header: "N", key: "N" }, { header: "G", key: "G" },
        { header: "TP", key: "TP" }, { header: "ON ROLL", key: "onRoll" },
        { header: "WAGES/DAY", key: "wagePerDay" }, { header: "TOTAL", key: "total" },
      ],
      rows: [...abstract, { category: "GROSS TOTAL", D: absTotals.D, H: absTotals.H, N: absTotals.N, G: absTotals.G, TP: absTotals.TP, onRoll: absTotals.onRoll, wagePerDay: "", total: absTotals.total }],
    });

  const printDailyAbstract = () => {
    const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
    const body = [...abstract.map((r) => [r.category, r.D || "", r.H || "", r.N || "", r.G || "", r.TP, r.onRoll, r.wagePerDay, r.total]),
      ["GROSS TOTAL", absTotals.D, absTotals.H, absTotals.N, absTotals.G, absTotals.TP, absTotals.onRoll, "", absTotals.total]]
      .map((row, i) => `<tr${i === abstract.length ? ' class="tot"' : ""}>${row.map((c, j) => `<td class="${j === 0 ? "nm" : "n"}">${esc(c)}</td>`).join("")}</tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Daily Report — ${esc(TODAY)}</title>
      <style>@page{size:A4;margin:12mm}body{font-family:Arial,sans-serif;color:#000}h1{font-size:14px;text-align:center;margin:0}h2{font-size:11px;text-align:center;font-weight:normal;margin:2px 0 10px}
      table{border-collapse:collapse;width:100%}th,td{border:1px solid #444;font-size:10px;padding:3px 6px;text-align:center}td.nm{text-align:left}.tot td{font-weight:bold;background:#eee}th{background:#eee}</style></head><body>
      <h1>${esc(COMPANY.name)} — DAILY ABSTRACT (CATEGORY WISE)</h1>
      <h2>${esc(absUnit === "All" ? "All Units" : absUnit)} · ${esc(TODAY)}</h2>
      <table><thead><tr><th>Category</th><th>Day</th><th>Half</th><th>Night</th><th>Gen</th><th>Total Present</th><th>On Roll</th><th>Wages/Day</th><th>Total Wages</th></tr></thead><tbody>${body}</tbody></table>
      <script>window.onload=function(){window.print()}</script></body></html>`;
    const w = window.open("", "_blank");
    if (!w) { push("Pop-up blocked", "Allow pop-ups to print the daily report."); return; }
    w.document.write(html); w.document.close();
  };

  const sendReport = (channel: "WhatsApp" | "Email") => {
    setSent(true);
    shareMessage(channel, undefined, `HR daily report — ${todayLabel}`,
      `${present.length} present, ${lopAbsent.length} absent, ${notMarked.length} not marked, ${pending.length} leave requests pending.`);
  };

  const exportReport = () =>
    downloadExcel({
      filename: `hr-daily-report-${view}-${TODAY}`,
      sheetName: active.label.slice(0, 28),
      title: `HR Daily Report — ${active.label} — ${todayLabel}`,
      columns: [{ header: "Employee", key: "name", width: 22 }, { header: "Department / Type", key: "dept", width: 20 }, { header: "Detail", key: "detail", width: 44 }, { header: "Status", key: "status", width: 20 }],
      rows: exportRows,
    });

  return (
    <>
      <PageHeader
        title="Daily Report"
        description="Click any card to filter the list — attendance, LOP, approved leave, pending & all leave requests. Share the day's summary with managers on WhatsApp or e-mail."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportReport}><FileSpreadsheet className="h-4 w-4" /> Export {active.label}</Button>
            <Button variant="outline" size="sm" onClick={() => sendReport("Email")}><Mail className="h-4 w-4" /> Email managers</Button>
            <Button size="sm" onClick={() => sendReport("WhatsApp")}><MessageSquare className="h-4 w-4" /> WhatsApp managers</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {CARDS.map((c) => (
          <KpiCard
            key={c.key}
            label={c.label}
            value={`${c.value}`}
            icon={c.icon}
            tone={c.tone}
            sub={view === c.key ? "▼ showing below" : "click to view"}
            onClick={() => setView(c.key)}
            active={view === c.key}
          />
        ))}
      </div>

      {sent && (
        <div className="flex items-center gap-2 rounded-md border border-success/40 bg-success/5 p-3 text-xs">
          <Send className="h-4 w-4 text-success" />
          <span>Report delivered to all department managers and mirrored on the management dashboard. Any approvals they make sync back here.</span>
        </div>
      )}

      <Card>
        <CardContent className="py-3">
          <p className="mb-3 flex items-center gap-2 text-sm font-bold">
            <active.icon className="h-4 w-4 text-primary" /> {active.label} — {active.value} {active.value === 1 ? "record" : "records"}
          </p>

          {(view === "present" || view === "lop_absent" || view === "not_marked") && (() => {
            const list = view === "present" ? present : view === "lop_absent" ? lopAbsent : notMarked;
            return (
              <Table>
                <THead><TR><TH>Emp ID</TH><TH>Employee</TH><TH>Department</TH><TH>Unit</TH><TH>Today</TH></TR></THead>
                <TBody>
                  {list.map((e) => {
                    const d = dailyFor(dailyAttendance, e.id, TODAY);
                    return (
                      <TR key={e.id}>
                        <TD className="font-mono text-xs text-muted-foreground">{e.id}</TD>
                        <TD className="font-medium">{e.name}</TD>
                        <TD className="text-muted-foreground">{e.department}</TD>
                        <TD className="text-xs">{d?.unit ?? e.unit ?? "—"}</TD>
                        <TD>{view === "present"
                          ? <Badge tone="success">{d?.shift ? `Shift ${d.shift}` : d?.status}</Badge>
                          : view === "lop_absent" ? <Badge tone="danger">Absent</Badge> : <Badge tone="warning">Not marked</Badge>}</TD>
                      </TR>
                    );
                  })}
                  {list.length === 0 && <TR><TD colSpan={5} className="py-4 text-center text-xs text-muted-foreground">{view === "not_marked" ? "Everyone is marked for today." : `No one ${view === "present" ? "marked present" : "marked absent"} for ${todayLabel} yet — mark the day in Attendance & Shifts.`}</TD></TR>}
                </TBody>
              </Table>
            );
          })()}

          {(view === "approved" || view === "pending" || view === "requests" || view === "lop") && (
            <Table>
              <THead>
                <TR><TH>ID</TH><TH>Employee</TH><TH>Type</TH><TH>From</TH><TH>To</TH><TH className="text-right">Days</TH><TH>Reason</TH><TH>Status</TH></TR>
              </THead>
              <TBody>
                {(view === "approved" ? approvedLeave : view === "pending" ? pending : view === "lop" ? lopItems : leave).map((l) => (
                  <TR key={l.id}>
                    <TD className="font-semibold text-primary">{l.id}</TD>
                    <TD className="font-medium">{l.empName}</TD>
                    <TD><Badge tone={l.type === "LOP" ? "danger" : "muted"}>{l.type}</Badge></TD>
                    <TD>{l.from}</TD>
                    <TD>{l.to}</TD>
                    <TD className="text-right">{l.days}</TD>
                    <TD className="max-w-[220px] truncate text-muted-foreground">{l.reason}</TD>
                    <TD><Badge tone={leaveStatusTone(l.status)}>{l.status}</Badge></TD>
                  </TR>
                ))}
                {(view === "approved" ? approvedLeave : view === "pending" ? pending : view === "lop" ? lopItems : leave).length === 0 && (
                  <TR><TD colSpan={8} className="py-4 text-center text-xs text-muted-foreground">No records in this view.</TD></TR>
                )}
              </TBody>
            </Table>
          )}

        </CardContent>
      </Card>

      {/* Category-wise Daily Abstract — the DAILY REPORT format */}
      <Card>
        <CardContent className="py-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-bold">
              <LayoutGrid className="h-4 w-4 text-primary" /> Daily Abstract — category-wise ({TODAY})
            </p>
            <div className="flex items-center gap-2">
              <select value={absUnit} onChange={(e) => setAbsUnit(e.target.value)} className="h-8 rounded-md border border-input bg-card px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring" title="Filter by unit">
                <option value="All">All Units</option>
                {units.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              <Button variant="outline" size="sm" onClick={printDailyAbstract}><Printer className="h-4 w-4" /> Print</Button>
              <Button variant="outline" size="sm" onClick={exportDailyAbstract}><FileSpreadsheet className="h-4 w-4" /> Export DAILY REPORT</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Category</TH>
                  <TH className="text-center">Day</TH><TH className="text-center">Half</TH><TH className="text-center">Night</TH><TH className="text-center">General</TH>
                  <TH className="text-center">Total Present</TH><TH className="text-center">On Roll</TH>
                  <TH className="text-right">Wages/Day</TH><TH className="text-right">Total Wages</TH>
                </TR>
              </THead>
              <TBody>
                {abstract.map((r) => (
                  <TR key={r.category}>
                    <TD className="font-medium">{r.category}</TD>
                    <TD className="text-center">{r.D || "—"}</TD>
                    <TD className="text-center">{r.H || "—"}</TD>
                    <TD className="text-center">{r.N || "—"}</TD>
                    <TD className="text-center">{r.G || "—"}</TD>
                    <TD className="text-center font-semibold">{r.TP}</TD>
                    <TD className="text-center">{r.onRoll}</TD>
                    <TD className="text-right">{formatINR(r.wagePerDay)}</TD>
                    <TD className="text-right font-semibold">{formatINR(r.total)}</TD>
                  </TR>
                ))}
                <TR className="border-t-2">
                  <TD className="font-bold">GROSS TOTAL</TD>
                  <TD className="text-center font-bold">{absTotals.D}</TD>
                  <TD className="text-center font-bold">{absTotals.H}</TD>
                  <TD className="text-center font-bold">{absTotals.N}</TD>
                  <TD className="text-center font-bold">{absTotals.G}</TD>
                  <TD className="text-center font-bold">{absTotals.TP}</TD>
                  <TD className="text-center font-bold">{absTotals.onRoll}</TD>
                  <TD className="text-right">—</TD>
                  <TD className="text-right font-bold text-success">{formatINR(absTotals.total)}</TD>
                </TR>
              </TBody>
            </Table>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">Present = marked Present (or Half Day) today; unmarked workers are not counted. Day/Night/General bucketed by each worker’s current shift. Half days are marked ½ on the register, counted in the H column and paid at 0.5 day.</p>
        </CardContent>
      </Card>
    </>
  );
}

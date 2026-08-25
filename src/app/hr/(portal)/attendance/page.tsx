"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { downloadExcel } from "@/lib/excel";
import { DetailSheet } from "@/components/detail-sheet";
import { AttendanceImportModal } from "@/components/attendance-import-modal";
import { AttendanceCalendar } from "@/components/attendance-calendar";
import { SHIFTS, shiftById, categoryById, computeIncentives, WEEK_LABELS, WORKER_CATEGORIES } from "@/lib/hr-master";
import { useHr, attendanceFor, dailyFor, shiftForWeek, attendanceStatusTone, canEditOt, TODAY, CURRENT_MONTH, CURRENT_MONTH_LABEL, CURRENT_WEEK_ROW } from "@/stores/hr";
import { COMPANY } from "@/lib/company";
import type { HrEmployee } from "@/lib/hr-data";
import type { AttendanceStatus } from "@/stores/hr";
import { useToast } from "@/components/ui/toast";
import { CalendarCheck, Users, TrendingUp, AlertTriangle, FileSpreadsheet, Upload, CalendarDays, Lock, Printer } from "lucide-react";

const selectCls = "h-8 rounded-md border border-input bg-card px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring";

export default function AttendancePage() {
  const [q, setQ] = useState("");
  const [shift, setShift] = useState("All");
  const [cat, setCat] = useState("All");
  const [unitF, setUnitF] = useState("All");
  const [detail, setDetail] = useState<HrEmployee | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [calEmp, setCalEmp] = useState<HrEmployee | null>(null);
  const employees = useHr((s) => s.employees);
  const attendance = useHr((s) => s.attendance);
  const dailyAttendance = useHr((s) => s.dailyAttendance);
  const setAttendance = useHr((s) => s.setAttendance);
  const setWeekShift = useHr((s) => s.setWeekShift);
  const applyDailyAttendance = useHr((s) => s.applyDailyAttendance);
  const markAttendanceDay = useHr((s) => s.markAttendanceDay);
  const clearAttendanceDay = useHr((s) => s.clearAttendanceDay);
  const user = useHr((s) => s.user);
  const units = useHr((s) => s.units);
  const otEditable = canEditOt(user?.role);
  const toast = useToast((s) => s.push);

  const rows = employees
    .filter((e) => shift === "All" || e.shiftId === shift)
    .filter((e) => cat === "All" || e.category === cat)
    .filter((e) => unitF === "All" || (e.unit ?? "") === unitF)
    .filter((e) => `${e.name} ${e.id} ${e.department}`.toLowerCase().includes(q.toLowerCase()))
    .map((e) => {
      const a = attendanceFor(attendance, e.id);
      const daysWorked = a?.daysWorked ?? 0;
      const saturdaysWorked = a?.saturdaysWorked ?? 0;
      const totalSat = a?.totalSaturdays ?? 4;
      const inc = computeIncentives(saturdaysWorked, totalSat, daysWorked);
      const weekShiftId = shiftForWeek(attendance, e.id, CURRENT_WEEK_ROW, e.shiftId);
      return { e, a, daysWorked, saturdaysWorked, totalSat, otHours: a?.otHours ?? 0, absent: a?.absent ?? 0, inc, weekShiftId, today: dailyFor(dailyAttendance, e.id, TODAY)?.status };
    });

  const fullAttendance = rows.filter((r) => r.daysWorked >= 28).length;
  const avgDays = rows.length ? Math.round(rows.reduce((s, r) => s + r.daysWorked, 0) / rows.length) : 0;
  const lowAttendance = rows.filter((r) => r.daysWorked < 20).length;

  const exportAttendance = () =>
    downloadExcel({
      filename: `attendance-${CURRENT_MONTH_LABEL}`, sheetName: "Attendance", title: `Attendance — ${CURRENT_MONTH_LABEL}`,
      columns: [
        { header: "Emp ID", key: "id" }, { header: "Name", key: "name", width: 22 }, { header: "Category", key: "category" },
        { header: "Shift", key: "shift" }, { header: "Days Worked", key: "daysWorked" }, { header: "Saturdays", key: "sat" },
        { header: "OT (hr)", key: "otHours" }, { header: "Absent", key: "absent" },
        { header: "Inc-1 ₹", key: "inc1" }, { header: "Inc-2 ₹", key: "inc2" },
      ],
      rows: rows.map((r) => ({
        id: r.e.id, name: r.e.name, category: categoryById(r.e.category)?.label ?? r.e.category,
        shift: shiftById(r.weekShiftId)?.code ?? "", daysWorked: r.daysWorked, sat: `${r.saturdaysWorked}/${r.totalSat}`,
        otHours: r.otHours, absent: r.absent, inc1: r.inc.inc1Amount, inc2: r.inc.inc2Amount,
      })),
    });

  const num = (v: string) => Math.max(0, Number(v) || 0);

  // Monthly Attendance Register (statutory Form-25 / pre-printed muster): one
  // column per day (P / A / L / H, Sundays default to W/H, blank = to be filled),
  // then shift + OT. Respects the current shift/category/search filter so you
  // can print a section at a time.
  const STATUS_CODE: Record<string, string> = { Present: "P", Absent: "A", Leave: "L", Holiday: "H" };
  const [y, m] = CURRENT_MONTH.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const exportRegister = () =>
    downloadExcel({
      filename: `attendance-register-${CURRENT_MONTH}`,
      sheetName: "Register",
      title: `${COMPANY.name} — ATTENDANCE REGISTER — ${CURRENT_MONTH_LABEL} (P=Present · A=Absent · L=Leave · W/H=Weekly Holiday)`,
      columns: [
        { header: "S.No", key: "sno" }, { header: "E.No / Token", key: "token", width: 12 },
        { header: "Name", key: "name", width: 22 }, { header: "Father's Name", key: "father", width: 18 },
        { header: "Dept", key: "dept", width: 12 }, { header: "Gr", key: "grade" },
        ...monthDays.map((d) => ({ header: String(d), key: `d${d}` })),
        { header: "Days", key: "days" }, { header: "Shift", key: "shift" }, { header: "OT", key: "ot" },
      ],
      rows: rows.map((r, i) => {
        const rec: Record<string, unknown> = {
          sno: i + 1, token: r.e.tokenNo ?? r.e.id, name: r.e.name, father: r.e.fatherName ?? "",
          dept: r.e.department, grade: r.e.grade, days: r.daysWorked, shift: shiftById(r.weekShiftId)?.code ?? "", ot: r.otHours,
        };
        for (const d of monthDays) {
          const date = `${CURRENT_MONTH}-${String(d).padStart(2, "0")}`;
          const st = dailyFor(dailyAttendance, r.e.id, date)?.status;
          rec[`d${d}`] = st ? STATUS_CODE[st] ?? "" : new Date(y, m - 1, d).getDay() === 0 ? "W/H" : "";
        }
        return rec;
      }),
    });

  // Printable attendance register (browser print → paper/PDF) for manual marking.
  // Sundays pre-marked W/H; other day cells left blank to fill by hand.
  const printRegister = () => {
    const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
    const scope = [shift !== "All" ? `Shift ${shiftById(shift)?.code}` : "", cat !== "All" ? categoryById(cat as HrEmployee["category"])?.label : "", unitF !== "All" ? unitF : ""].filter(Boolean).join(" · ") || "All sections";
    const dayCols = monthDays.map((d) => `<th>${d}</th>`).join("");
    const body = rows.map((r, i) => {
      const cells = monthDays.map((d) => {
        const date = `${CURRENT_MONTH}-${String(d).padStart(2, "0")}`;
        const st = dailyFor(dailyAttendance, r.e.id, date)?.status;
        const v = st ? (STATUS_CODE[st] ?? "") : new Date(y, m - 1, d).getDay() === 0 ? "W/H" : "";
        return `<td class="day">${v}</td>`;
      }).join("");
      return `<tr><td>${i + 1}</td><td>${esc(r.e.tokenNo ?? r.e.id)}</td><td class="nm">${esc(r.e.name)}</td><td>${esc(r.e.fatherName ?? "")}</td><td>${esc(r.e.department)}</td><td>${esc(r.e.grade)}</td>${cells}<td></td><td>${esc(shiftById(r.weekShiftId)?.code ?? "")}</td><td></td></tr>`;
    }).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Attendance Register — ${esc(CURRENT_MONTH_LABEL)}</title>
      <style>
        @page { size: A4 landscape; margin: 8mm; }
        body { font-family: Arial, sans-serif; color:#000; }
        h1 { font-size: 13px; text-align:center; margin:0; } h2 { font-size:11px; text-align:center; margin:2px 0 8px; font-weight:normal; }
        table { border-collapse: collapse; width:100%; }
        th,td { border:1px solid #444; font-size:8px; padding:1px 2px; text-align:center; }
        td.nm { text-align:left; white-space:nowrap; } th { background:#eee; }
        td.day, th { width:14px; }
        .foot { margin-top:10px; font-size:9px; display:flex; justify-content:space-between; }
      </style></head><body>
      <h1>${esc(COMPANY.name)} — ATTENDANCE REGISTER</h1>
      <h2>${esc(CURRENT_MONTH_LABEL)} · ${esc(scope)} · P=Present A=Absent L=Leave W/H=Weekly Holiday</h2>
      <table><thead><tr><th>S.No</th><th>E.No</th><th>Name</th><th>Father</th><th>Dept</th><th>Gr</th>${dayCols}<th>Days</th><th>Shift</th><th>OT</th></tr></thead>
      <tbody>${body}</tbody></table>
      <div class="foot"><span>Total workers: ${rows.length}</span><span>Prepared by: __________  Verified by: __________</span></div>
      <script>window.onload=function(){window.print();}</script></body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast("Pop-up blocked", "Allow pop-ups to print the register."); return; }
    w.document.write(html);
    w.document.close();
  };

  return (
    <>
      <PageHeader
        title="Attendance & Shifts"
        description={`Monthly attendance for ${CURRENT_MONTH_LABEL} — days worked drive day-wage pay and both incentives. Edit inline; it flows straight into payroll.`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" /> Import Excel
            </Button>
            <Button variant="outline" size="sm" onClick={printRegister}>
              <Printer className="h-4 w-4" /> Print register
            </Button>
            <Button variant="outline" size="sm" onClick={exportRegister}>
              <FileSpreadsheet className="h-4 w-4" /> Register (Form-25)
            </Button>
            <Button variant="outline" size="sm" onClick={exportAttendance}>
              <FileSpreadsheet className="h-4 w-4" /> Export
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Workforce" value={`${rows.length}`} icon={Users} sub={`${SHIFTS.length} shifts`} />
        <KpiCard label="Avg days worked" value={`${avgDays}`} icon={CalendarCheck} sub={`of 28 · ${CURRENT_MONTH_LABEL}`} tone="info" />
        <KpiCard label="Full attendance (28+)" value={`${fullAttendance}`} icon={TrendingUp} sub="qualify for Incentive 2" tone="success" />
        <KpiCard label="Low attendance (<20)" value={`${lowAttendance}`} icon={AlertTriangle} sub="review conduct / agent" tone="danger" />
      </div>

      <Card>
        <CardContent className="py-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button variant={shift === "All" ? "default" : "outline"} size="sm" className="h-7 px-2.5 text-[11px]" onClick={() => setShift("All")}>All shifts</Button>
              {SHIFTS.map((s) => (
                <Button key={s.id} variant={shift === s.id ? "default" : "outline"} size="sm" className="h-7 px-2.5 text-[11px]" onClick={() => setShift(s.id)} title={s.time}>{s.code} · {s.name}</Button>
              ))}
              <select value={cat} onChange={(e) => setCat(e.target.value)} className={`${selectCls} ml-1`} title="Filter by worker category">
                <option value="All">All categories</option>
                {WORKER_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <select value={unitF} onChange={(e) => setUnitF(e.target.value)} className={selectCls} title="Filter by unit / branch">
                <option value="All">All units</option>
                {units.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <Input placeholder="Search name, ID, dept…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
          </div>
          <Table>
            <THead>
              <TR>
                <TH>Emp ID</TH><TH>Name</TH><TH>Category</TH><TH>Shift</TH>
                <TH className="text-center">{TODAY.slice(8)} Jul</TH>
                <TH className="text-center">Days worked</TH><TH className="text-center">Saturdays</TH><TH className="text-center">OT hr</TH>
                <TH className="text-center">Inc-1</TH><TH className="text-center">Inc-2</TH><TH></TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => {
                const sh = shiftById(r.weekShiftId);
                return (
                  <TR key={r.e.id}>
                    <TD className="font-mono text-xs text-muted-foreground">{r.e.id}</TD>
                    <TD className="font-medium"><button className="text-left hover:text-primary hover:underline" onClick={() => setDetail(r.e)}>{r.e.name}</button><div className="text-[10px] font-normal text-muted-foreground">details →</div></TD>
                    <TD><Badge tone="muted">{categoryById(r.e.category)?.label ?? r.e.category}</Badge></TD>
                    <TD>
                      <select
                        value={r.weekShiftId}
                        onChange={(ev) => {
                          setWeekShift(r.e.id, CURRENT_WEEK_ROW, ev.target.value);
                          toast("Shift updated", `${r.e.name} moved to ${shiftById(ev.target.value)?.code} — ${shiftById(ev.target.value)?.name} for this week.`);
                        }}
                        title={`${sh?.time} — this week only; use the calendar icon for other weeks`}
                        className="h-7 rounded-md border border-input bg-card px-1.5 text-[11px] text-info focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {SHIFTS.map((s) => (
                          <option key={s.id} value={s.id}>{s.code} · {s.hours}h</option>
                        ))}
                      </select>
                    </TD>
                    <TD className="text-center">
                      <select
                        value={r.today ?? ""}
                        title={`Mark attendance for today (${TODAY})`}
                        onChange={(ev) => {
                          const v = ev.target.value;
                          if (!v) { clearAttendanceDay(r.e.id, TODAY); toast("Cleared", `${r.e.name} — today's mark removed.`); }
                          else { markAttendanceDay(r.e.id, TODAY, v as AttendanceStatus); toast("Marked", `${r.e.name} — ${v} today.`); }
                        }}
                        className={`${selectCls} w-[92px] ${r.today ? attendanceStatusTone(r.today) === "success" ? "text-success" : attendanceStatusTone(r.today) === "danger" ? "text-danger" : "text-info" : "text-muted-foreground"}`}
                      >
                        <option value="">— mark —</option>
                        <option value="Present">Present</option>
                        <option value="Absent">Absent</option>
                        <option value="Leave">Leave</option>
                        <option value="Holiday">Holiday</option>
                      </select>
                    </TD>
                    <TD className="text-center">
                      <Input type="text" value={String(r.daysWorked)} onChange={(ev) => setAttendance(r.e.id, { daysWorked: num(ev.target.value) })} className="mx-auto h-7 w-14 text-center" />
                    </TD>
                    <TD className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Input type="text" value={String(r.saturdaysWorked)} onChange={(ev) => setAttendance(r.e.id, { saturdaysWorked: Math.min(r.totalSat, num(ev.target.value)) })} className="h-7 w-12 text-center" />
                        <span className="text-xs text-muted-foreground">/{r.totalSat}</span>
                      </div>
                    </TD>
                    <TD className="text-center">
                      {otEditable ? (
                        <Input type="text" value={String(r.otHours)} onChange={(ev) => setAttendance(r.e.id, { otHours: num(ev.target.value) })} className="mx-auto h-7 w-12 text-center" />
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs" title="OT editing is locked after the current week — Admin/CEO only">
                          {r.otHours} <Lock className="h-3 w-3 text-muted-foreground" />
                        </span>
                      )}
                    </TD>
                    <TD className="text-center">
                      {r.inc.inc1Eligible ? <Badge tone="success">Full</Badge> : r.inc.inc1Amount > 0 ? <Badge tone="warning">{r.saturdaysWorked} Sat</Badge> : <span className="text-muted-foreground">—</span>}
                    </TD>
                    <TD className="text-center">
                      {r.inc.inc2Eligible ? <Badge tone="success">Yes</Badge> : <span className="text-muted-foreground">—</span>}
                    </TD>
                    <TD className="text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Attendance calendar — view & mark days" onClick={() => setCalEmp(r.e)}>
                        <CalendarDays className="h-4 w-4" />
                      </Button>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          {rows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No workers match.</p>}
          <p className="mt-3 text-xs text-muted-foreground">
            Tip: mark today’s attendance inline from the “{TODAY.slice(8)} Jul” column; edits recompute incentives + payroll.
            {otEditable ? " OT is open for editing this week." : " OT editing is locked for this period — only Admin/CEO can change it now."}
          </p>
        </CardContent>
      </Card>

      {detail && (() => {
        const a = attendanceFor(attendance, detail.id);
        const sh = shiftById(detail.shiftId);
        const weeks = a?.weekDaysWorked ?? [0, 0, 0, 0];
        const inc = computeIncentives(a?.saturdaysWorked ?? 0, a?.totalSaturdays ?? 4, a?.daysWorked ?? 0);
        return (
          <DetailSheet
            title={`${detail.name} — Attendance & Shift`}
            subtitle={`${detail.id} · ${categoryById(detail.category)?.label} · ${CURRENT_MONTH_LABEL}`}
            badges={[{ label: `Shift ${sh?.code} — ${sh?.name}`, tone: "info" }, { label: `${a?.daysWorked ?? 0} days worked`, tone: "success" }]}
            onClose={() => setDetail(null)}
            sections={[
              { heading: "Shift", rows: [["Shift", sh ? `${sh.code} — ${sh.name}` : "—"], ["Timing", sh?.time ?? "—"], ["Hours", `${sh?.hours ?? "—"}`], ["Department", detail.department]] },
              { heading: "Month summary", stats: [
                { label: "Days worked", value: `${a?.daysWorked ?? 0}` },
                { label: "Saturdays", value: `${a?.saturdaysWorked ?? 0}/${a?.totalSaturdays ?? 4}` },
                { label: "OT hours", value: `${a?.otHours ?? 0}` },
                { label: "Absent", value: `${a?.absent ?? 0}` },
              ] },
              { heading: "Week-by-week", table: {
                cols: ["Week", "Days worked"], right: [false, true],
                rows: WEEK_LABELS.map((w, i) => [w, String(weeks[i] ?? 0)]),
              } },
              { heading: "Incentive impact", rows: [
                ["Incentive 1 (Saturday)", inc.inc1Eligible ? "Full" : inc.inc1Amount > 0 ? "Partial" : "—"],
                ["Incentive 2 (28-day)", inc.inc2Eligible ? "Earned" : "—"],
              ], note: "Edit days / Saturdays / OT in the row; changes are audited and flow into payroll." },
            ]}
          />
        );
      })()}

      {importOpen && (
        <AttendanceImportModal
          employees={employees}
          onApply={(records) => {
            applyDailyAttendance(records);
            toast("Attendance imported", `${records.length} day-records applied for ${TODAY.slice(0, 7)}.`);
          }}
          onClose={() => setImportOpen(false)}
        />
      )}

      {calEmp && (() => {
        // Re-read from the store so a shift change picked below reflects immediately —
        // calEmp itself is a snapshot taken when the calendar was opened.
        const liveCalEmp = employees.find((e) => e.id === calEmp.id) ?? calEmp;
        return (
          <AttendanceCalendar
            employee={liveCalEmp}
            month="2026-07"
            today={TODAY}
            daily={dailyAttendance}
            weekShiftIds={attendanceFor(attendance, calEmp.id)?.weekShiftIds}
            onMark={(date, status) => markAttendanceDay(calEmp.id, date, status)}
            onClear={(date) => clearAttendanceDay(calEmp.id, date)}
            onWeekShiftChange={(weekRow, shiftId) => {
              setWeekShift(calEmp.id, weekRow, shiftId);
              toast("Shift updated", `${calEmp.name} moved to ${shiftById(shiftId)?.code} — ${shiftById(shiftId)?.name} for that week.`);
            }}
            onClose={() => setCalEmp(null)}
          />
        );
      })()}
    </>
  );
}

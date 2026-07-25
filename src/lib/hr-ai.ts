/**
 * LoomHR — HR Agentic AI engine.
 *
 * A deterministic "agent" that runs the daily people operation without a
 * human having to stitch the data together:
 *   • a daily briefing (present / leave / absent, unit-by-unit)
 *   • production-risk detection per operational unit
 *   • coverage gaps when a supervisor / department head is on leave, with an
 *     auto-suggested deputy and re-assignment of their team
 *   • per-employee daily performance ranking
 *   • a natural-language assistant that answers questions over the live data
 *
 * All functions are pure (state in → briefing out) so the same logic powers
 * the in-app AI Command Centre and the shareable snapshot.
 */

import type { HrEmployee } from "@/lib/hr-data";
import { roleGroup, tenure } from "@/lib/hr-data";
import type { AttendanceRecord, LeaveRequest, Advance } from "@/stores/hr";
import {
  UNITS, unitOf, unitInfo, dailyPerformance,
  type Unit, type UnitId, type Performance,
} from "@/lib/hr-master";

export interface AiContext {
  employees: HrEmployee[];
  attendance: AttendanceRecord[];
  leave: LeaveRequest[];
  advances: Advance[];
  today: string;
}

export type DayStatus = "Present" | "Leave" | "Absent";

const within = (d: string, from: string, to: string) => d >= from && d <= to;

/** Is this employee on approved leave on the given day? */
export function onLeaveToday(emp: HrEmployee, leave: LeaveRequest[], today: string): boolean {
  if (emp.conduct === "Long Leave") return true;
  return leave.some(
    (l) => l.empId === emp.id && (l.status === "Approved" || l.status === "Approved by Manager") && within(today, l.from, l.to)
  );
}

export function dayStatus(emp: HrEmployee, leave: LeaveRequest[], today: string): DayStatus {
  if (emp.status === "Exited" || emp.conduct === "Absconded" || emp.conduct === "Exited") return "Absent";
  if (onLeaveToday(emp, leave, today)) return "Leave";
  if (emp.conduct === "Frequent Absent") return "Absent"; // treated absent for the day snapshot
  return "Present";
}

const daysWorked = (att: AttendanceRecord[], id: string) => att.find((a) => a.empId === id)?.daysWorked ?? 0;

export function perfOf(emp: HrEmployee, ctx: AiContext): Performance {
  const onLeave = dayStatus(emp, ctx.leave, ctx.today) !== "Present";
  return dailyPerformance(emp.id, emp.conduct, daysWorked(ctx.attendance, emp.id), onLeave);
}

// ---- Unit status ----------------------------------------------------------

export interface UnitStatus {
  unit: Unit;
  assigned: number;
  present: number;
  onLeave: number;
  absent: number;
  requiredPresent: number;
  presentPct: number;
  atRisk: boolean;
  avgEfficiency: number;
  output: number;
}

export function unitStatuses(ctx: AiContext): UnitStatus[] {
  const roster = ctx.employees.filter((e) => e.status !== "Exited");
  return UNITS.map((unit) => {
    const staff = roster.filter((e) => unitOf(e.department, e.role) === unit.id);
    let present = 0, onLeave = 0, absent = 0, effSum = 0, output = 0;
    staff.forEach((e) => {
      const st = dayStatus(e, ctx.leave, ctx.today);
      if (st === "Present") present++; else if (st === "Leave") onLeave++; else absent++;
      const p = perfOf(e, ctx);
      effSum += p.efficiency; output += p.output;
    });
    const assigned = staff.length;
    const requiredPresent = Math.ceil((assigned * unit.minStrengthPct) / 100);
    const presentPct = assigned ? Math.round((present / assigned) * 100) : 100;
    return {
      unit, assigned, present, onLeave, absent, requiredPresent, presentPct,
      atRisk: assigned > 0 && present < requiredPresent,
      avgEfficiency: present ? Math.round(effSum / Math.max(1, present)) : 0,
      output,
    };
  }).filter((u) => u.assigned > 0);
}

// ---- Coverage gaps & auto-assignment --------------------------------------

export interface CoverageGap {
  leader: HrEmployee;
  unit: UnitId;
  reportsCount: number;
  deputy: HrEmployee | null;
  note: string;
}

const seniority = (e: HrEmployee): number => {
  const g = roleGroup(e.role);
  const base = g === "Management" ? 400 : g === "Supervisor" ? 300 : g === "Staff" ? 200 : g === "Support" ? 100 : 150;
  return base + tenure(e.doj).totalDays / 30 + e.monthlyGross / 10000;
};

/** Leaders (managers / supervisors) on leave today, with a suggested deputy. */
export function coverageGaps(ctx: AiContext): CoverageGap[] {
  const leaders = ctx.employees.filter(
    (e) => e.status !== "Exited" && ["Management", "Supervisor"].includes(roleGroup(e.role)) && dayStatus(e, ctx.leave, ctx.today) === "Leave"
  );
  return leaders.map((leader) => {
    const unit = unitOf(leader.department, leader.role);
    const teammates = ctx.employees.filter(
      (e) => e.id !== leader.id && e.status !== "Exited" && unitOf(e.department, e.role) === unit && dayStatus(e, ctx.leave, ctx.today) === "Present"
    );
    const reports = teammates.filter((e) => roleGroup(e.role) !== "Management");
    // Deputy = most senior *present* person in the unit.
    const deputy = [...teammates].sort((a, b) => seniority(b) - seniority(a))[0] ?? null;
    const note = deputy
      ? `${deputy.name} (${deputy.role}) to act as ${leader.role} for ${unitInfo(unit).label}; ${reports.length} team member${reports.length === 1 ? "" : "s"} report to the deputy today.`
      : `No present deputy in ${unitInfo(unit).label} — escalate: pull cover from an adjacent unit.`;
    return { leader, unit, reportsCount: reports.length, deputy, note };
  });
}

// ---- Alerts ---------------------------------------------------------------

export interface Alert {
  level: "danger" | "warning" | "info" | "success";
  title: string;
  detail: string;
}

export function alerts(ctx: AiContext, units: UnitStatus[], gaps: CoverageGap[]): Alert[] {
  const out: Alert[] = [];

  units.filter((u) => u.atRisk && u.unit.critical).forEach((u) =>
    out.push({ level: "danger", title: `Production risk — ${u.unit.label}`, detail: `${u.present}/${u.assigned} present (need ${u.requiredPresent}). Pull cover to protect output.` })
  );
  gaps.forEach((g) =>
    out.push({ level: "warning", title: `Cover needed — ${g.leader.role} on leave`, detail: g.note })
  );

  // Welfare — pregnant / anaemic workers present today.
  ctx.employees.filter((e) => e.status !== "Exited" && e.health?.pregnant && dayStatus(e, ctx.leave, ctx.today) === "Present").forEach((e) =>
    out.push({ level: "warning", title: `Welfare — ${e.name} (pregnant)`, detail: `Assign lighter duty; ${e.health?.pregnancyNote ?? "monitor with the factory nurse."}` })
  );
  const anaemic = ctx.employees.filter((e) => e.status !== "Exited" && (e.health?.hemoglobin ?? 99) < 11);
  if (anaemic.length) out.push({ level: "info", title: `Health — ${anaemic.length} low-haemoglobin worker${anaemic.length === 1 ? "" : "s"}`, detail: `${anaemic.map((e) => e.name).join(", ")} — iron supplementation / diet review.` });

  // Conduct — absconders / frequent absentees.
  const conductIssues = ctx.employees.filter((e) => ["Absconded", "Frequent Absent"].includes(e.conduct));
  if (conductIssues.length) out.push({ level: "danger", title: `Conduct — ${conductIssues.length} worker${conductIssues.length === 1 ? "" : "s"} flagged`, detail: `${conductIssues.map((e) => `${e.name} (${e.conduct})`).join(", ")}. Agent commission stopped; review replacement.` });

  // Advances outstanding.
  const outstanding = ctx.advances.filter((a) => a.status === "Active").reduce((s, a) => s + (a.amount - a.recovered), 0);
  if (outstanding > 0) out.push({ level: "info", title: `Advances outstanding`, detail: `₹${outstanding.toLocaleString("en-IN")} across ${ctx.advances.filter((a) => a.status === "Active").length} workers, recovering monthly.` });

  return out;
}

// ---- Daily briefing -------------------------------------------------------

export interface Briefing {
  date: string;
  headcount: number;
  present: number;
  onLeave: number;
  absent: number;
  presentPct: number;
  productionRisk: "Low" | "Medium" | "High";
  units: UnitStatus[];
  gaps: CoverageGap[];
  alerts: Alert[];
  leaveToday: { emp: HrEmployee; type: string; from: string; to: string }[];
  topPerformers: { emp: HrEmployee; perf: Performance }[];
  lowPerformers: { emp: HrEmployee; perf: Performance }[];
  totalOutput: number;
  avgEfficiency: number;
  summary: string;
}

export function dailyBriefing(ctx: AiContext): Briefing {
  const roster = ctx.employees.filter((e) => e.status !== "Exited");
  let present = 0, onLeave = 0, absent = 0;
  roster.forEach((e) => {
    const st = dayStatus(e, ctx.leave, ctx.today);
    if (st === "Present") present++; else if (st === "Leave") onLeave++; else absent++;
  });
  const units = unitStatuses(ctx);
  const gaps = coverageGaps(ctx);
  const al = alerts(ctx, units, gaps);

  const criticalAtRisk = units.filter((u) => u.atRisk && u.unit.critical).length;
  const productionRisk: Briefing["productionRisk"] = criticalAtRisk >= 2 ? "High" : criticalAtRisk === 1 || gaps.length >= 2 ? "Medium" : "Low";

  const ranked = roster
    .filter((e) => dayStatus(e, ctx.leave, ctx.today) === "Present")
    .map((emp) => ({ emp, perf: perfOf(emp, ctx) }))
    .sort((a, b) => b.perf.efficiency - a.perf.efficiency);

  const leaveToday = roster
    .map((emp) => {
      const l = ctx.leave.find((x) => x.empId === emp.id && (x.status === "Approved" || x.status === "Approved by Manager") && within(ctx.today, x.from, x.to));
      if (l) return { emp, type: l.type, from: l.from, to: l.to };
      if (emp.conduct === "Long Leave") return { emp, type: "Long Leave", from: "—", to: "—" };
      return null;
    })
    .filter(Boolean) as Briefing["leaveToday"];

  const totalOutput = units.reduce((s, u) => s + u.output, 0);
  const avgEfficiency = ranked.length ? Math.round(ranked.reduce((s, r) => s + r.perf.efficiency, 0) / ranked.length) : 0;
  const presentPct = roster.length ? Math.round((present / roster.length) * 100) : 0;

  const summary =
    `Good morning. ${present}/${roster.length} present (${presentPct}%), ${onLeave} on leave, ${absent} absent. ` +
    `Production risk is ${productionRisk.toLowerCase()}${criticalAtRisk ? ` — ${criticalAtRisk} critical unit(s) short-staffed` : ""}. ` +
    `${gaps.length ? `${gaps.length} supervisor/head on leave — deputies auto-assigned. ` : "All units have their supervisor. "}` +
    `Average efficiency ${avgEfficiency}% with ${totalOutput.toLocaleString("en-IN")} units of output planned today.`;

  return {
    date: ctx.today, headcount: roster.length, present, onLeave, absent, presentPct,
    productionRisk, units, gaps, alerts: al, leaveToday,
    topPerformers: ranked.slice(0, 5),
    lowPerformers: ranked.filter((r) => r.perf.rating === "Low" || r.perf.efficiency < 70).slice(-5).reverse(),
    totalOutput, avgEfficiency, summary,
  };
}

// ---- Natural-language assistant -------------------------------------------

export interface AiAnswer {
  answer: string;
  rows?: { label: string; value: string }[];
}

export const SUGGESTED_QUESTIONS = [
  "How many are on leave today?",
  "What is the production risk today?",
  "Who is absent in production?",
  "Who should cover the supervisors on leave?",
  "Show me today's top performers",
  "How is the dyeing unit doing?",
  "Any welfare or health alerts?",
  "Total output and efficiency today",
];

export function answerQuery(qRaw: string, ctx: AiContext): AiAnswer {
  const q = qRaw.toLowerCase().trim();
  const b = dailyBriefing(ctx);
  const has = (...k: string[]) => k.some((x) => q.includes(x));

  // Leave counts / list
  if (has("leave") && has("how many", "count", "number")) {
    return {
      answer: `${b.onLeave} on leave today (${b.date}). ${b.leaveToday.length ? "See the list below." : ""}`,
      rows: b.leaveToday.map((l) => ({ label: `${l.emp.name} — ${l.emp.role}`, value: `${l.type} (${l.from}→${l.to})` })),
    };
  }
  // Production risk
  if (has("production risk", "risk", "at risk", "shortage", "short-staffed", "short staffed")) {
    const risky = b.units.filter((u) => u.atRisk);
    return {
      answer: `Production risk is ${b.productionRisk}. ${risky.length ? `${risky.length} unit(s) below required strength.` : "All units above required strength."}`,
      rows: risky.map((u) => ({ label: u.unit.label, value: `${u.present}/${u.assigned} present · need ${u.requiredPresent}` })),
    };
  }
  // Coverage / who covers
  if (has("cover", "deputy", "in-charge", "in charge", "supervisor on leave", "head on leave", "assign")) {
    if (!b.gaps.length) return { answer: "No supervisors or heads are on leave today — every unit has its leader." };
    return {
      answer: `${b.gaps.length} leader(s) on leave. Auto-assigned deputies:`,
      rows: b.gaps.map((g) => ({ label: `${g.leader.name} (${g.leader.role})`, value: g.deputy ? `→ ${g.deputy.name} acts in-charge · ${g.reportsCount} reports` : "No deputy — escalate" })),
    };
  }
  // Top / best performers
  if (has("top performer", "best performer", "top", "best", "highest")) {
    return {
      answer: "Today's top performers by efficiency:",
      rows: b.topPerformers.map((r) => ({ label: `${r.emp.name} — ${r.emp.role}`, value: `${r.perf.efficiency}% · ${r.perf.rating}` })),
    };
  }
  // Low performers
  if (has("low performer", "worst", "under-perform", "underperform", "lowest", "poor")) {
    return {
      answer: b.lowPerformers.length ? "Workers needing attention today:" : "No under-performers flagged today.",
      rows: b.lowPerformers.map((r) => ({ label: `${r.emp.name} — ${r.emp.role}`, value: `${r.perf.efficiency}% · ${r.perf.rating}` })),
    };
  }
  // Welfare / health
  if (has("welfare", "health", "pregnant", "anaemia", "anemia", "haemoglobin", "hemoglobin", "sick")) {
    const rows = b.alerts.filter((a) => a.title.startsWith("Welfare") || a.title.startsWith("Health")).map((a) => ({ label: a.title, value: a.detail }));
    return { answer: rows.length ? "Health & welfare items today:" : "No health or welfare alerts today.", rows };
  }
  // Output / efficiency
  if (has("output", "efficiency", "productivity", "production today", "how much")) {
    return {
      answer: `Planned output today is ${b.totalOutput.toLocaleString("en-IN")} units at ${b.avgEfficiency}% average efficiency.`,
      rows: b.units.map((u) => ({ label: u.unit.label, value: `${u.output.toLocaleString("en-IN")} units · ${u.avgEfficiency}% eff` })),
    };
  }
  // Present / attendance summary
  if (has("present", "attendance", "how many working", "strength", "headcount")) {
    return {
      answer: `${b.present}/${b.headcount} present today (${b.presentPct}%), ${b.onLeave} on leave, ${b.absent} absent.`,
      rows: b.units.map((u) => ({ label: u.unit.label, value: `${u.present}/${u.assigned} present` })),
    };
  }
  // A named unit?
  const unit = UNITS.find((u) => q.includes(u.id.toLowerCase()) || u.label.toLowerCase().split(" ").some((w) => w.length > 3 && q.includes(w.toLowerCase())));
  if (unit) {
    const us = b.units.find((u) => u.unit.id === unit.id);
    if (us) return {
      answer: `${unit.label}: ${us.present}/${us.assigned} present (${us.presentPct}%), ${us.onLeave} on leave, ${us.absent} absent. Avg efficiency ${us.avgEfficiency}%, ${us.output.toLocaleString("en-IN")} units. ${us.atRisk ? "⚠ Below required strength — pull cover." : "Strength OK."}`,
    };
  }
  // Absent
  if (has("absent", "absentee", "not present", "missing")) {
    const abs = ctx.employees.filter((e) => e.status !== "Exited" && dayStatus(e, ctx.leave, ctx.today) === "Absent");
    return { answer: `${abs.length} absent today.`, rows: abs.map((e) => ({ label: `${e.name} — ${e.role}`, value: e.conduct })) };
  }

  // Fallback → full briefing summary.
  return { answer: b.summary };
}

/**
 * Performance appraisal — a suggested review computed from live attendance,
 * conduct and daily performance, which HR can adjust and finalise. Produces an
 * overall score, a rating band and a recommended increment %.
 */

import type { HrEmployee } from "@/lib/hr-data";
import type { AttendanceRecord } from "@/stores/hr";

export const APPRAISAL_CYCLE = "FY 2025-26";

export interface AppraisalScores {
  productivity: number; // 1–5
  quality: number;
  attendance: number;
  discipline: number;
  teamwork: number;
}

export interface AppraisalResult extends AppraisalScores {
  overall: number;      // 1–5, one decimal
  band: string;
  tone: "success" | "info" | "warning" | "danger";
  incrementPct: number;
}

const clamp5 = (n: number) => Math.max(1, Math.min(5, Math.round(n * 10) / 10));

export function ratingBand(overall: number): { band: string; tone: AppraisalResult["tone"]; incrementPct: number } {
  if (overall >= 4.5) return { band: "Outstanding", tone: "success", incrementPct: 12 };
  if (overall >= 3.8) return { band: "Exceeds", tone: "success", incrementPct: 9 };
  if (overall >= 3.0) return { band: "Meets", tone: "info", incrementPct: 6 };
  if (overall >= 2.0) return { band: "Needs improvement", tone: "warning", incrementPct: 3 };
  return { band: "Unsatisfactory", tone: "danger", incrementPct: 0 };
}

/**
 * Suggested appraisal from the worker's real record: average days worked and
 * OT over the last (up to) six completed months, plus conduct. Quality and
 * teamwork have no data source, so they start neutral for the reviewer to set.
 */
export function suggestedAppraisal(e: HrEmployee, history: AttendanceRecord[] = [], currentMonth = "9999-12"): AppraisalResult {
  const done = history.filter((a) => a.empId === e.id && a.month < currentMonth && a.daysWorked > 0)
    .sort((a, b) => b.month.localeCompare(a.month)).slice(0, 6);
  const avg = (f: (a: AttendanceRecord) => number) => (done.length ? done.reduce((s, a) => s + f(a), 0) / done.length : 0);
  const days = avg((a) => a.daysWorked), ot = avg((a) => a.otHours);
  const known = done.length > 0;
  const attendance = known ? clamp5((days / 26) * 5) : 3;                       // 26 days = full month
  const productivity = known ? clamp5(2.5 + (days / 26) * 1.8 + Math.min(0.7, ot / 60)) : 3; // steady days + willing OT
  const discipline = clamp5(e.conduct === "Proper" ? 4.6 : e.conduct === "Frequent Absent" ? 2.4 : e.conduct === "Long Leave" ? 3 : 1.5);
  const quality = clamp5(3 + (e.employmentType === "Experienced" ? 0.3 : 0));
  const teamwork = 3; // no data source — reviewer sets it
  const scores = { productivity, quality, attendance, discipline, teamwork };
  const overall = clamp5((productivity + quality + attendance + discipline + teamwork) / 5);
  const b = ratingBand(overall);
  return { ...scores, overall, ...b };
}

export function overallFromScores(s: AppraisalScores): number {
  return clamp5((s.productivity + s.quality + s.attendance + s.discipline + s.teamwork) / 5);
}

/**
 * Performance appraisal — a suggested review computed from live attendance,
 * conduct and daily performance, which HR can adjust and finalise. Produces an
 * overall score, a rating band and a recommended increment %.
 */

import type { HrEmployee } from "@/lib/hr-data";
import { dailyPerformance } from "@/lib/hr-master";
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

/** Suggested appraisal derived from attendance, conduct and daily output. */
export function suggestedAppraisal(e: HrEmployee, att?: AttendanceRecord): AppraisalResult {
  const days = att?.daysWorked ?? 24;
  const perf = dailyPerformance(e.id, e.conduct, days, false);
  const productivity = clamp5(perf.efficiency / 20);                 // 100% → 5
  const attendance = clamp5((days / 28) * 5);                        // 28+ days → 5
  const discipline = clamp5(e.conduct === "Proper" ? 4.6 : e.conduct === "Frequent Absent" ? 2.4 : e.conduct === "Long Leave" ? 3 : 1.5);
  const quality = clamp5((perf.efficiency / 22) + (e.employmentType === "Experienced" ? 0.6 : 0));
  const teamwork = clamp5(3.6 + (e.conduct === "Proper" ? 0.7 : -0.6));
  const scores = { productivity, quality, attendance, discipline, teamwork };
  const overall = clamp5((productivity + quality + attendance + discipline + teamwork) / 5);
  const b = ratingBand(overall);
  return { ...scores, overall, ...b };
}

export function overallFromScores(s: AppraisalScores): number {
  return clamp5((s.productivity + s.quality + s.attendance + s.discipline + s.teamwork) / 5);
}

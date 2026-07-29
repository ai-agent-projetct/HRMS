"use client";

/**
 * Monthly Wages Statement generator — reproduces the company's "mwages"
 * category-wise wage statement (monospace Lucida Console, fixed-width columns,
 * ===== rules, page/grand totals) as a downloadable PDF.
 *
 * Two layouts: "monthly" (staff / permanent — Basic/FDA/VDA/Spl/HRA/NFH) and
 * "daywage" (apprentice / casual / hostel / Orissa — days × rate + incentive,
 * with MESS). Uses each worker's saved statement figures when present, else
 * computes from wage, attendance, advances and deductions.
 */

import type { HrEmployee } from "@/lib/hr-data";
import { computeIncentives } from "@/lib/hr-master";
import { COMPANY } from "@/lib/company";
import { LUCIDA_CONSOLE_BASE64 } from "@/lib/lucida-console-font";
import type { AttendanceRecord, Advance, MonthlyDeduction } from "@/stores/hr";
import { attendanceFor, deductionFor, advanceRecoveryFor } from "@/stores/hr";

export type StmtLayout = "monthly" | "daywage";

export interface StmtRow {
  token: string; name: string; pfCode: string;
  totalDays: number; workedDays: number; wagePerDay: number;
  basic26: number; basic: number; fda: number; vda: number; spl: number; hra: number; nfh: number;
  totalWages: number; incentive: number; otAmt: number; gross: number;
  pf: number; esi: number; adv: number; mess: number; others: number; lic: number; pmDiff: number;
  totalDed: number; roundOff: number; net: number;
}

export interface StmtCtx {
  attendance: AttendanceRecord[];
  advances: Advance[];
  deductions: MonthlyDeduction[];
}

const r0 = (n?: number) => Math.round(n || 0);

/** Normalised statement row for one worker (snapshot if present, else computed). */
export function statementRow(e: HrEmployee, ctx: StmtCtx): StmtRow {
  const s = e.statement;
  if (s) {
    const gross = r0(s.gross);
    const totalDed = r0((s.pf ?? 0) + (s.esi ?? 0) + (s.adv ?? 0) + (s.mess ?? 0) + (s.others ?? 0) + (s.lic ?? 0));
    return {
      token: e.tokenNo ?? e.id, name: e.name, pfCode: e.pfCode ?? "",
      totalDays: r0(s.dw ? 30 : 0), workedDays: r0(s.dw), wagePerDay: r0(s.wagePerDay),
      basic26: r0(s.basic), basic: r0(s.basic), fda: r0(s.fda), vda: r0(s.vda), spl: r0(s.spl), hra: r0(s.hra), nfh: r0(s.nfh),
      totalWages: r0((s.wagePerDay ?? 0) * (s.dw ?? 0)), incentive: r0(s.incentive), otAmt: r0(s.otAmt), gross,
      pf: r0(s.pf), esi: r0(s.esi), adv: r0(s.adv), mess: r0(s.mess), others: r0(s.others), lic: r0(s.lic), pmDiff: r0(s.pmDiff),
      totalDed, roundOff: r0(s.roundOff), net: r0(s.net ?? gross - totalDed),
    };
  }
  // Compute from live data.
  const a = attendanceFor(ctx.attendance, e.id);
  const ded = deductionFor(ctx.deductions, e.id);
  const adv = advanceRecoveryFor(ctx.advances, e.id);
  const pfOn = e.pfApplicable ?? true;
  if (e.wageType === "Monthly") {
    const g = e.monthlyGross;
    const basic = r0(Math.min(g * 0.5, 15000 * 2));
    const hra = r0(g * 0.1);
    const spl = r0(g - basic - hra);
    const pf = pfOn ? r0(Math.min(basic, 15000) * 0.12) : 0;
    const esi = pfOn && g <= 21000 ? r0(g * 0.0075) : 0;
    const totalDed = pf + esi + adv + ded.mess + ded.others;
    return {
      token: e.tokenNo ?? e.id, name: e.name, pfCode: e.pfCode ?? "", totalDays: 26, workedDays: a?.daysWorked ?? 26,
      wagePerDay: 0, basic26: basic, basic, fda: 0, vda: 0, spl, hra, nfh: 0,
      totalWages: g, incentive: 0, otAmt: 0, gross: g, pf, esi, adv, mess: ded.mess, others: ded.others, lic: 0, pmDiff: 0,
      totalDed, roundOff: 0, net: g - totalDed,
    };
  }
  const rate = e.salaryPerDay ?? 0;
  const dw = a?.daysWorked ?? 0;
  const totalWages = r0(rate * dw);
  const inc = computeIncentives(a?.saturdaysWorked ?? 0, a?.totalSaturdays ?? 4, dw).total;
  const gross = totalWages + inc;
  const pf = pfOn ? r0(Math.min(totalWages, 15000) * 0.12) : 0;
  const esi = pfOn && gross <= 21000 ? r0(gross * 0.0075) : 0;
  const totalDed = pf + esi + adv + ded.mess + ded.others;
  return {
    token: e.tokenNo ?? e.id, name: e.name, pfCode: e.pfCode ?? "", totalDays: 30, workedDays: dw,
    wagePerDay: rate, basic26: 0, basic: 0, fda: 0, vda: 0, spl: 0, hra: 0, nfh: 0,
    totalWages, incentive: inc, otAmt: 0, gross, pf, esi, adv, mess: ded.mess, others: ded.others, lic: 0, pmDiff: 0,
    totalDed, roundOff: 0, net: gross - totalDed,
  };
}

// ---- Fixed-width monospace rendering --------------------------------------

const money = (n: number) => (n ? n.toLocaleString("en-IN") : "0");
const padR = (s: string, w: number) => s.length > w ? s.slice(0, w) : s.padStart(w);
const padL = (s: string, w: number) => s.length > w ? s.slice(0, w) : s.padEnd(w);

interface Col { h: string; w: number; get: (r: StmtRow, i: number) => string; right?: boolean; }

const DAYWAGE_COLS: Col[] = [
  { h: "SNO", w: 3, get: (_r, i) => String(i + 1), right: true },
  { h: "T.No", w: 6, get: (r) => r.token, right: false },
  { h: "TDy", w: 3, get: (r) => String(r.totalDays), right: true },
  { h: "WDy", w: 4, get: (r) => String(r.workedDays), right: true },
  { h: "W/Day", w: 7, get: (r) => money(r.wagePerDay), right: true },
  { h: "T.Wages", w: 9, get: (r) => money(r.totalWages), right: true },
  { h: "Incen", w: 8, get: (r) => money(r.incentive), right: true },
  { h: "Gross", w: 9, get: (r) => money(r.gross), right: true },
  { h: "P.F.", w: 7, get: (r) => money(r.pf), right: true },
  { h: "E.S.I", w: 6, get: (r) => money(r.esi), right: true },
  { h: "ADV", w: 8, get: (r) => money(r.adv), right: true },
  { h: "MESS", w: 7, get: (r) => money(r.mess), right: true },
  { h: "OTH", w: 6, get: (r) => money(r.others), right: true },
  { h: "T.Ded", w: 8, get: (r) => money(r.totalDed), right: true },
  { h: "R.Off", w: 5, get: (r) => money(r.roundOff), right: true },
  { h: "NetWages", w: 9, get: (r) => money(r.net), right: true },
];

const MONTHLY_COLS: Col[] = [
  { h: "SNO", w: 3, get: (_r, i) => String(i + 1), right: true },
  { h: "T.No", w: 6, get: (r) => r.token, right: false },
  { h: "WDy", w: 4, get: (r) => String(r.workedDays), right: true },
  { h: "Basic26", w: 8, get: (r) => money(r.basic26), right: true },
  { h: "Basic", w: 8, get: (r) => money(r.basic), right: true },
  { h: "F.D.A", w: 6, get: (r) => money(r.fda), right: true },
  { h: "V.D.A", w: 7, get: (r) => money(r.vda), right: true },
  { h: "Spl.Al", w: 9, get: (r) => money(r.spl), right: true },
  { h: "H.R.A", w: 6, get: (r) => money(r.hra), right: true },
  { h: "NFH", w: 6, get: (r) => money(r.nfh), right: true },
  { h: "Gross", w: 9, get: (r) => money(r.gross), right: true },
  { h: "P.F.", w: 7, get: (r) => money(r.pf), right: true },
  { h: "E.S.I", w: 6, get: (r) => money(r.esi), right: true },
  { h: "ADV", w: 8, get: (r) => money(r.adv), right: true },
  { h: "OTH", w: 6, get: (r) => money(r.others), right: true },
  { h: "T.Ded", w: 8, get: (r) => money(r.totalDed), right: true },
  { h: "NetWages", w: 9, get: (r) => money(r.net), right: true },
];

function lineOf(cols: Col[], vals: string[]): string {
  return cols.map((c, i) => (c.right ? padR(vals[i], c.w) : padL(vals[i], c.w))).join(" ");
}

async function getJsPdf() {
  const mod = await import("jspdf");
  return mod.jsPDF ?? (mod as unknown as { default: typeof import("jspdf").jsPDF }).default;
}

export interface StatementOpts {
  categoryLabel: string;
  layout: StmtLayout;
  rows: StmtRow[];
  unit?: string;
  periodFrom?: string;
  periodTo?: string;
  monthLabel?: string;
  paidOn?: string;
}

/** Renders and downloads the category wage statement PDF. */
export async function downloadWageStatement(o: StatementOpts) {
  const JsPDF = await getJsPdf();
  const pdf = new JsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  pdf.addFileToVFS("LucidaConsole.ttf", LUCIDA_CONSOLE_BASE64);
  pdf.addFont("LucidaConsole.ttf", "LucidaConsole", "normal");
  pdf.setFont("LucidaConsole");

  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 24;
  const cols = o.layout === "monthly" ? MONTHLY_COLS : DAYWAGE_COLS;
  const rule = "=".repeat(Math.floor((W - M * 2) / 3.3));
  const dash = "-".repeat(Math.floor((W - M * 2) / 3.3));
  let y = 0;

  const header = () => {
    y = 34;
    pdf.setFontSize(13);
    pdf.text(COMPANY.name.toUpperCase(), W / 2, y, { align: "center" }); y += 15;
    pdf.setFontSize(9);
    pdf.text(`MONTHLY WAGES STATEMENT FROM : ${o.periodFrom ?? ""} TO ${o.periodTo ?? ""}`, W / 2, y, { align: "center" }); y += 12;
    pdf.setFontSize(8);
    pdf.text(`Payroll for the month of ${o.monthLabel ?? ""}    ·    paid on ${o.paidOn ?? ""}`, W / 2, y, { align: "center" }); y += 14;
    pdf.text(`CATEGORY : ${o.categoryLabel.toUpperCase()}`, M, y);
    pdf.text(`UNIT : ${o.unit ?? "1"}`, W / 2, y, { align: "center" });
    pdf.text(`Page No : ${pdf.getNumberOfPages()}`, W - M, y, { align: "right" }); y += 10;
    pdf.setFontSize(7.5);
    pdf.text(rule, M, y); y += 11;
    pdf.text(lineOf(cols, cols.map((c) => c.h)) + "  Signature", M, y); y += 10;
    pdf.text(rule, M, y); y += 12;
  };

  header();
  const totals = { totalWages: 0, incentive: 0, gross: 0, pf: 0, esi: 0, adv: 0, mess: 0, others: 0, totalDed: 0, net: 0, spl: 0, basic: 0 };

  o.rows.forEach((rrow, i) => {
    if (y > H - 60) { pdf.addPage(); header(); }
    pdf.text(lineOf(cols, cols.map((c) => c.get(rrow, i))), M, y); y += 10;
    pdf.text(`   ${rrow.name}   [${rrow.pfCode}]`, M, y); y += 10;
    pdf.text(dash, M, y); y += 11;
    totals.totalWages += rrow.totalWages; totals.incentive += rrow.incentive; totals.gross += rrow.gross;
    totals.pf += rrow.pf; totals.esi += rrow.esi; totals.adv += rrow.adv; totals.mess += rrow.mess;
    totals.others += rrow.others; totals.totalDed += rrow.totalDed; totals.net += rrow.net;
    totals.spl += rrow.spl; totals.basic += rrow.basic;
  });

  // Grand total row
  if (y > H - 50) { pdf.addPage(); header(); }
  const totRow: StmtRow = {
    token: "", name: "", pfCode: "", totalDays: 0, workedDays: 0, wagePerDay: 0,
    basic26: totals.basic, basic: totals.basic, fda: 0, vda: 0, spl: totals.spl, hra: 0, nfh: 0,
    totalWages: totals.totalWages, incentive: totals.incentive, otAmt: 0, gross: totals.gross,
    pf: totals.pf, esi: totals.esi, adv: totals.adv, mess: totals.mess, others: totals.others, lic: 0, pmDiff: 0,
    totalDed: totals.totalDed, roundOff: 0, net: totals.net,
  };
  const totCells = cols.map((c) => (["SNO", "T.No", "TDy", "WDy", "W/Day"].includes(c.h) ? "" : c.get(totRow, 0)));
  totCells[1] = "GRAND";
  pdf.text(lineOf(cols, totCells), M, y); y += 10;
  pdf.text(rule, M, y); y += 14;
  pdf.setFontSize(8);
  pdf.text(`Employees : ${o.rows.length}    Gross : ${money(totals.gross)}    Deductions : ${money(totals.totalDed)}    Net Payable : ${money(totals.net)}`, M, y);

  pdf.save(`wage-statement-${o.categoryLabel.replace(/[^\w]+/g, "-").toLowerCase()}.pdf`);
}

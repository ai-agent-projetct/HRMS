"use client";

/**
 * Attendance Excel import engine.
 *
 * Accepts the two shapes factories usually export:
 *  - TALL  : one row per employee, columns like [Token No, Name, P/A, OT, Date]
 *  - WIDE  : one row per employee, a date column per day with P/A/Leave cells
 *
 * Employees are matched by emp id, punch token (tokenNo) or normalised name, so
 * the existing workforce master (including the imported payroll workbook) links
 * up cleanly. Unmatched rows are reported so they can be fixed manually.
 */

import type { ParsedSheet } from "@/lib/excel";
import type { AttendanceStatus, DailyAttendance } from "@/stores/hr";
import type { HrEmployee } from "@/lib/hr-data";

export interface AttendanceImportRow {
  rawKey: string;
  employee?: HrEmployee;
  date: string;
  status?: AttendanceStatus;
  otHours?: number;
  matched: boolean;
}

export type AttendanceSheetFormat = "tall" | "wide" | "none";

export interface AttendanceImportResult {
  rows: AttendanceImportRow[];
  applied: DailyAttendance[];
  format: AttendanceSheetFormat;
  matchedCount: number;
  unmatchedIds: string[];
  skipped: number;
  sourceDate: string | null;
  error?: string;
}

const MONTH_ABBR = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const pad = (n: string | number) => String(n).padStart(2, "0");

const lower = (v: unknown) => String(v ?? "").trim().toLowerCase();
const nameKey = (v: unknown) => lower(v).replace(/\s+/g, " ");

/** Converts a cell to YYYY-MM-DD when possible. Handles Excel serials too. */
export function parseAttendanceDate(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]);
    const y = m[3];
    if (a <= 31 && b <= 12) return `${y}-${pad(b)}-${pad(a)}`; // DD-MM-YYYY
    if (a <= 12 && b <= 31) return `${y}-${pad(a)}-${pad(b)}`; // MM-DD-YYYY fallback
  }
  m = s.match(/^(\d{1,2})[-\s/]+([a-zA-Z]{3,})[-\s/]*(\d{2,4})?$/);
  if (m) {
    const mi = MONTH_ABBR.indexOf(m[2].toLowerCase().slice(0, 3));
    if (mi >= 0) {
      const yr = m[3] ? (Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3])) : new Date().getFullYear();
      return `${yr}-${pad(mi + 1)}-${pad(m[1])}`;
    }
  }
  if (/^\d{5}$/.test(s)) {
    const serial = Number(s);
    if (serial > 30000 && serial < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    }
  }
  return null;
}

/** Maps common punch / register codes to a status. */
export function parseAttendanceStatus(v: unknown): AttendanceStatus | undefined {
  const s = lower(v);
  if (!s) return undefined;
  if (/^(p|present|pr|prs|1|yes|y|true|✓|full|half)$/.test(s)) return "Present";
  if (/^(a|absent|abs|x|0|no|n|false|na|n\/a|✗)$/.test(s)) return "Absent";
  if (/^(l|leave|lop|el|cl|sl|pl|paid|unpaid|hald day)$/.test(s)) return "Leave";
  if (/^(h|holiday|wo|week\s*off|off|sunday)$/.test(s)) return "Holiday";
  return undefined;
}

function buildLookup(employees: HrEmployee[]): {
  byId: Map<string, HrEmployee>;
  byToken: Map<string, HrEmployee>;
  byName: Map<string, HrEmployee>;
} {
  const byId = new Map(), byToken = new Map(), byName = new Map();
  for (const e of employees) {
    byId.set(lower(e.id), e);
    if (e.tokenNo) byToken.set(lower(e.tokenNo), e);
    byName.set(nameKey(e.name), e);
  }
  return { byId, byToken, byName };
}

function matchEmployee(lookup: ReturnType<typeof buildLookup>, key: unknown): HrEmployee | undefined {
  const k = lower(key);
  if (!k) return undefined;
  return lookup.byId.get(k) ?? lookup.byToken.get(k) ?? lookup.byName.get(k);
}

export function parseAttendanceSheet(
  sheet: ParsedSheet,
  employees: HrEmployee[],
  opts: { from: string; to: string }
): AttendanceImportResult {
  const { from, to } = opts;
  const headers = sheet.headers;
  const lookup = buildLookup(employees);
  const idx = (pred: (h: string) => boolean) => headers.findIndex((h) => pred(h.toLowerCase()));

  const inRange = (d: string) => d >= from && d <= to;

  const idCol = idx((h) => /token|t\.no|emp\s*id|emp\s*no|employee\s*(id|no|code)|^id$|^no\.?$/.test(h));
  const dateCol = idx((h) => /^date$|attendance date|punch date|day date/.test(h));
  const statusCol = idx((h) => /p\/a|p\s*or\s*a|status|attendance|present|absent|mark|punch/i.test(h) && !/date/.test(h));
  const otCol = idx((h) => /^ot\b|overtime|over.?time/.test(h));

  const out: AttendanceImportRow[] = [];
  const unmatched = new Set<string>();
  let skipped = 0;

  const pushRow = (row: Record<string, string | number>, date: string) => {
    const rawKey = String(row[headers[idCol]] ?? "").trim();
    if (!rawKey) { skipped += 1; return; }
    const employee = matchEmployee(lookup, rawKey);
    if (!employee) {
      unmatched.add(rawKey);
      out.push({ rawKey, date, matched: false });
      return;
    }
    const statusCell = statusCol >= 0 ? row[headers[statusCol]] : undefined;
    const status = parseAttendanceStatus(statusCell);
    if (!status) { skipped += 1; return; }
    const ot = otCol >= 0 ? Math.max(0, Number(row[headers[otCol]]) || 0) : undefined;
    out.push({ rawKey, employee, date, status, otHours: ot && ot > 0 ? ot : undefined, matched: true });
  };

  let format: AttendanceSheetFormat = "none";
  let sourceDate: string | null = null;

  if (idCol >= 0 && statusCol >= 0) {
    // ---- TALL format -------------------------------------------------------
    format = "tall";
    for (const row of sheet.rows) {
      let date = from;
      if (dateCol >= 0) {
        const parsed = parseAttendanceDate(row[headers[dateCol]]);
        if (parsed) date = parsed;
      }
      if (!inRange(date)) { skipped += 1; continue; }
      sourceDate = sourceDate ?? date;
      pushRow(row, date);
    }
  } else if (idCol >= 0) {
    // ---- WIDE format — date columns carry P/A cells ------------------------
    const dateCols = headers
      .map((h, i) => ({ h, i }))
      .filter(({ h, i }) => {
        if (i === idCol) return false;
        const d = parseAttendanceDate(h);
        return d && inRange(d) && !/name|token|emp|dept|shift/i.test(h);
      });
    if (dateCols.length > 0) {
      format = "wide";
      for (const row of sheet.rows) {
        const rawKey = String(row[headers[idCol]] ?? "").trim();
        if (!rawKey) { skipped += 1; continue; }
        const employee = matchEmployee(lookup, rawKey);
        for (const { h } of dateCols) {
          const date = parseAttendanceDate(h)!;
          const status = parseAttendanceStatus(row[h]);
          if (!status) continue;
          sourceDate = sourceDate ?? date;
          if (!employee) {
            if (!unmatched.has(rawKey)) unmatched.add(rawKey);
            out.push({ rawKey, date, matched: false });
            continue;
          }
          const ot = otCol >= 0 ? Math.max(0, Number(row[headers[otCol]]) || 0) : undefined;
          out.push({ rawKey, employee, date, status, otHours: ot && ot > 0 ? ot : undefined, matched: true });
        }
      }
    }
  }

  if (format === "none") {
    return {
      rows: [], applied: [], format, matchedCount: 0, unmatchedIds: [],
      skipped: 0, sourceDate: null,
      error: idCol < 0
        ? "No employee column found. Expected a 'Token No' / 'Emp ID' column."
        : "No attendance column found. Use P/A per employee (tall) or one date column per day (wide).",
    };
  }

  // De-duplicate by employee + date (last wins) and build the applied payload.
  const seen = new Set<string>();
  const applied: DailyAttendance[] = [];
  for (let i = out.length - 1; i >= 0; i--) {
    const r = out[i];
    if (!r.employee || !r.status) continue;
    const k = `${r.employee.id}|${r.date}`;
    if (seen.has(k)) continue;
    seen.add(k);
    applied.push({ empId: r.employee.id, date: r.date, status: r.status, otHours: r.otHours, source: "import" });
  }

  return {
    rows: out,
    applied,
    format,
    matchedCount: out.filter((r) => r.matched).length,
    unmatchedIds: [...unmatched],
    skipped,
    sourceDate,
  };
}

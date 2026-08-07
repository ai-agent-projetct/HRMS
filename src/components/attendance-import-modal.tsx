"use client";

import { useMemo, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseExcelFile, downloadExcel, type ParsedSheet } from "@/lib/excel";
import { parseAttendanceSheet, type AttendanceImportResult } from "@/lib/attendance-import";
import type { DailyAttendance } from "@/stores/hr";
import { CURRENT_MONTH, TODAY } from "@/stores/hr";
import type { HrEmployee } from "@/lib/hr-data";
import { FileSpreadsheet, Upload, Download, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

const STATUS_TONE: Record<string, "success" | "danger" | "info" | "warning" | "muted"> = {
  Present: "success",
  Absent: "danger",
  Leave: "info",
  Holiday: "warning",
};

function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  const cur = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (cur <= end) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

export function AttendanceImportModal({
  employees,
  onApply,
  onClose,
}: {
  employees: HrEmployee[];
  onApply: (records: DailyAttendance[]) => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [from, setFrom] = useState(`${CURRENT_MONTH}-01`);
  const [to, setTo] = useState(TODAY);
  const [result, setResult] = useState<AttendanceImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rangeDays = useMemo(() => eachDay(from, to), [from, to]);
  const rangeValid = from <= to && rangeDays.length > 0;

  const parseFile = async (f: File, dFrom: string, dTo: string) => {
    setBusy(true);
    setError(null);
    try {
      const sheet: ParsedSheet = await parseExcelFile(f);
      setResult(parseAttendanceSheet(sheet, employees, { from: dFrom, to: dTo }));
    } catch {
      setResult(null);
      setError(`Could not read the file. Use an .xlsx exported from Excel.`);
    } finally {
      setBusy(false);
    }
  };

  const handleFile = (f: File) => {
    setFile(f);
    void parseFile(f, from, to);
  };

  const changeRange = (dFrom: string, dTo: string) => {
    setFrom(dFrom);
    setTo(dTo);
    if (file) void parseFile(file, dFrom, dTo);
  };

  const preview = useMemo(() => result?.rows.slice(0, 8) ?? [], [result]);

  const downloadTemplate = () => {
    const dates = rangeDays.length > 0 ? rangeDays : [TODAY];
    downloadExcel({
      filename: "attendance-template",
      sheetName: "Daily Attendance",
      title: `Daily Attendance — fill P (Present) / A (Absent) / L (Leave) · ${dates[0]} to ${dates[dates.length - 1]}`,
      columns: [
        { header: "Token No", key: "key", width: 12 },
        { header: "Employee Name", key: "name", width: 26 },
        ...dates.map((d) => ({ header: d, key: d, width: 12 })),
      ],
      rows: employees.map((e) => ({
        key: e.tokenNo ?? e.id,
        name: e.name,
        ...Object.fromEntries(dates.map((d) => [d, ""])),
      })),
    });
  };

  return (
    <Modal
      title="Import daily attendance (Excel)"
      description="Pick a date range, download the template (one column per day), fill P/A/L, then upload — everyone Present is auto-marked, everyone missing counts absent. Rows for unknown staff are skipped so you can mark them manually."
      onClose={onClose}
      wide
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              From date
            </label>
            <Input
              type="date"
              value={from}
              onChange={(e) => changeRange(e.target.value, to)}
              className="w-40"
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              To date
            </label>
            <Input
              type="date"
              value={to}
              min={from}
              onChange={(e) => changeRange(from, e.target.value)}
              className="w-40"
            />
          </div>
          {rangeDays.length > 0 && (
            <Badge tone="info" className="mb-1">{rangeDays.length} days</Badge>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4" /> Download template ({rangeDays.length || 1} days)
            </Button>
            <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
              <Upload className="h-4 w-4" /> Choose Excel file
            </Button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>

        {!rangeValid && (
          <p className="flex items-center gap-2 rounded-md border border-danger/40 bg-danger/5 px-3 py-2 text-xs text-danger">
            <AlertTriangle className="h-3.5 w-3.5" /> "To date" must be on or after "From date".
          </p>
        )}

        {busy && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading workbook…
          </p>
        )}
        {error && (
          <p className="flex items-center gap-2 rounded-md border border-danger/40 bg-danger/5 px-3 py-2 text-xs text-danger">
            <AlertTriangle className="h-3.5 w-3.5" /> {error}
          </p>
        )}

        {result && !busy && (
          <>
            {result.error ? (
              <p className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
                <AlertTriangle className="h-3.5 w-3.5" /> {result.error}
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge tone="success">
                    {result.matchedCount} entries{" "}
                    {result.format === "tall"
                      ? `(row-level dates)`
                      : `across ${new Set(result.rows.map((r) => r.date)).size} dates in range`}
                  </Badge>
                  <Badge tone="muted">{result.applied.length} day-records ready</Badge>
                  {result.skipped > 0 && <Badge tone="warning">{result.skipped} rows outside range / blank</Badge>}
                  {result.unmatchedIds.length > 0 && (
                    <Badge tone="danger">{result.unmatchedIds.length} IDs not found</Badge>
                  )}
                </div>

                {preview.length > 0 && (
                  <div className="overflow-hidden rounded-lg border">
                    <Table>
                      <THead>
                        <TR>
                          <TH>ID / Token</TH>
                          <TH>Employee</TH>
                          <TH>Date</TH>
                          <TH className="text-center">Status</TH>
                          <TH className="text-center">OT hr</TH>
                        </TR>
                      </THead>
                      <TBody>
                        {preview.map((r, i) => (
                          <TR key={i}>
                            <TD className="font-mono text-xs text-muted-foreground">{r.rawKey}</TD>
                            <TD>
                              {r.employee ? (
                                <span className="font-medium">{r.employee.name}</span>
                              ) : (
                                <span className="text-danger">Not in workforce</span>
                              )}
                            </TD>
                            <TD className="font-mono text-xs">{r.date}</TD>
                            <TD className="text-center">
                              {r.status ? (
                                <Badge tone={STATUS_TONE[r.status] ?? "muted"}>{r.status}</Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TD>
                            <TD className="text-center text-xs">{r.otHours ?? "—"}</TD>
                          </TR>
                        ))}
                      </TBody>
                    </Table>
                    {result.rows.length > preview.length && (
                      <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
                        …and {result.rows.length - preview.length} more rows
                      </p>
                    )}
                  </div>
                )}

                {result.unmatchedIds.length > 0 && (
                  <p className="rounded-md border border-danger/40 bg-danger/5 px-3 py-2 text-[11px] text-danger">
                    <b>Unknown IDs:</b> {result.unmatchedIds.slice(0, 12).join(", ")}
                    {result.unmatchedIds.length > 12 ? ` and ${result.unmatchedIds.length - 12} more` : ""}. These won't be
                    marked — add them via the employee calendar after importing.
                  </p>
                )}

                <p className="text-[11px] text-muted-foreground">
                  Imported days overwrite the selected employee-days and recompute days-worked, Saturdays, OT and
                  absences for {from.slice(0, 7)}. Wide sheets: only date columns inside the selected range are read.
                </p>

                <div className="flex justify-end gap-2 border-t pt-3">
                  <Button variant="ghost" size="sm" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={!rangeValid || result.applied.length === 0}
                    onClick={() => {
                      onApply(result.applied);
                      onClose();
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Apply {result.applied.length} records
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

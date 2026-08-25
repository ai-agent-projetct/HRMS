"use client";

import { useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { parseExcelFile, downloadExcel } from "@/lib/excel";
import {
  EMPLOYEE_COLUMNS, EMPLOYEE_HEADER_HINTS, employeeToRow, mapRowsToEmployees,
  MAX_IMPORT_ROWS, type EmployeeImportResult,
} from "@/lib/employee-io";
import type { HrEmployee } from "@/lib/hr-data";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Upload, Download, Loader2, AlertTriangle, CheckCircle2, UserPlus, RefreshCw, ShieldAlert } from "lucide-react";

export function EmployeeImportModal({
  employees,
  onApply,
  onClose,
}: {
  employees: HrEmployee[];
  onApply: (emps: HrEmployee[]) => { added: number; updated: number };
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<EmployeeImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [includeDupes, setIncludeDupes] = useState(false);

  const parseFile = async (f: File) => {
    setBusy(true); setError(null); setResult(null); setFileName(f.name); setIncludeDupes(false);
    try {
      const sheet = await parseExcelFile(f, { headerContains: EMPLOYEE_HEADER_HINTS });
      if (sheet.rows.length === 0) { setError("No data rows found. Make sure the sheet has an 'Emp ID' / 'Name' header row."); return; }
      setResult(mapRowsToEmployees(sheet.rows, employees));
    } catch {
      setError("Could not read the file. Use an .xlsx exported from Excel (or download the template below).");
    } finally {
      setBusy(false);
    }
  };

  // Template = every current employee pre-filled, so it round-trips: edit in Excel, re-upload.
  const downloadTemplate = () =>
    downloadExcel({
      filename: "employee-import-template",
      sheetName: "Employees",
      title: "Employee Import Template — edit rows or add new ones (leave Emp ID blank for a new joiner), then upload",
      columns: EMPLOYEE_COLUMNS,
      rows: employees.map(employeeToRow),
    });

  const EXAMPLE_ROW: Record<string, string | number> = {
    id: "", name: "e.g. K. Ramesh", gender: "Male", category: "Permanent", role: "Machine Operator",
    department: "Ring Frame", section: "Spinning", shift: "A", employmentType: "Fresher", status: "Probation",
    doj: "2026-08-25", unit: "Unit 1", location: "Tiruppur", agent: "", conduct: "Proper", wageType: "Monthly",
    monthlyGross: 18000, pfApplicable: "Yes", tdsApplicable: "No", aadhaar: "0000 0000 0000", pan: "ABCDE1234F",
    phone: "+91 90000 00000", bankName: "HDFC Bank", bankBranch: "Tiruppur", bankAccount: "50100000000000", bankIfsc: "HDFC0001234",
  };
  const blankTemplate = () =>
    downloadExcel({
      filename: "employee-import-blank",
      sheetName: "Employees",
      title: "Employee Import (blank) — one row per employee · leave Emp ID blank for new joiners",
      columns: EMPLOYEE_COLUMNS,
      rows: [Object.fromEntries(EMPLOYEE_COLUMNS.map((c) => [c.key, EXAMPLE_ROW[c.key] ?? ""]))],
    });

  const preview = result?.rows.slice(0, 12) ?? [];
  const finalList = result ? (includeDupes ? [...result.toUpsert, ...result.duplicateUpserts] : result.toUpsert) : [];

  return (
    <Modal
      title="Import employees (Excel)"
      description="Upload an .xlsx to add or update employees in bulk (up to 500+). Matching is by Emp ID — existing IDs are updated, blank/new IDs are added. A row whose Aadhaar / PAN / Phone matches someone already on file is flagged as a duplicate and skipped."
      onClose={onClose}
      wide
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4" /> Download current data ({employees.length})
          </Button>
          <Button variant="outline" size="sm" onClick={blankTemplate}>
            <Download className="h-4 w-4" /> Blank template
          </Button>
          <Button size="sm" onClick={() => inputRef.current?.click()} className="ml-auto">
            <Upload className="h-4 w-4" /> Choose Excel file
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void parseFile(f); e.target.value = ""; }}
          />
        </div>

        {fileName && !busy && (
          <p className="text-[11px] text-muted-foreground">File: <span className="font-medium text-foreground">{fileName}</span></p>
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
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge tone="success"><UserPlus className="h-3 w-3" /> {result.newCount} new</Badge>
              <Badge tone="info"><RefreshCw className="h-3 w-3" /> {result.updateCount} updates</Badge>
              {result.duplicateCount > 0 && <Badge tone="danger"><ShieldAlert className="h-3 w-3" /> {result.duplicateCount} duplicates</Badge>}
              {result.skipped > 0 && <Badge tone="warning">{result.skipped} skipped (blank / no name)</Badge>}
              <Badge tone="muted">{finalList.length} will be imported</Badge>
            </div>

            {result.duplicateCount > 0 && (
              <div className="rounded-md border border-danger/40 bg-danger/5 p-3 text-xs">
                <p className="flex items-center gap-2 font-semibold text-danger">
                  <ShieldAlert className="h-4 w-4" /> {result.duplicateCount} row{result.duplicateCount > 1 ? "s" : ""} already exist in the workforce
                </p>
                <ul className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
                  {result.rows.filter((r) => r.status === "duplicate").slice(0, 6).map((r, i) => (
                    <li key={i}>
                      <span className="font-medium text-foreground">{r.name}</span> matches{" "}
                      <span className="font-medium text-foreground">{r.duplicateOf?.name} ({r.duplicateOf?.id})</span> on {r.duplicateOf?.on}
                    </li>
                  ))}
                  {result.duplicateCount > 6 && <li>…and {result.duplicateCount - 6} more</li>}
                </ul>
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11px] font-medium">
                  <input type="checkbox" checked={includeDupes} onChange={(e) => setIncludeDupes(e.target.checked)} className="h-3.5 w-3.5 accent-danger" />
                  Import these duplicates anyway (adds them as new records — not recommended)
                </label>
              </div>
            )}

            {preview.length > 0 && (
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <THead>
                    <TR>
                      <TH>Emp ID</TH><TH>Name</TH><TH>Action</TH><TH>Branch</TH><TH>Category</TH><TH>Role</TH><TH>Department</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {preview.map((r, i) => (
                      <TR key={i}>
                        <TD className="font-mono text-xs text-muted-foreground">{r.id}</TD>
                        <TD className="font-medium">{r.name || <span className="text-danger">—</span>}</TD>
                        <TD>
                          {r.error ? <Badge tone="danger">{r.error}</Badge>
                            : r.status === "duplicate" ? <Badge tone="danger">Duplicate</Badge>
                            : r.status === "new" ? <Badge tone="success">New</Badge>
                            : <Badge tone="info">Update</Badge>}
                        </TD>
                        <TD className="text-xs">{r.unit}</TD>
                        <TD>{r.category}</TD>
                        <TD>{r.role}</TD>
                        <TD>{r.department}</TD>
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

            <p className="text-[11px] text-muted-foreground">
              Updates overwrite only the fields present in the file — documents, health and salary history are preserved.
              {result.toUpsert.length + result.duplicateUpserts.length >= MAX_IMPORT_ROWS && ` Only the first ${MAX_IMPORT_ROWS} rows are processed.`}
            </p>

            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
              <Button
                size="sm"
                disabled={finalList.length === 0}
                onClick={() => { onApply(finalList); onClose(); }}
              >
                <CheckCircle2 className="h-4 w-4" /> Import {finalList.length} employees
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

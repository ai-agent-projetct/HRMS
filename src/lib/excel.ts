"use client";

/**
 * Excel import/export engine (exceljs, loaded on demand so it never lands in
 * the initial bundle). Used by the Report Center, Import/Export Center, GST
 * Returns and Auditor Filing modules.
 */

import type * as ExcelJSType from "exceljs";
import { COMPANY, PRODUCT } from "@/lib/company";

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
}

async function getExcelJS(): Promise<typeof ExcelJSType> {
  const mod = (await import("exceljs")) as unknown as {
    default?: typeof ExcelJSType;
  } & typeof ExcelJSType;
  return (mod.default ?? mod) as typeof ExcelJSType;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function safeFilename(name: string): string {
  return name.replace(/[^\w\d-]+/g, "-").replace(/-+/g, "-").toLowerCase();
}

/** Generates a styled .xlsx and downloads it in the browser. */
export async function downloadExcel(opts: {
  filename: string;
  sheetName: string;
  columns: ExcelColumn[];
  rows: Record<string, unknown>[];
  title?: string;
}): Promise<void> {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = PRODUCT.name;
  wb.created = new Date();
  const ws = wb.addWorksheet(opts.sheetName.slice(0, 31));

  let headerRowIdx = 1;
  if (opts.title) {
    const titleRow = ws.addRow([opts.title]);
    titleRow.font = { bold: true, size: 13 };
    ws.mergeCells(1, 1, 1, Math.max(1, opts.columns.length));
    ws.addRow([
      `${COMPANY.name} — generated ${new Date().toLocaleString("en-IN")}`,
    ]);
    ws.addRow([]);
    headerRowIdx = 4;
  }

  ws.addRow(opts.columns.map((c) => c.header));
  const headerRow = ws.getRow(headerRowIdx);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4F46E5" },
    };
    cell.alignment = { vertical: "middle" };
    cell.border = { bottom: { style: "thin", color: { argb: "FF312E81" } } };
  });
  headerRow.height = 20;

  for (const row of opts.rows) {
    ws.addRow(opts.columns.map((c) => row[c.key] ?? ""));
  }

  opts.columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width =
      c.width ??
      Math.min(
        42,
        Math.max(
          c.header.length + 4,
          ...opts.rows
            .slice(0, 50)
            .map((r) => String(r[c.key] ?? "").length + 2)
        )
      );
  });

  const buf = await wb.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${safeFilename(opts.filename)}.xlsx`
  );
}

/** Plain CSV download (Excel-compatible, UTF-8 BOM for ₹ and Unicode). */
export function downloadCsv(
  filename: string,
  columns: ExcelColumn[],
  rows: Record<string, unknown>[]
): void {
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    columns.map((c) => esc(c.header)).join(","),
    ...rows.map((r) => columns.map((c) => esc(r[c.key])).join(",")),
  ];
  triggerDownload(
    new Blob(["﻿" + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    }),
    `${safeFilename(filename)}.csv`
  );
}

export interface ParsedSheet {
  headers: string[];
  rows: Record<string, string | number>[];
}

/** Reads the first worksheet of an uploaded .xlsx into header-keyed rows. */
export async function parseExcelFile(file: File): Promise<ParsedSheet> {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) return { headers: [], rows: [] };

  const norm = (v: ExcelJSType.CellValue): string | number => {
    if (v === null || v === undefined) return "";
    if (typeof v === "number" || typeof v === "string") return v;
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === "object") {
      if ("result" in v && v.result !== undefined)
        return norm(v.result as ExcelJSType.CellValue);
      if ("richText" in v)
        return v.richText.map((t) => t.text).join("");
      if ("text" in v) return String(v.text);
    }
    return String(v);
  };

  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
    headers[col - 1] = String(norm(cell.value)).trim();
  });

  const rows: Record<string, string | number>[] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, string | number> = {};
    let hasValue = false;
    headers.forEach((h, i) => {
      if (!h) return;
      const v = norm(row.getCell(i + 1).value);
      obj[h] = v;
      if (v !== "") hasValue = true;
    });
    if (hasValue) rows.push(obj);
  });

  return { headers: headers.filter(Boolean), rows };
}

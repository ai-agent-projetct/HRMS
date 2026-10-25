/**
 * Checks the in-app muster importer against a real monthly muster workbook.
 *   FILE="E:/Mehala Docs/OCT-26-ATT.xlsx" FROM=2026-10-01 TO=2026-10-31 npx tsx scripts/check-muster-import.ts
 * Prints marks per code / OT; compare with scripts/mill-etl/etl_muster.py on the same file.
 */
import { readFileSync } from "fs";
import { readWorkbookGrid } from "../src/lib/excel";
import { parseMusterWorkbook, isMusterWorkbook } from "../src/lib/attendance-import";

(async () => {
  const file = process.env.FILE!;
  const grid = await readWorkbookGrid(new File([readFileSync(file)], file));
  if (!isMusterWorkbook(grid)) throw new Error("not a muster workbook (no E.NO header)");
  const tokens = new Set<string>();
  for (const sh of grid) for (const r of sh.rows) for (const v of r.slice(0, 4)) {
    const t = String(v ?? "").trim().toUpperCase();
    if (/^[A-Z]{1,3}\d{1,5}$/.test(t)) tokens.add(t);
  }
  const r = parseMusterWorkbook(grid, [...tokens].map((id) => ({ id, name: id })) as never[], { from: process.env.FROM!, to: process.env.TO! });
  const byCode: Record<string, number> = {};
  for (const d of r.applied) byCode[d.status + (d.shift ? `:${d.shift}` : "")] = (byCode[d.status + (d.shift ? `:${d.shift}` : "")] ?? 0) + 1;
  console.log({ marks: r.applied.length, workers: new Set(r.applied.map((d) => d.empId)).size, byCode, ot: r.applied.reduce((s, d) => s + (d.otHours ?? 0), 0) });
})();

/**
 * Proof that the app's wage engine reproduces the mill's paid salaries.
 *
 * Every register row (ORISSA_SALARY, HOSETL_GIRLS, MONTHLY.xls, mwages PDFs) is
 * recomputed with monthSalary() — the function the Payroll, Salary Record and
 * History screens use — from that row's recorded inputs (days, OT, rate,
 * ESI/PF actually deducted, advance, mess, others, PM-diff, allowances, agent
 * yes/no). Every rupee of arithmetic is the engine's; the result must equal the
 * register NETPAY.
 *
 *   IMPORT=<import.json> npx tsx scripts/verify-registers.ts
 */
import { readFileSync } from "fs";
import { monthSalary, schemeFromSource } from "../src/lib/payroll";

type Part = {
  src: string; days: number; rate: number; ot: number; otAmt: number; incentive: number; allowance?: number;
  esi: number; pf?: number; adv: number; others: number; mess: number; agent: number; pmDiff?: number; net: number;
};
const imp = JSON.parse(readFileSync(process.env.IMPORT!, "utf8"));

const tally: Record<string, { ok: number; bad: number; ex: string[] }> = {};
let rows = 0;
for (const a of imp.attendance) {
  if (!a.paid) continue;
  const parts: Part[] = a.paid.parts ?? [a.paid];
  for (const p of parts) {
    rows++;
    const scheme = schemeFromSource(p.src)!;
    const staffLike = scheme === "staff" || scheme === "casual";
    const r = monthSalary(
      { category: "", agentId: undefined },
      { daysWorked: p.days, otHours: p.ot, rate: p.rate },
      { mess: p.mess, others: p.others, adv: p.adv, pmDiff: p.pmDiff ?? 0 },
      {
        scheme, esi: p.esi, pf: p.pf ?? 0, noAgent: !p.agent,
        allowance: (p.allowance ?? 0) + (staffLike ? p.incentive : 0) + (p.ot ? 0 : p.otAmt), // OT paid as a fixed ₹ amount
      },
    );
    const key = String(p.src).split(" ")[0] + ":" + scheme;
    const t = (tally[key] ??= { ok: 0, bad: 0, ex: [] });
    if (Math.abs(r.net - p.net) <= 1) t.ok++;
    else { t.bad++; if (t.ex.length < 4) t.ex.push(`${a.month} ${a.empId} engine ${r.net} paid ${p.net}`); }
  }
}
let ok = 0, all = 0;
for (const [k, v] of Object.entries(tally).sort()) {
  ok += v.ok; all += v.ok + v.bad;
  console.log(`${k.padEnd(28)} ${v.ok}/${v.ok + v.bad} exact${v.ex.length ? "  e.g. " + v.ex.join(" | ") : ""}`);
}
console.log(`TOTAL ${ok}/${all} register rows (${((ok / all) * 100).toFixed(2)}%) reproduced to the rupee — ${rows} rows checked`);

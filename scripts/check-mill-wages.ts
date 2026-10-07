/**
 * Self-check for src/lib/mill-wages.ts — asserts the engine reproduces real
 * rows from the mill's own workbooks. Run: npx tsx scripts/check-mill-wages.ts
 *
 * Vectors are taken verbatim from AUG-26-SS.xlsx ('AUG-26') and
 * WEEKLY-SEP-26.xlsx ('25 TO 01').
 */
import { computeWeekly, computeMonthly } from "../src/lib/mill-wages";

let fails = 0;
const eq = (name: string, got: number, want: number) => {
  const ok = Math.abs(got - want) < 1e-6;
  if (!ok) { fails++; console.error(`  FAIL ${name}: got ${got}, want ${want}`); }
  else console.log(`  ok   ${name} = ${got}`);
};
const D = (s: string) => s.split(",").map((shift) => ({ shift }));

console.log("Monthly register (AUG-26-SS):");
// Row 5 SUMITHRA: rate 550, 19 days, 3 OT, ESI 200 → net 10200
{
  const r = computeMonthly({ rate: 550, daysWorked: 19, ot: 3, esi: 200 });
  eq("row5 totWage", r.totWage, 10450);
  eq("row5 otWage", r.otWage, 138);
  eq("row5 incentive", r.incentive, 0);
  eq("row5 gross", r.gross, 10588);
  eq("row5 agentComm", r.agentComm, 190);
  eq("row5 net", r.net, 10200);
}
// Row 7 JEMA: rate 550, 28 days, 9 OT, ESI 200 → incentive 840, net 16170
{
  const r = computeMonthly({ rate: 550, daysWorked: 28, ot: 9, esi: 200 });
  eq("row7 otWage", r.otWage, 413);
  eq("row7 incentive", r.incentive, 840);
  eq("row7 gross", r.gross, 16653);
  eq("row7 net", r.net, 16170);
}

console.log("Weekly register (25 TO 01, Fri→Thu; idx2 = Sunday):");
// Row 9 VELUMANI: rate 365, D D D D A D D, no bus fare → incen1 180, net 2370
{
  const r = computeWeekly({ rate: 365, days: D("D,D,D,D,A,D,D"), busFarePerDay: 0 });
  eq("row9 wkd", r.wkd, 6);
  eq("row9 incen1", r.incen1, 180);
  eq("row9 gross", r.gross, 2370);
  eq("row9 net", r.net, 2370);
}
// Row 8 TAMILARASI: rate 365, D A D D A D D → 5 days, incen1 150, net 1980
{
  const r = computeWeekly({ rate: 365, days: D("D,A,D,D,A,D,D"), busFarePerDay: 0 });
  eq("row8 wkd", r.wkd, 5);
  eq("row8 incen1", r.incen1, 150);
  eq("row8 gross", r.gross, 1975);
  eq("row8 net", r.net, 1980);
}
// Row 5 SARASWATHI: rate 365, D D D D A D D, bus fare 14/day → gross 2454, net 2450
{
  const r = computeWeekly({ rate: 365, days: D("D,D,D,D,A,D,D"), busFarePerDay: 14 });
  eq("row5 busFare", r.busFare, 84);
  eq("row5 gross", r.gross, 2454);
  eq("row5 net", r.net, 2450);
}
// Row 13: rate 335, F F F F F D D → 7 days, 5 nights, incen1 210, incen2 50
{
  const r = computeWeekly({ rate: 335, days: D("F,F,F,F,F,D,D") });
  eq("row13 wkd", r.wkd, 7);
  eq("row13 nights", r.nights, 5);
  eq("row13 incen1", r.incen1, 210);
  eq("row13 incen2", r.incen2, 50);
}
// Row 19 (Sunday absent cancels INCEN-1 even with 6 days):
{
  const r = computeWeekly({ rate: 395, days: D("D,D,A,D,D,D,D") });
  eq("row19 wkd", r.wkd, 6);
  eq("row19 sundayWorked", r.sundayWorked ? 1 : 0, 0);
  eq("row19 incen1", r.incen1, 0);
}
// Row 21: rate 395, F A A A A A A → 1 night, <5 days: incen1 0, incen2 10
{
  const r = computeWeekly({ rate: 395, days: D("F,A,A,A,A,A,A") });
  eq("row21 wkd", r.wkd, 1);
  eq("row21 incen1", r.incen1, 0);
  eq("row21 incen2", r.incen2, 10);
}

console.log(fails === 0 ? "\nALL PASS ✓" : `\n${fails} FAIL ✗`);
process.exit(fails === 0 ? 0 : 1);

/**
 * Read-only integrity audit of the live database.
 *   npx tsx scripts/audit-data.ts            (db-config.json)
 *   TARGET=local npx tsx scripts/audit-data.ts  (.env.local)
 */
import { readFileSync } from "fs";
import { config } from "dotenv";

if (process.env.TARGET === "local") config({ path: ".env.local" });
else Object.assign(process.env, JSON.parse(readFileSync("db-config.json", "utf8")));

const issues: Record<string, string[]> = {};
const flag = (k: string, v: string) => { (issues[k] ??= []).push(v); };

async function main() {
  const { loadAll } = await import("@/lib/db-repo");
  const { allAgents, setCustomAgents, categoryById } = await import("@/lib/hr-master");
  const { monthSalary, schemeFromSource, wageSchemeFor } = await import("@/lib/payroll");
  const s = await loadAll();
  setCustomAgents(s.customAgents ?? []);
  const agentIds = new Set(allAgents().map((a) => a.id));
  const ids = new Set<string>();
  const dim = (ym: string) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate();

  // ---- employees
  for (const e of s.employees) {
    if (ids.has(e.id)) flag("duplicate employee id", e.id);
    ids.add(e.id);
    if (!/^[A-Z]{1,3}\d{1,5}$/.test(e.id)) flag("roll no not letters+digits", e.id);
    if (!e.name?.trim()) flag("missing name", e.id);
    if (!categoryById(e.category)) flag("unknown category", `${e.id}:${e.category}`);
    if (!e.department || e.department === "—") flag(e.status === "Exited" ? "no department (left)" : "no department (ACTIVE)", e.id);
    if (e.status !== "Exited" && !e.unit) flag("active without unit", `${e.id} ${e.category}`);
    if (e.status === "Exited" && !e.exit) flag("left without exit record", e.id);
    if (e.status !== "Exited" && e.exit) flag("active but has exit record", e.id);
    if (e.agentId && !agentIds.has(e.agentId)) flag("agent id not found", `${e.id}:${e.agentId}`);
    if (e.wageType !== "Monthly" && !(e.salaryPerDay! > 0) && e.status !== "Exited") flag("active daily worker without rate", e.id);
    if (/to map/.test(e.referredBy ?? "")) flag("agent code still unmapped", `${e.id}:${e.referredBy}`);
    if (!Array.isArray(e.documents) || e.documents.length === 0) flag("no document checklist", e.id);
  }
  // ---- attendance
  const seenA = new Set<string>();
  const ded = new Map(s.deductions.map((d) => [`${d.empId}|${d.month}`, d]));
  let paidOk = 0, paidBad = 0;
  for (const a of s.attendance) {
    const k = `${a.empId}|${a.month}`;
    if (seenA.has(k)) flag("duplicate attendance (emp, month)", k);
    seenA.add(k);
    if (!ids.has(a.empId)) flag("attendance for unknown employee", k);
    if (a.daysWorked < 0 || a.daysWorked > dim(a.month) + 0.01) flag("days worked outside 0..days-in-month", `${k}=${a.daysWorked}`);
    if (a.otHours < 0) flag("negative OT", k);
    if (a.paid) {
      const p = a.paid;
      if (Math.abs(p.days - a.daysWorked) > 0.01) flag("paid days ≠ attendance days", `${k} ${p.days}/${a.daysWorked}`);
      for (const part of p.parts ?? [p]) {
        const sch = schemeFromSource(part.src)!;
        const staffLike = sch === "staff" || sch === "casual";
        const r = monthSalary({ category: "" }, { daysWorked: part.days, otHours: part.ot, rate: part.rate },
          { mess: part.mess, others: part.others, adv: part.adv, pmDiff: part.pmDiff ?? 0 },
          { scheme: sch, esi: part.esi, pf: part.pf ?? 0, noAgent: !part.agent, allowance: (part.allowance ?? 0) + (staffLike ? part.incentive : 0) + (part.ot ? 0 : part.otAmt) });
        if (Math.abs(r.net - part.net) <= 1) paidOk++; else { paidBad++; flag("engine ≠ register net", `${k} ${r.net}/${part.net}`); }
      }
    } else if (a.month < "2026-10" && a.month >= "2026-04" && a.daysWorked > 0) {
      flag("Apr–Sep month without register figures (computed)", k);
    }
  }
  for (const d of s.deductions) if (!ids.has(d.empId)) flag("deduction for unknown employee", `${d.empId}|${d.month}`);
  // ---- daily marks
  const seenD = new Set<string>();
  const STAT = new Set(["Present", "Half Day", "Absent", "Leave", "Holiday"]);
  const present = new Map<string, number>();
  for (const d of s.dailyAttendance) {
    const k = `${d.empId}|${d.date}`;
    if (seenD.has(k)) flag("duplicate day mark", k);
    seenD.add(k);
    if (!ids.has(d.empId)) flag("day mark for unknown employee", k);
    if (!STAT.has(d.status)) flag("bad day status", `${k}:${d.status}`);
    if (d.shift && !/^[DHFGXY]$/.test(d.shift)) flag("bad shift code", `${k}:${d.shift}`);
    if (d.status === "Present") present.set(`${d.empId}|${d.date.slice(0, 7)}`, (present.get(`${d.empId}|${d.date.slice(0, 7)}`) ?? 0) + 1);
  }
  // hostel girls: register days must equal days present on the muster (Sep proven 87/87)
  const emp = new Map(s.employees.map((e) => [e.id, e]));
  let hOk = 0, hBad = 0;
  for (const a of s.attendance) {
    if (!a.paid || !String(a.paid.src).startsWith("HOSETL") || a.paid.parts || a.month !== "2026-09") continue;
    const pr = present.get(`${a.empId}|${a.month}`);
    if (pr === undefined) continue;
    if (pr === a.daysWorked) hOk++; else { hBad++; flag("hostel Sep: paid days ≠ present on muster", `${a.empId} ${a.daysWorked}/${pr}`); }
  }
  // ---- active employees with no current-month record
  const octIds = new Set(s.attendance.filter((a) => a.month === "2026-10").map((a) => a.empId));
  for (const e of s.employees) if (e.status !== "Exited" && !octIds.has(e.id)) flag("active, no October 2026 attendance yet", `${e.id} ${categoryById(e.category)?.label}`);
  // scheme sanity: category vs latest register
  for (const e of s.employees) {
    const last = s.attendance.filter((a) => a.empId === e.id && a.paid).sort((x, y) => y.month.localeCompare(x.month))[0];
    if (!last || last.paid?.parts) continue;
    const reg = schemeFromSource(last.paid!.src), cur = wageSchemeFor(e.category);
    if (e.status !== "Exited" && last.month === "2026-09" && reg && reg !== cur && !(reg === "casual" && cur === "staff")) flag("category pays differently from Sep register", `${e.id} ${e.category} (${cur}) vs ${reg}`);
  }

  console.log(JSON.stringify({
    employees: s.employees.length, active: s.employees.filter((e) => e.status !== "Exited").length,
    attendance: s.attendance.length, deductions: s.deductions.length, dayMarks: s.dailyAttendance.length,
    advances: s.advances.length, leave: s.leave.length, appraisals: s.appraisals.length, hrUsers: s.hrUsers.length,
    agents: allAgents().length, dataLock: s.dataLock, registerRows: { exact: paidOk, mismatch: paidBad }, hostelSep: { ok: hOk, bad: hBad },
  }));
  for (const [k, v] of Object.entries(issues).sort((a, b) => b[1].length - a[1].length)) console.log(`• ${k}: ${v.length}  e.g. ${v.slice(0, 6).join(", ")}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

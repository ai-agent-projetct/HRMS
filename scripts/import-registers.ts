/**
 * Merge the mill's salary registers + musters (consolidated by the ETL into one
 * token-keyed JSON) into the live database, without duplicating anything.
 *
 *   IMPORT=<path to import.json> [DRY=1] npx tsx scripts/import-registers.ts
 *
 * Target DB: db-config.json (the shared cloud DB every installed app uses).
 *
 * Rules
 *  - Employee ID = mill token (O1025, F3716, SS30, A028, G01 …). Existing
 *    EMP-xxxx records are re-keyed to their token everywhere (attendance,
 *    deductions, day marks, advances, leave, appraisals, payslips, audit).
 *  - Existing employees: only MISSING fields are filled — nothing typed in the
 *    app is overwritten. New tokens become new employees.
 *  - Attendance / deductions upsert by (token, month); day marks by (token, date).
 *    Months / days not in the import are left untouched (Oct-2025…Mar-2026,
 *    October 2026).
 *  - On roll: Odisha / hostel girls / permanent → on the October roll;
 *    monthly staff → paid in September. Everyone else is marked Left with the
 *    last month they were paid.
 */
import { readFileSync } from "fs";
import type { HrEmployee, EmpDocument } from "@/lib/hr-data";
import type { AttendanceRecord, MonthlyDeduction, DailyAttendance } from "@/stores/hr";

Object.assign(process.env, JSON.parse(readFileSync("db-config.json", "utf8")));

type ImpEmp = {
  id: string; name: string; category: string; department: string; unit: string | null; gender: "Male" | "Female";
  agentId?: string | null; agentCode: string; salaryPerDay: number | null; wageType: "Daily" | "Monthly"; monthlyGross: number | null;
  doj: string; fatherName: string | null; dob: string; aadhaar: string; phone: string; address: string; esiNo: string; pfNo: string;
  lastMonth: string; source: string; alt: string; generated: boolean;
};
type Imp = {
  employees: ImpEmp[];
  attendance: (Partial<AttendanceRecord> & { empId: string; month: string })[];
  deductions: MonthlyDeduction[];
  daily: DailyAttendance[];
  aliases: Record<string, string>;
};

const ROLE: Record<string, string> = {
  ODISHA: "Helper / Labour", HOSTEL_GIRLS: "Helper / Labour", PERMANENT: "Permanent Worker", SEMISTAFF: "Semi-Staff",
  APPRENTICE: "Apprentice", SECURITY: "Security Guard", DRIVER: "Driver", MESS: "Mess / Canteen", CASUAL: "Casual Worker",
};
const ON_ROLL_BY_OCT = new Set(["ODISHA", "HOSTEL_GIRLS", "PERMANENT"]);
const DOCS: EmpDocument["type"][] = ["Aadhaar", "PAN", "Degree Certificate", "Experience Certificate", "Bank Passbook", "Photo"];
// Same section, different spellings across the registers / musters.
const DEPT_ALIAS: Record<string, string> = { LH10: "LH/10", KNITT: "KNIT", CANTEEN: "CAN", SWEEP: "SWP", SWE: "SWP", "CUT ROLL": "CUT", EMPT: "EMT" };
const normDept = (d?: string) => {
  const v = String(d ?? "").trim().toUpperCase().replace(/\s*-\s*/g, "-").replace(/\s+/g, " ");
  return DEPT_ALIAS[v] ?? v;
};
const blank = (v: unknown) => v === undefined || v === null || v === "" || v === "—" || v === "0" || v === 0;
const lastDay = (ym: string) => { const [y, m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
const monthName = (ym: string) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });

async function main() {
  const dry = process.env.DRY === "1";
  const imp: Imp = JSON.parse(readFileSync(process.env.IMPORT!, "utf8"));
  const repo = await import("@/lib/db-repo");
  if (!dry) await repo.applyTypeFixes();
  // BASE=<backup.json> re-applies the merge on a saved snapshot (e.g. after an
  // interrupted write) instead of whatever is currently in the database.
  const st: Awaited<ReturnType<typeof repo.loadAll>> = process.env.BASE
    ? JSON.parse(readFileSync(process.env.BASE, "utf8"))
    : await repo.loadAll();
  if (process.env.BASE) console.log("base state ←", process.env.BASE);
  if (!dry && !process.env.BASE) {
    // saveAll replaces table by table — keep a restorable copy of what was there.
    const { mkdirSync, writeFileSync } = await import("fs");
    mkdirSync("backups", { recursive: true });
    const f = `backups/db-before-import-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    writeFileSync(f, JSON.stringify(st));
    console.log("backup →", f);
  }

  // ---- 1. re-key existing employees to their token ------------------------
  const idMap = new Map<string, string>();
  for (const e of st.employees) {
    const tok = (e.tokenNo ?? "").trim();
    const canon = imp.aliases[tok] ?? tok;
    if (canon && canon !== e.id) idMap.set(e.id, canon);
  }
  const re = (id: string) => idMap.get(id) ?? id;
  st.employees = st.employees.map((e) => ({ ...e, id: re(e.id), tokenNo: e.tokenNo && re(e.id) !== e.tokenNo ? e.tokenNo : undefined }));
  st.attendance = st.attendance.map((a) => ({ ...a, empId: re(a.empId) }));
  st.deductions = st.deductions.map((d) => ({ ...d, empId: re(d.empId) }));
  st.dailyAttendance = st.dailyAttendance.map((d) => ({ ...d, empId: re(d.empId) }));
  st.advances = st.advances.map((a) => ({ ...a, empId: re(a.empId) }));
  st.leave = st.leave.map((l) => ({ ...l, empId: re(l.empId) }));
  st.appraisals = st.appraisals.map((a) => ({ ...a, empId: re(a.empId) }));
  st.payslipLog = st.payslipLog.map((p) => ({ ...p, empId: re(p.empId) }));
  st.audit = (st.audit ?? []).map((a) => ({ ...a, empId: a.empId ? re(a.empId) : a.empId }));

  const octRoll = new Set(st.employees.map((e) => e.id)); // the October on-roll master already in the DB
  const byId = new Map(st.employees.map((e) => [e.id, e]));

  // ---- 2. employees: fill missing / add new ---------------------------------
  let added = 0, filled = 0, left = 0, recategorised = 0;
  for (const ie of imp.employees) {
    const onRoll = ON_ROLL_BY_OCT.has(ie.category) ? octRoll.has(ie.id) : ie.lastMonth === "2026-09";
    const cur = byId.get(ie.id);
    const agentCodeNote = ie.agentCode ? `Agent code ${ie.agentCode} (to map)` : undefined;
    if (cur) {
      const patch: Partial<HrEmployee> = {};
      const fill = <K extends keyof HrEmployee>(k: K, v: HrEmployee[K] | null | undefined) => { if (!blank(v) && blank(cur[k])) patch[k] = v as HrEmployee[K]; };
      fill("fatherName", ie.fatherName); fill("doj", ie.doj); fill("dob", ie.dob); fill("aadhaar", ie.aadhaar);
      fill("phone", ie.phone); fill("address", ie.address); fill("esiNo", ie.esiNo); fill("uan", ie.pfNo);
      fill("unit", ie.unit ?? undefined); fill("department", ie.department); fill("salaryPerDay", ie.salaryPerDay ?? undefined);
      fill("agentId", ie.agentId ?? undefined); fill("referredBy", agentCodeNote);
      if (ie.alt) fill("tokenNo", ie.alt);
      // The register a worker is paid from in the latest month decides the pay
      // rules (Odisha vs hostel girls) — that beats an earlier roster guess.
      if ((ie.source === "ORISSA" || ie.source === "HOSTEL") && ie.lastMonth === "2026-09" && cur.category !== ie.category) {
        patch.category = ie.category;
        if (ie.category === "ODISHA") patch.pfApplicable = true;
        recategorised++;
      }
      if (Object.keys(patch).length) { Object.assign(cur, patch); filled++; }
      continue;
    }
    const exp = ie.doj && ie.doj < "2025-10-01";
    const e: HrEmployee = {
      id: ie.id, salutation: ie.gender === "Female" ? "Ms." : "Mr.", name: ie.name, fatherName: ie.fatherName ?? undefined,
      gender: ie.gender, dob: ie.dob || "", bloodGroup: "—",
      role: ROLE[ie.category] ?? "Worker", department: ie.department, grade: "W1", reportsTo: "—",
      employmentType: exp ? "Experienced" : "Fresher", status: onRoll ? "Active" : "Exited", doj: ie.doj,
      prevExpYears: 0, prevExpDetail: "—", phone: ie.phone, altPhone: "—", email: "", address: ie.address || "—",
      emergencyContact: "—", qualification: "—", institution: "—", passYear: 0,
      aadhaar: ie.aadhaar || "—", pan: "—", uan: ie.pfNo || "—", esiNo: ie.esiNo || "—",
      monthlyGross: ie.monthlyGross ?? Math.round((ie.salaryPerDay ?? 0) * 26), ctc: Math.round((ie.monthlyGross ?? (ie.salaryPerDay ?? 0) * 26) * 12),
      wageType: ie.wageType, category: ie.category, shiftId: "SH-A", salaryPerDay: ie.salaryPerDay ?? undefined,
      agentId: ie.agentId ?? undefined, referredBy: agentCodeNote, conduct: onRoll ? "Proper" : "Exited",
      pfApplicable: ie.category === "ODISHA", tdsApplicable: false, unit: ie.unit ?? undefined, tokenNo: ie.alt || undefined,
      documents: DOCS.map((t) => ({ type: t, number: "—", submitted: false, verified: false })),
      salaryHistory: [], bankHistory: [], leave: { el: 0, cl: 0, sl: 0, lopThisMonth: 0 },
      ...(onRoll ? {} : {
        exit: {
          exitDate: lastDay(ie.lastMonth), lastWorkingDay: lastDay(ie.lastMonth), reason: "Other" as const,
          reasonNote: `Not on the roll after ${monthName(ie.lastMonth)} (salary registers)`, settled: true,
          agentIdAtExit: ie.agentId ?? undefined,
        },
      }),
    };
    st.employees.push(e); byId.set(e.id, e); added++;
    if (!onRoll) left++;
  }

  // ---- 3. attendance / deductions / day marks: upsert -----------------------
  const aKey = (x: { empId: string; month: string }) => `${x.empId}|${x.month}`;
  const attMap = new Map(st.attendance.map((a) => [aKey(a), a]));
  let attNew = 0, attUpd = 0;
  for (const a of imp.attendance) {
    const cur = attMap.get(aKey(a));
    const next: AttendanceRecord = {
      saturdaysWorked: 0, totalSaturdays: 4, leave: 0, lop: 0,
      ...(cur ?? {}),
      empId: a.empId, month: a.month, daysWorked: Number(a.daysWorked ?? 0), otHours: Number(a.otHours ?? 0),
      rate: a.rate ?? cur?.rate, paid: a.paid ?? undefined,
      absent: Number(a.absent ?? cur?.absent ?? 0), weekDaysWorked: (a.weekDaysWorked as number[] | undefined) ?? cur?.weekDaysWorked ?? [0, 0, 0, 0],
    };
    if (cur) attUpd++; else attNew++;
    attMap.set(aKey(a), next);
  }
  st.attendance = [...attMap.values()];

  const dedMap = new Map(st.deductions.map((d) => [aKey(d), d]));
  for (const d of imp.deductions) dedMap.set(aKey(d), { ...dedMap.get(aKey(d)), ...d });
  st.deductions = [...dedMap.values()];

  const dKey = (d: DailyAttendance) => `${d.empId}|${d.date}`;
  const dayMap = new Map(st.dailyAttendance.map((d) => [dKey(d), d]));
  for (const d of imp.daily) {
    const cur = dayMap.get(dKey(d));
    if (cur?.source === "manual") continue; // a mark typed in the app wins
    dayMap.set(dKey(d), { ...d, otHours: d.otHours ?? undefined, unit: d.unit || undefined });
  }
  st.dailyAttendance = [...dayMap.values()];

  for (const e of st.employees) if (e.department && e.department !== "—") e.department = normDept(e.department);

  // ---- report + save ---------------------------------------------------------
  const active = st.employees.filter((e) => e.status !== "Exited").length;
  const cats: Record<string, number> = {};
  for (const e of st.employees) if (e.status !== "Exited") cats[e.category] = (cats[e.category] ?? 0) + 1;
  console.log(JSON.stringify({
    reKeyed: idMap.size, employeesTotal: st.employees.length, active, leftTotal: st.employees.length - active,
    added, addedAsLeft: left, filledMissing: filled, recategorised, attendanceNew: attNew, attendanceUpdated: attUpd,
    attendanceTotal: st.attendance.length, deductions: st.deductions.length, dayMarks: st.dailyAttendance.length,
    activeByCategory: cats, duplicateIds: st.employees.length - new Set(st.employees.map((e) => e.id)).size,
  }, null, 1));
  if (dry) { console.log("DRY RUN — nothing written."); process.exit(0); }
  await repo.saveAll(st);
  console.log("✔ saved to", process.env.DB_HOST);
  process.exit(0);
}
main().catch((e) => { console.error("FAILED:", e); process.exit(1); });

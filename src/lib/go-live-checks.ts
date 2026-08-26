/**
 * Go-live data verification.
 *
 * Everything downstream — salary, PF, ESI, OT, incentives, agent commission —
 * is computed from the master data, and those figures end up on statutory
 * returns. Before the data is frozen for go-live it has to be proved complete
 * and internally consistent, so this runs one pass over the whole state and
 * reports what would break a payroll run or a filing.
 *
 * `blocking` issues must be zero before the data can be confirmed & locked.
 * `warning` issues are worth fixing but don't stop go-live.
 */

import type { HrEmployee } from "@/lib/hr-data";
import type { AttendanceRecord, Advance, MonthlyDeduction } from "@/stores/hr";
import { categoryById } from "@/lib/hr-master";
import { buildPayslip, buildDailyPayslip } from "@/lib/payroll";

export type Severity = "blocking" | "warning";

export interface CheckIssue {
  empId?: string;
  empName?: string;
  detail: string;
}

export interface CheckResult {
  id: string;
  module: string;
  label: string;
  severity: Severity;
  /** What breaks if this isn't fixed — shown to the person doing the data entry. */
  impact: string;
  issues: CheckIssue[];
}

export interface GoLiveReport {
  checks: CheckResult[];
  blocking: number;
  warnings: number;
  employees: number;
  ready: boolean;
}

export interface CheckInput {
  employees: HrEmployee[];
  attendance: AttendanceRecord[];
  advances: Advance[];
  deductions: MonthlyDeduction[];
  month: string; // YYYY-MM
}

const blank = (v?: string | null) => !v || !String(v).trim() || ["—", "-", "na", "n/a", "nil"].includes(String(v).trim().toLowerCase());
const AGENT_CATEGORIES = ["ODISHA", "HOSTEL_BOYS", "HOSTEL_GIRLS", "CASUAL_GENTS", "CASUAL_LADIES"];

function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

/** Employees on the live roll — exited staff aren't part of go-live validation. */
const onRoll = (employees: HrEmployee[]) => employees.filter((e) => e.status !== "Exited");

export function runGoLiveChecks(input: CheckInput): GoLiveReport {
  const emps = onRoll(input.employees);
  const dim = daysInMonth(input.month);
  const checks: CheckResult[] = [];

  const add = (id: string, module: string, label: string, severity: Severity, impact: string, issues: CheckIssue[]) =>
    checks.push({ id, module, label, severity, impact, issues });

  const iss = (e: HrEmployee, detail: string): CheckIssue => ({ empId: e.id, empName: e.name, detail });

  // ---- Identity & statutory numbers ---------------------------------------
  add("aadhaar", "Employees", "Aadhaar number missing", "blocking",
    "Aadhaar is required on every statutory register and for PF/ESI seeding.",
    emps.filter((e) => blank(e.aadhaar)).map((e) => iss(e, "No Aadhaar on file")));

  add("pan-tds", "Statutory", "PAN missing where TDS applies", "blocking",
    "TDS cannot be deducted or filed (Form 24Q) without a PAN.",
    emps.filter((e) => e.tdsApplicable && blank(e.pan)).map((e) => iss(e, "TDS is ticked but PAN is empty")));

  add("uan-pf", "Statutory", "UAN missing where PF applies", "blocking",
    "PF ECR upload rejects a member without a UAN.",
    emps.filter((e) => (e.pfApplicable ?? categoryById(e.category)?.statutory) && blank(e.uan)).map((e) => iss(e, "PF applicable but UAN is empty")));

  add("esi-no", "Statutory", "ESI number missing where ESI applies", "blocking",
    "ESI return needs the insurance number for every covered employee.",
    emps.filter((e) => (e.pfApplicable ?? categoryById(e.category)?.statutory) && e.monthlyGross > 0 && e.monthlyGross <= 21000 && blank(e.esiNo))
      .map((e) => iss(e, "Wage is within the ESI ceiling but ESI no. is empty")));

  // ---- Duplicates — the same person twice corrupts every total -------------
  const dupOn = (label: string, get: (e: HrEmployee) => string | undefined) => {
    const seen = new Map<string, HrEmployee[]>();
    for (const e of emps) {
      const v = (get(e) ?? "").replace(/\s+/g, "").toLowerCase();
      if (!v || blank(v)) continue;
      seen.set(v, [...(seen.get(v) ?? []), e]);
    }
    return [...seen.entries()].filter(([, list]) => list.length > 1)
      .map(([v, list]) => ({ detail: `${label} "${v}" is shared by ${list.length}: ${list.map((x) => `${x.name} (${x.id})`).join(", ")}` }));
  };
  add("dup-aadhaar", "Employees", "Duplicate Aadhaar", "blocking",
    "Two records for one person double-count wages, PF and headcount.",
    dupOn("Aadhaar", (e) => e.aadhaar));
  add("dup-pan", "Employees", "Duplicate PAN", "blocking",
    "A PAN can belong to only one employee; duplicates break TDS filing.",
    dupOn("PAN", (e) => e.pan));
  add("dup-token", "Employees", "Duplicate token / E.No", "blocking",
    "The attendance register is keyed by token — duplicates mis-post attendance.",
    dupOn("Token", (e) => e.tokenNo));
  add("dup-uan", "Statutory", "Duplicate UAN", "blocking",
    "One UAN cannot cover two members in the PF ECR.",
    dupOn("UAN", (e) => e.uan));

  // ---- Pay basis -----------------------------------------------------------
  add("wage", "Payroll", "No wage on record", "blocking",
    "Without a wage the payslip, PF, ESI and OT all compute to zero.",
    emps.filter((e) => (e.wageType === "Monthly" ? !(e.monthlyGross > 0) : !((e.salaryPerDay ?? 0) > 0)))
      .map((e) => iss(e, e.wageType === "Monthly" ? "Monthly gross is zero" : "Wage per day is zero")));

  add("doj", "Employees", "Date of joining missing", "blocking",
    "DOJ drives tenure, gratuity, PF eligibility and the Form-25 register.",
    emps.filter((e) => blank(e.doj)).map((e) => iss(e, "No date of joining")));

  add("bank", "Bank Transfer", "Bank account missing", "blocking",
    "Salary cannot be transferred and the bank file will reject the row.",
    emps.filter((e) => e.salaryStatus !== "On Hold" && blank(e.bankAccount) && !e.bankHistory.some((b) => b.to === "Current" && !blank(b.account)))
      .map((e) => iss(e, "No active bank account")));

  add("category", "Employees", "Worker category missing", "blocking",
    "Category decides statutory cover, wage cycle, mess and incentive rules.",
    emps.filter((e) => !categoryById(e.category)).map((e) => iss(e, `Unknown category "${e.category}"`)));

  // ---- Attendance sanity ---------------------------------------------------
  const attOf = (id: string) => input.attendance.find((a) => a.empId === id && a.month === input.month);

  add("att-missing", "Attendance", "No attendance record for the month", "blocking",
    "Day-wage pay and both incentives are computed from days worked.",
    emps.filter((e) => !attOf(e.id)).map((e) => iss(e, `No attendance row for ${input.month}`)));

  add("att-overflow", "Attendance", "Days worked exceed the month", "blocking",
    `A month has ${dim} days — a higher figure overpays wages and OT.`,
    emps.flatMap((e) => {
      const a = attOf(e.id);
      if (!a) return [];
      if (a.daysWorked > dim) return [iss(e, `${a.daysWorked} days worked in a ${dim}-day month`)];
      if (a.daysWorked + a.absent + a.leave > dim) return [iss(e, `worked ${a.daysWorked} + absent ${a.absent} + leave ${a.leave} = ${a.daysWorked + a.absent + a.leave} > ${dim}`)];
      return [];
    }));

  add("att-saturdays", "Attendance", "Saturdays worked exceed the month's Saturdays", "blocking",
    "Incentive 1 is paid per Saturday — an inflated count overpays it.",
    emps.flatMap((e) => {
      const a = attOf(e.id);
      return a && a.saturdaysWorked > a.totalSaturdays ? [iss(e, `${a.saturdaysWorked} of ${a.totalSaturdays} Saturdays`)] : [];
    }));

  add("att-week-sum", "Attendance", "Week split doesn't add up to days worked", "warning",
    "Weekly wages are paid off the per-week split; a mismatch pays the wrong week.",
    emps.flatMap((e) => {
      const a = attOf(e.id);
      if (!a?.weekDaysWorked?.length) return [];
      const sum = a.weekDaysWorked.reduce((s, d) => s + d, 0);
      return sum !== a.daysWorked ? [iss(e, `weeks sum to ${sum} but days worked is ${a.daysWorked}`)] : [];
    }));

  add("ot-implausible", "Overtime", "Implausible OT hours", "warning",
    "OT is paid at twice the hourly rate — a wrong figure is an expensive error.",
    emps.flatMap((e) => {
      const a = attOf(e.id);
      if (!a) return [];
      const max = Math.max(0, a.daysWorked) * 6; // >6 OT hr/day worked is not credible
      return a.otHours > max && a.otHours > 0 ? [iss(e, `${a.otHours} OT hr against ${a.daysWorked} days worked`)] : [];
    }));

  // ---- Advances & deductions ----------------------------------------------
  add("adv-over", "Advances", "Recovered more than the advance", "blocking",
    "Over-recovery silently under-pays the worker every month.",
    input.advances.filter((a) => a.recovered > a.amount)
      .map((a) => ({ empId: a.empId, empName: a.empName, detail: `recovered ₹${a.recovered} of a ₹${a.amount} advance` })));

  add("adv-orphan", "Advances", "Advance against an unknown employee", "blocking",
    "The recovery can never be applied to a payslip.",
    input.advances.filter((a) => !input.employees.some((e) => e.id === a.empId))
      .map((a) => ({ empId: a.empId, empName: a.empName, detail: `no employee with id ${a.empId}` })));

  add("ded-orphan", "Advances", "Deduction against an unknown employee", "warning",
    "Mess / other deductions won't reach any payslip.",
    input.deductions.filter((d) => !input.employees.some((e) => e.id === d.empId))
      .map((d) => ({ empId: d.empId, detail: `no employee with id ${d.empId}` })));

  // ---- Net pay — the end-to-end proof -------------------------------------
  add("net-negative", "Payroll", "Deductions exceed earnings (negative net pay)", "blocking",
    "A negative payslip cannot be paid or filed — reduce the advance recovery.",
    emps.flatMap((e) => {
      const a = attOf(e.id);
      const ded = input.deductions.find((d) => d.empId === e.id && d.month === input.month);
      const advRec = input.advances.filter((x) => x.empId === e.id && x.status === "Active")
        .reduce((s, x) => s + Math.min(x.monthlyRecovery, x.amount - x.recovered), 0);
      const statutory = e.pfApplicable ?? categoryById(e.category)?.statutory ?? true;
      try {
        if (e.wageType === "Monthly") {
          const p = buildPayslip(e.monthlyGross, e.leave.lopThisMonth, advRec, { pf: statutory, tds: e.tdsApplicable });
          return p.netPay < 0 ? [iss(e, `net ₹${p.netPay} (gross ₹${p.grossEarnings} − deductions ₹${p.totalDeductions})`)] : [];
        }
        const p = buildDailyPayslip({
          ratePerDay: e.salaryPerDay ?? 0, daysWorked: a?.daysWorked ?? 0, otHours: a?.otHours ?? 0,
          saturdaysWorked: a?.saturdaysWorked ?? 0, totalSaturdays: a?.totalSaturdays ?? 4,
          advanceRecovery: advRec, messBill: ded?.mess ?? 0, others: ded?.others ?? 0,
          statutory, tds: e.tdsApplicable,
        });
        return p.netPay < 0 ? [iss(e, `net ₹${p.netPay} (gross ₹${p.grossEarnings} − deductions ₹${p.totalDeductions})`)] : [];
      } catch {
        return [iss(e, "payslip could not be computed from the current data")];
      }
    }));

  // ---- Reporting completeness (warnings) ----------------------------------
  add("unit", "Branches", "No unit / branch allocated", "warning",
    "Per-unit attendance, daily report and AI briefing will miss this worker.",
    emps.filter((e) => blank(e.unit)).map((e) => iss(e, "Company branch is empty")));

  add("father", "Statutory", "Father's / guardian name missing", "warning",
    "Form-25 (Register of Adult Workers) prints this column.",
    emps.filter((e) => blank(e.fatherName)).map((e) => iss(e, "No father's name")));

  add("dept", "Employees", "Department missing", "warning",
    "Department drives the daily report, OT report and shortage detection.",
    emps.filter((e) => blank(e.department)).map((e) => iss(e, "No department")));

  add("token", "Attendance", "Token / E.No missing", "warning",
    "The attendance register and Excel import match workers on token.",
    emps.filter((e) => blank(e.tokenNo)).map((e) => iss(e, "No token number")));

  add("agent", "Agents", "Agent-supplied worker with no agent", "warning",
    "Agent commission cannot be attributed or paid for this worker.",
    emps.filter((e) => AGENT_CATEGORIES.includes(e.category) && blank(e.agentId)).map((e) => iss(e, `${categoryById(e.category)?.label} with no agent linked`)));

  add("salary-status", "Payroll", "Salary still Pending / On Hold", "warning",
    "These workers are excluded from the bank transfer until cleared.",
    emps.filter((e) => e.salaryStatus && e.salaryStatus !== "Paid")
      .map((e) => iss(e, `${e.salaryStatus}${e.salaryStatusReason ? ` — ${e.salaryStatusReason}` : ""}`)));

  add("shift", "Attendance", "No shift assigned", "warning",
    "The register prints a blank shift and the daily report can't bucket them.",
    emps.filter((e) => blank(e.shiftId)).map((e) => iss(e, "No shift")));

  const withIssues = checks.filter((c) => c.issues.length > 0);
  const blocking = withIssues.filter((c) => c.severity === "blocking").reduce((s, c) => s + c.issues.length, 0);
  const warnings = withIssues.filter((c) => c.severity === "warning").reduce((s, c) => s + c.issues.length, 0);

  return { checks, blocking, warnings, employees: emps.length, ready: blocking === 0 };
}

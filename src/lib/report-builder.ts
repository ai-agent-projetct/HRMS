/**
 * Custom report builder.
 *
 * Admin/CEO pick columns and a scope in the UI; a report is stored as a list of
 * field keys plus a scope, and runs against live data — so a report created once
 * always reflects today's figures. Every field here is derived from the same
 * functions the rest of the app uses, so a custom report can never disagree with
 * the module it came from.
 */

import type { HrEmployee } from "@/lib/hr-data";
import { tenure, totalExperience } from "@/lib/hr-data";
import type { AttendanceRecord, Advance, MonthlyDeduction, CustomReport } from "@/stores/hr";
import { attendanceFor, deductionFor, outstandingAdvance, advanceRecoveryFor } from "@/stores/hr";
import { categoryById, shiftById, agentById, computeIncentives, otRatePerHour } from "@/lib/hr-master";
import { buildPayslip, buildDailyPayslip } from "@/lib/payroll";

export interface ReportField {
  key: string;
  label: string;
  group: "Profile" | "Job" | "Statutory" | "Bank" | "Attendance" | "Pay";
  numeric?: boolean;
}

/** Everything a report can show. Grouped for the picker. */
export const REPORT_FIELDS: ReportField[] = [
  { key: "id", label: "Emp ID", group: "Profile" },
  { key: "tokenNo", label: "Token / E.No", group: "Profile" },
  { key: "name", label: "Name", group: "Profile" },
  { key: "fatherName", label: "Father's Name", group: "Profile" },
  { key: "gender", label: "Gender", group: "Profile" },
  { key: "dob", label: "Date of Birth", group: "Profile" },
  { key: "bloodGroup", label: "Blood Group", group: "Profile" },
  { key: "phone", label: "Phone", group: "Profile" },
  { key: "address", label: "Address", group: "Profile" },
  { key: "location", label: "Location", group: "Profile" },

  { key: "category", label: "Category", group: "Job" },
  { key: "unit", label: "Unit / Branch", group: "Job" },
  { key: "department", label: "Department", group: "Job" },
  { key: "section", label: "Section", group: "Job" },
  { key: "role", label: "Role", group: "Job" },
  { key: "grade", label: "Grade", group: "Job" },
  { key: "shift", label: "Shift", group: "Job" },
  { key: "agent", label: "Agent", group: "Job" },
  { key: "conduct", label: "Conduct", group: "Job" },
  { key: "status", label: "Status", group: "Job" },
  { key: "doj", label: "Date of Joining", group: "Job" },
  { key: "tenure", label: "Tenure", group: "Job" },
  { key: "totalExp", label: "Total Experience (yrs)", group: "Job", numeric: true },

  { key: "aadhaar", label: "Aadhaar", group: "Statutory" },
  { key: "pan", label: "PAN", group: "Statutory" },
  { key: "uan", label: "UAN (PF)", group: "Statutory" },
  { key: "esiNo", label: "ESI No", group: "Statutory" },
  { key: "pfApplicable", label: "PF/ESI Applicable", group: "Statutory" },
  { key: "tdsApplicable", label: "TDS Applicable", group: "Statutory" },

  { key: "bankName", label: "Bank", group: "Bank" },
  { key: "bankBranch", label: "Branch", group: "Bank" },
  { key: "bankAccount", label: "Account No", group: "Bank" },
  { key: "bankIfsc", label: "IFSC", group: "Bank" },

  { key: "daysWorked", label: "Days Worked", group: "Attendance", numeric: true },
  { key: "halfDays", label: "Half Days", group: "Attendance", numeric: true },
  { key: "saturdays", label: "Saturdays Worked", group: "Attendance" },
  { key: "absent", label: "Absent", group: "Attendance", numeric: true },
  { key: "leaveDays", label: "Leave", group: "Attendance", numeric: true },
  { key: "lop", label: "LOP", group: "Attendance", numeric: true },
  { key: "otHours", label: "OT Hours", group: "Attendance", numeric: true },

  { key: "wageType", label: "Wage Type", group: "Pay" },
  { key: "monthlyGross", label: "Monthly Gross", group: "Pay", numeric: true },
  { key: "salaryPerDay", label: "Wage / Day", group: "Pay", numeric: true },
  { key: "otRate", label: "OT Rate / Hr", group: "Pay", numeric: true },
  { key: "otAmount", label: "OT Wages", group: "Pay", numeric: true },
  { key: "inc1", label: "Incentive 1", group: "Pay", numeric: true },
  { key: "inc2", label: "Incentive 2", group: "Pay", numeric: true },
  { key: "gross", label: "Gross Earnings", group: "Pay", numeric: true },
  { key: "pf", label: "PF", group: "Pay", numeric: true },
  { key: "esi", label: "ESI", group: "Pay", numeric: true },
  { key: "advOutstanding", label: "Advance Outstanding", group: "Pay", numeric: true },
  { key: "advRecovery", label: "Advance Recovery", group: "Pay", numeric: true },
  { key: "mess", label: "Mess Bill", group: "Pay", numeric: true },
  { key: "otherDed", label: "Other Deductions", group: "Pay", numeric: true },
  { key: "totalDed", label: "Total Deductions", group: "Pay", numeric: true },
  { key: "net", label: "Net Pay", group: "Pay", numeric: true },
  { key: "salaryStatus", label: "Salary Status", group: "Pay" },
];

export const fieldByKey = (k: string) => REPORT_FIELDS.find((f) => f.key === k);

export interface ReportContext {
  employees: HrEmployee[];
  attendance: AttendanceRecord[];
  advances: Advance[];
  deductions: MonthlyDeduction[];
}

/** Which employees a report covers. */
export function scopeEmployees(report: CustomReport, employees: HrEmployee[]): HrEmployee[] {
  switch (report.scope) {
    case "category": return employees.filter((e) => report.scopeValues.includes(e.category));
    case "unit": return employees.filter((e) => report.scopeValues.includes(e.unit ?? ""));
    case "department": return employees.filter((e) => report.scopeValues.includes(e.department));
    case "employees": return employees.filter((e) => report.scopeValues.includes(e.id));
    default: return employees;
  }
}

/** Compute every field for one employee. Values are already display-ready. */
function valuesFor(e: HrEmployee, ctx: ReportContext): Record<string, string | number> {
  const a = attendanceFor(ctx.attendance, e.id);
  const d = deductionFor(ctx.deductions, e.id);
  const advRec = advanceRecoveryFor(ctx.advances, e.id);
  const statutory = e.pfApplicable ?? categoryById(e.category)?.statutory ?? true;
  const inc = computeIncentives(a?.saturdaysWorked ?? 0, a?.totalSaturdays ?? 4, a?.daysWorked ?? 0);
  const otRate = otRatePerHour(e.salaryPerDay, e.monthlyGross);

  const slip = e.wageType === "Monthly"
    ? buildPayslip(e.monthlyGross, a?.lop ?? e.leave.lopThisMonth, advRec, { pf: statutory, tds: e.tdsApplicable })
    : buildDailyPayslip({
        ratePerDay: e.salaryPerDay ?? 0, daysWorked: a?.daysWorked ?? 0, otHours: a?.otHours ?? 0,
        saturdaysWorked: a?.saturdaysWorked ?? 0, totalSaturdays: a?.totalSaturdays ?? 4,
        advanceRecovery: advRec, messBill: d.mess, others: d.others, statutory, tds: e.tdsApplicable,
      });
  const ded = (m: string) => slip.deductions.find((x) => x.label.includes(m))?.amount ?? 0;

  return {
    id: e.id, tokenNo: e.tokenNo ?? "", name: e.name, fatherName: e.fatherName ?? "",
    gender: e.gender, dob: e.dob, bloodGroup: e.bloodGroup, phone: e.phone,
    address: e.address, location: e.location ?? "",

    category: categoryById(e.category)?.label ?? e.category,
    unit: e.unit ?? "", department: e.department, section: e.section ?? "",
    role: e.role, grade: e.grade, shift: shiftById(e.shiftId)?.code ?? "",
    agent: agentById(e.agentId)?.name ?? "", conduct: e.conduct, status: e.status,
    doj: e.doj, tenure: tenure(e.doj).label, totalExp: totalExperience(e),

    aadhaar: e.aadhaar, pan: e.pan, uan: e.uan, esiNo: e.esiNo,
    pfApplicable: statutory ? "Yes" : "No", tdsApplicable: e.tdsApplicable ? "Yes" : "No",

    bankName: e.bankName ?? "", bankBranch: e.bankBranch ?? "",
    bankAccount: e.bankAccount ?? "", bankIfsc: e.bankIfsc ?? "",

    daysWorked: a?.daysWorked ?? 0, halfDays: a?.halfDays ?? 0,
    saturdays: `${a?.saturdaysWorked ?? 0}/${a?.totalSaturdays ?? 4}`,
    absent: a?.absent ?? 0, leaveDays: a?.leave ?? 0, lop: a?.lop ?? 0, otHours: a?.otHours ?? 0,

    wageType: e.wageType, monthlyGross: e.monthlyGross, salaryPerDay: e.salaryPerDay ?? 0,
    otRate, otAmount: otRate * (a?.otHours ?? 0),
    inc1: inc.inc1Amount, inc2: inc.inc2Amount,
    gross: slip.grossEarnings, pf: ded("PF"), esi: ded("ESI"),
    advOutstanding: outstandingAdvance(ctx.advances, e.id), advRecovery: advRec,
    mess: d.mess, otherDed: d.others,
    totalDed: slip.totalDeductions, net: slip.netPay,
    salaryStatus: e.salaryStatus ?? "Paid",
  };
}

export interface ReportResult {
  columns: ReportField[];
  rows: Record<string, string | number>[];
  totals: Record<string, number>;
  count: number;
}

export function runReport(report: CustomReport, ctx: ReportContext): ReportResult {
  const columns = report.fields.map(fieldByKey).filter(Boolean) as ReportField[];
  const emps = scopeEmployees(report, ctx.employees);
  const rows = emps.map((e) => {
    const all = valuesFor(e, ctx);
    return Object.fromEntries(columns.map((c) => [c.key, all[c.key] ?? ""]));
  });
  const totals: Record<string, number> = {};
  for (const c of columns.filter((c) => c.numeric)) {
    totals[c.key] = rows.reduce((s, r) => s + (typeof r[c.key] === "number" ? (r[c.key] as number) : 0), 0);
  }
  return { columns, rows, totals, count: rows.length };
}

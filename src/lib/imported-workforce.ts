/**
 * Maps the real workforce imported from the company payroll workbook
 * (imported-raw.ts) into full HrEmployee records, carrying each person's
 * actual wage-statement figures so downloads reproduce the source exactly.
 */

import { IMPORTED_RAW, type ImportedRaw } from "@/lib/imported-raw";
import type { HrEmployee, EmpStatement } from "@/lib/hr-data";
import type { WorkerCategoryId } from "@/lib/hr-master";

const CAT: Record<string, WorkerCategoryId> = {
  STAFF: "STAFF", ODISHA: "ODISHA", HOSTEL_GIRLS: "HOSTEL_GIRLS", CASUAL_LADIES: "CASUAL_LADIES",
};

function build(r: ImportedRaw): HrEmployee {
  const monthly = r.monthlyGross ?? Math.round((r.salaryPerDay ?? 0) * 26);
  const statement = r.st as EmpStatement;
  return {
    id: r.id, salutation: r.gender === "Female" ? "Ms." : "Mr.", name: r.name, gender: r.gender,
    dob: "1990-01-01", bloodGroup: "—",
    role: r.cat === "STAFF" ? "Staff" : r.cat === "ODISHA" ? "Machine Operator" : "Helper / Labour",
    department: r.dept || "General", section: undefined, grade: "W1", reportsTo: "—",
    employmentType: "Experienced", status: "Active", doj: r.doj, prevExpYears: 1, prevExpDetail: "—",
    phone: "—", altPhone: "—", email: "—", address: "—", emergencyContact: "—",
    qualification: "—", institution: "—", passYear: 0,
    aadhaar: "—", pan: "—", uan: r.uan, esiNo: r.esi,
    monthlyGross: monthly, ctc: monthly * 12,
    wageType: r.wage, category: CAT[r.cat] ?? "PERMANENT",
    shiftId: r.wage === "Monthly" ? "SH-G" : "SH-A",
    salaryPerDay: r.salaryPerDay, conduct: "Proper",
    pfApplicable: (statement.pf ?? 0) > 0 || (statement.esi ?? 0) > 0,
    tdsApplicable: false,
    tokenNo: r.token, deptCode: r.dept, pfCode: r.esi && r.esi !== "—" ? `TN/SL/35086/${r.token}` : `TN/SL/35086/`,
    statement,
    documents: [], salaryHistory: [{ fy: "2025-26", monthlyGross: monthly, annualPaid: 0, bank: "—", account: "—", creditedDay: "7th of month" }],
    bankHistory: [], leave: { el: 0, cl: 0, sl: 0, lopThisMonth: 0 },
    health: r.gender === "Female"
      ? { heightCm: 156, weightKg: 52, hemoglobin: 12, lastCheckup: "2026-03-01" }
      : { heightCm: 168, weightKg: 64, hemoglobin: 14, lastCheckup: "2026-03-01" },
  };
}

export const IMPORTED_EMPLOYEES: HrEmployee[] = IMPORTED_RAW.map(build);

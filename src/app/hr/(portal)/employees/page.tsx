"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { FormModal } from "@/components/form-modal";
import { useToast } from "@/components/ui/toast";
import { downloadExcel } from "@/lib/excel";
import { GARMENT_ROLES, roleGroup, tenure, totalExperience, type HrEmployee } from "@/lib/hr-data";
import { WORKER_CATEGORIES, SHIFTS, categoryById, type WorkerCategoryId } from "@/lib/hr-master";
import { useHr } from "@/stores/hr";
import { formatINR } from "@/lib/utils";
import { Users, Briefcase, GraduationCap, UserPlus, FileSpreadsheet, ChevronRight } from "lucide-react";

export default function EmployeesPage() {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("All");
  const [addOpen, setAddOpen] = useState(false);
  const employees = useHr((s) => s.employees);
  const push = useToast((s) => s.push);

  const filtered = employees.filter((e) => {
    if (group !== "All" && roleGroup(e.role) !== group) return false;
    return `${e.name} ${e.id} ${e.role} ${e.department}`.toLowerCase().includes(q.toLowerCase());
  });

  const exportDirectory = () =>
    downloadExcel({
      filename: "employee-directory",
      sheetName: "Employees",
      title: "Employee Directory",
      columns: [
        { header: "Emp ID", key: "id" }, { header: "Name", key: "name", width: 20 }, { header: "Role", key: "role", width: 20 },
        { header: "Department", key: "department", width: 18 }, { header: "Type", key: "employmentType" }, { header: "Status", key: "status" },
        { header: "DOJ", key: "doj" }, { header: "Tenure", key: "tenure" }, { header: "Prev Exp (yrs)", key: "prevExpYears" },
        { header: "Total Exp (yrs)", key: "totalExp" }, { header: "Phone", key: "phone" }, { header: "Monthly Gross ₹", key: "monthlyGross" },
        { header: "PAN", key: "pan" }, { header: "UAN (PF)", key: "uan" },
      ],
      rows: employees.map((e) => ({ ...e, tenure: tenure(e.doj).label, totalExp: totalExperience(e) })),
    });

  return (
    <>
      <PageHeader
        title="Employees"
        description="Full employee master — profile, documents, salary & bank history, PF/ESI/TDS and tenure"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportDirectory}><FileSpreadsheet className="h-4 w-4" /> Export</Button>
            <Button size="sm" onClick={() => setAddOpen(true)}><UserPlus className="h-4 w-4" /> Add employee</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Headcount" value={`${employees.length}`} icon={Users} sub={`${employees.filter((e) => e.employmentType === "Experienced").length} exp · ${employees.filter((e) => e.employmentType === "Fresher").length} fresher`} />
        <KpiCard label="Roles" value={`${new Set(employees.map((e) => e.role)).size}`} icon={Briefcase} sub="across garment & textile" tone="info" />
        <KpiCard label="Avg Tenure" value={`${(employees.reduce((s, e) => s + tenure(e.doj).totalDays, 0) / employees.length / 365).toFixed(1)} yrs`} icon={GraduationCap} sub="across the mill" tone="success" />
        <KpiCard label="On Probation" value={`${employees.filter((e) => e.status === "Probation").length}`} icon={UserPlus} sub="confirmation pending" tone="warning" />
      </div>

      <Card>
        <CardContent className="py-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {["All", "Management", "Supervisor", "Staff", "Worker", "Support"].map((g) => (
                <Button key={g} variant={group === g ? "default" : "outline"} size="sm" className="h-7 px-2.5 text-[11px]" onClick={() => setGroup(g)}>{g}</Button>
              ))}
            </div>
            <Input placeholder="Search name, ID, role…" value={q} onChange={(e) => setQ(e.target.value)} className="w-60" />
          </div>
          <Table>
            <THead>
              <TR>
                <TH>Emp ID</TH><TH>Name</TH><TH>Role</TH><TH>Category</TH><TH>Wage</TH>
                <TH>Tenure</TH><TH className="text-right">Total Exp</TH><TH>Status</TH><TH></TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((e) => (
                <TR key={e.id}>
                  <TD className="font-mono text-xs text-muted-foreground">{e.id}</TD>
                  <TD className="font-medium">{e.name}</TD>
                  <TD>{e.role}</TD>
                  <TD><Badge tone="muted">{categoryById(e.category)?.label ?? e.category}</Badge></TD>
                  <TD><Badge tone={e.wageType === "Daily" ? "warning" : "info"}>{e.wageType === "Daily" ? `₹${e.salaryPerDay}/day` : "Monthly"}</Badge></TD>
                  <TD>{tenure(e.doj).label}</TD>
                  <TD className="text-right">{totalExperience(e)} yrs</TD>
                  <TD><Badge tone={e.status === "Active" ? "success" : e.status === "Probation" ? "warning" : e.status === "On Notice" ? "danger" : "muted"}>{e.status}</Badge></TD>
                  <TD>
                    <Link href={`/hr/employee/${e.id}`}>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]">View <ChevronRight className="h-3 w-3" /></Button>
                    </Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {filtered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No employees match.</p>}
        </CardContent>
      </Card>

      {addOpen && (
        <FormModal
          title="Add employee"
          description="Creates the master record; documents & bank details are captured on the profile."
          submitLabel="Add employee"
          onClose={() => setAddOpen(false)}
          fields={[
            { name: "name", label: "Full name", required: true },
            { name: "gender", label: "Gender", type: "select", options: ["Male", "Female"] },
            { name: "category", label: "Worker category", type: "select", options: WORKER_CATEGORIES.map((c) => c.label), required: true },
            { name: "role", label: "Role", type: "select", options: [...GARMENT_ROLES], required: true },
            { name: "department", label: "Department / section", required: true },
            { name: "shift", label: "Shift", type: "select", options: SHIFTS.map((s) => `${s.code} — ${s.name} (${s.time})`) },
            { name: "type", label: "Employment type", type: "select", options: ["Fresher", "Experienced"] },
            { name: "doj", label: "Date of joining", type: "date", required: true, defaultValue: "2026-07-25" },
            { name: "wage", label: "Pay amount (₹)", type: "number", required: true, placeholder: "Monthly gross or per-day rate" },
            { name: "phone", label: "Phone", required: true },
          ]}
          onSubmit={(v) => {
            const n = 900 + employees.length;
            const id = `EMP-${String(n).padStart(4, "0")}`;
            const cat = WORKER_CATEGORIES.find((c) => c.label === v.category)!;
            const catId = cat.id as WorkerCategoryId;
            const shiftId = SHIFTS.find((s) => v.shift?.startsWith(s.code))?.id ?? "SH-G";
            const isDaily = cat.wageType === "Daily";
            const monthly = isDaily ? Number(v.wage) * 26 : Number(v.wage);
            const emp: HrEmployee = {
              id, salutation: v.gender === "Female" ? "Ms." : "Mr.", name: v.name, gender: (v.gender as "Male" | "Female") ?? "Male", dob: "1995-01-01", bloodGroup: "—",
              role: v.role as HrEmployee["role"], department: v.department, grade: "W1", reportsTo: "—",
              employmentType: v.type as HrEmployee["employmentType"], status: "Probation", doj: v.doj,
              prevExpYears: v.type === "Fresher" ? 0 : 1, prevExpDetail: v.type === "Fresher" ? "Fresher" : "Prior experience — to verify",
              phone: v.phone, altPhone: "—", email: `${v.name.toLowerCase().replace(/[^a-z]/g, ".")}@bharattex.in`,
              address: "—", emergencyContact: "—", qualification: "—", institution: "—", passYear: 2020,
              aadhaar: "—", pan: "—", uan: "—", esiNo: "—", monthlyGross: monthly, ctc: monthly * 13,
              wageType: cat.wageType, category: catId, shiftId, salaryPerDay: isDaily ? Number(v.wage) : undefined, conduct: "Proper",
              health: { heightCm: undefined, weightKg: undefined },
              documents: [{ type: "Aadhaar", number: "—", submitted: false, verified: false }, { type: "PAN", number: "—", submitted: false, verified: false }],
              salaryHistory: [{ fy: "2026-27", monthlyGross: monthly, annualPaid: 0, bank: "—", account: "—", creditedDay: "1st of month" }],
              bankHistory: [], leave: { el: 0, cl: 0, sl: 0, lopThisMonth: 0 },
            };
            useHr.setState((s) => ({ employees: [...s.employees, emp] }));
            push(`${v.name} added — ${id}`, `${categoryById(catId)?.label} · ${v.role}. Onboarding started.`);
          }}
        />
      )}
    </>
  );
}

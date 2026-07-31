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
import { AddEmployeeModal } from "@/components/add-employee-modal";
import { FormModal } from "@/components/form-modal";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { downloadExcel } from "@/lib/excel";
import { roleGroup, tenure, totalExperience, type HrEmployee } from "@/lib/hr-data";
import { categoryById } from "@/lib/hr-master";
import { useHr } from "@/stores/hr";
import { formatINR } from "@/lib/utils";
import { Users, Briefcase, GraduationCap, UserPlus, FileSpreadsheet, ChevronRight, Trash2 } from "lucide-react";

const salaryTone = (s?: string) => (s === "Pending" ? "warning" : s === "On Hold" ? "danger" : "success");

export default function EmployeesPage() {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("All");
  const [addOpen, setAddOpen] = useState(false);
  const [salaryEdit, setSalaryEdit] = useState<HrEmployee | null>(null);
  const [delEmp, setDelEmp] = useState<HrEmployee | null>(null);
  const employees = useHr((s) => s.employees);
  const setSalaryStatus = useHr((s) => s.setSalaryStatus);
  const deleteEmployee = useHr((s) => s.deleteEmployee);
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
                <TH>Salary status</TH><TH>Tenure</TH><TH>Status</TH><TH></TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((e) => (
                <TR key={e.id}>
                  <TD className="font-mono text-xs text-muted-foreground">{e.id}</TD>
                  <TD className="font-medium">{e.name}</TD>
                  <TD>{e.role}</TD>
                  <TD><Badge tone="muted">{e.category === "MC_OTHERS" && e.categoryOther ? e.categoryOther : categoryById(e.category)?.label ?? e.category}</Badge></TD>
                  <TD><Badge tone={e.wageType === "Monthly" ? "info" : "warning"}>{e.wageType === "Monthly" ? "Monthly" : `₹${e.salaryPerDay}/day`}</Badge></TD>
                  <TD>
                    <button onClick={() => setSalaryEdit(e)} className="text-left" title="Click to update salary status">
                      <Badge tone={salaryTone(e.salaryStatus)}>{e.salaryStatus ?? "Paid"}</Badge>
                      {e.salaryStatus && e.salaryStatus !== "Paid" && e.salaryStatusReason && (
                        <div className="mt-0.5 max-w-[160px] truncate text-[10px] text-muted-foreground" title={e.salaryStatusReason}>{e.salaryStatusReason}</div>
                      )}
                    </button>
                  </TD>
                  <TD>{tenure(e.doj).label}</TD>
                  <TD><Badge tone={e.status === "Active" ? "success" : e.status === "Probation" ? "warning" : e.status === "On Notice" ? "danger" : "muted"}>{e.status}</Badge></TD>
                  <TD>
                    <div className="flex items-center gap-1.5">
                      <Link href={`/hr/employee/${e.id}`}>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]">View <ChevronRight className="h-3 w-3" /></Button>
                      </Link>
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-danger" title="Delete (move to recycle bin)" onClick={() => setDelEmp(e)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {filtered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No employees match.</p>}
        </CardContent>
      </Card>

      {addOpen && (
        <AddEmployeeModal
          nextIndex={employees.length}
          onClose={() => setAddOpen(false)}
          onSubmit={(emp) => {
            useHr.setState((s) => ({ employees: [...s.employees, emp] }));
            push(`${emp.name} added — ${emp.id}`, `${emp.categoryOther ?? categoryById(emp.category)?.label} · ${emp.role}. Onboarding started.`);
          }}
        />
      )}

      {salaryEdit && (
        <FormModal
          title={`Salary status — ${salaryEdit.name}`}
          description="Set the current salary status. A reason is required when it is Pending or On Hold."
          submitLabel="Update status"
          onClose={() => setSalaryEdit(null)}
          fields={[
            { name: "status", label: "Current salary status", type: "select", options: ["Paid", "Pending", "On Hold"], defaultValue: salaryEdit.salaryStatus ?? "Paid" },
            { name: "reason", label: "Reason (if pending / on hold)", type: "textarea", defaultValue: salaryEdit.salaryStatusReason ?? "", placeholder: "e.g. Bank details pending, attendance shortfall…" },
          ]}
          onSubmit={(v) => {
            if (v.status !== "Paid" && !v.reason.trim()) return "Please enter a reason for a Pending / On Hold status.";
            setSalaryStatus(salaryEdit.id, v.status as NonNullable<HrEmployee["salaryStatus"]>, v.reason.trim());
            push(`Salary status updated — ${salaryEdit.name}`, v.status === "Paid" ? "Marked as Paid." : `${v.status}: ${v.reason.trim()}`);
          }}
        />
      )}

      {delEmp && (
        <Modal title={`Delete ${delEmp.name}?`} description="Moves the employee to Deleted Items (restorable). Permanent deletion is CEO/Admin only." onClose={() => setDelEmp(null)}>
          <div className="space-y-4">
            <p className="rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">{delEmp.name} ({delEmp.id}) will be removed from the active workforce and placed in the recycle bin.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDelEmp(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => { deleteEmployee(delEmp.id); push(`${delEmp.name} deleted`, "Moved to Deleted Items — restore any time."); setDelEmp(null); }}><Trash2 className="h-4 w-4" /> Move to recycle bin</Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

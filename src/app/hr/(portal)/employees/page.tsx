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
import { EmployeeImportModal } from "@/components/employee-import-modal";
import { EmployeeExitModal, ExitDetails } from "@/components/employee-exit-modal";
import { FormModal } from "@/components/form-modal";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { downloadExcel } from "@/lib/excel";
import { EMPLOYEE_COLUMNS, employeeToRow } from "@/lib/employee-io";
import { roleGroup, tenure, type HrEmployee } from "@/lib/hr-data";
import { categoryById, agentById } from "@/lib/hr-master";
import { useHr, canImportData, canManageExits, useCanEdit } from "@/stores/hr";
import { Users, Briefcase, GraduationCap, UserPlus, FileSpreadsheet, FileUp, ChevronRight, Trash2, LogOut, RotateCcw } from "lucide-react";

const salaryTone = (s?: string) => (s === "Pending" ? "warning" : s === "On Hold" ? "danger" : "success");

export default function EmployeesPage() {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("All");
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [salaryEdit, setSalaryEdit] = useState<HrEmployee | null>(null);
  const [delEmp, setDelEmp] = useState<HrEmployee | null>(null);
  const [exitEmp, setExitEmp] = useState<{ e: HrEmployee; mode: "leave" | "rejoin" } | null>(null);
  const [exitView, setExitView] = useState<HrEmployee | null>(null);
  const [statusFilter, setStatusFilter] = useState<"All" | "On roll" | "Left">("All");
  const employees = useHr((s) => s.employees);
  const setSalaryStatus = useHr((s) => s.setSalaryStatus);
  const deleteEmployee = useHr((s) => s.deleteEmployee);
  const importEmployees = useHr((s) => s.importEmployees);
  const user = useHr((s) => s.user);
  const mayEdit = useCanEdit();
  const mayImport = canImportData(user?.role) && mayEdit;
  const mayExit = canManageExits(user?.role);
  const push = useToast((s) => s.push);

  const filtered = employees.filter((e) => {
    if (group !== "All" && roleGroup(e.role) !== group) return false;
    if (statusFilter === "On roll" && e.status === "Exited") return false;
    if (statusFilter === "Left" && e.status !== "Exited") return false;
    return `${e.name} ${e.id} ${e.role} ${e.department} ${agentById(e.agentId)?.name ?? ""}`.toLowerCase().includes(q.toLowerCase());
  });

  // Full employee master export — same columns the bulk import reads, so the file round-trips.
  const exportDirectory = () =>
    downloadExcel({
      filename: "employee-directory",
      sheetName: "Employees",
      title: "Employee Directory",
      columns: EMPLOYEE_COLUMNS,
      rows: employees.map(employeeToRow),
    });

  return (
    <>
      <PageHeader
        title="Employees"
        description="Full employee master — profile, documents, salary & bank history, PF/ESI/TDS and tenure"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportDirectory}><FileSpreadsheet className="h-4 w-4" /> Export</Button>
            {mayImport && (
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><FileUp className="h-4 w-4" /> Import</Button>
            )}
            {mayEdit && <Button size="sm" onClick={() => setAddOpen(true)}><UserPlus className="h-4 w-4" /> Add employee</Button>}
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
              <span className="mx-1 h-5 w-px bg-border" />
              {(["All", "On roll", "Left"] as const).map((sf) => (
                <Button key={sf} variant={statusFilter === sf ? "default" : "outline"} size="sm" className="h-7 px-2.5 text-[11px]" onClick={() => setStatusFilter(sf)}>
                  {sf}{sf === "Left" ? ` (${employees.filter((e) => e.status === "Exited").length})` : ""}
                </Button>
              ))}
            </div>
            <Input placeholder="Search name, ID, role…" value={q} onChange={(e) => setQ(e.target.value)} className="w-60" />
          </div>
          <Table>
            <THead>
              <TR>
                <TH>Emp ID</TH><TH>Name</TH><TH>Role</TH><TH>Category</TH><TH>Agent</TH><TH>Wage</TH>
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
                  <TD className="text-xs">{agentById(e.agentId)?.name ?? <span className="text-muted-foreground">Direct hire</span>}</TD>
                  <TD><Badge tone={e.wageType === "Monthly" ? "info" : "warning"}>{e.wageType === "Monthly" ? "Monthly" : `₹${e.salaryPerDay}/day`}</Badge></TD>
                  <TD>
                    <button onClick={() => mayEdit && setSalaryEdit(e)} disabled={!mayEdit} className="text-left disabled:cursor-default" title={mayEdit ? "Click to update salary status" : "Data locked — CEO / Super Admin only"}>
                      <Badge tone={salaryTone(e.salaryStatus)}>{e.salaryStatus ?? "Paid"}</Badge>
                      {e.salaryStatus && e.salaryStatus !== "Paid" && e.salaryStatusReason && (
                        <div className="mt-0.5 max-w-[160px] truncate text-[10px] text-muted-foreground" title={e.salaryStatusReason}>{e.salaryStatusReason}</div>
                      )}
                    </button>
                  </TD>
                  <TD>{tenure(e.doj).label}</TD>
                  <TD>
                    {e.status === "Exited" ? (
                      <button onClick={() => setExitView(e)} className="text-left" title="Show full exit details">
                        <Badge tone="danger"><LogOut className="h-3 w-3" /> Left</Badge>
                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                          {e.exit ? `${e.exit.reason} · ` : ""}
                          {e.exit?.settled
                            ? <span className="text-success">settled</span>
                            : <span className="font-semibold text-danger">settlement pending</span>}
                        </div>
                      </button>
                    ) : (
                      <Badge tone={e.status === "Active" ? "success" : e.status === "Probation" ? "warning" : "danger"}>{e.status}</Badge>
                    )}
                  </TD>
                  <TD>
                    <div className="flex items-center gap-1.5">
                      <Link href={`/hr/employee/${e.id}`}>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]">View <ChevronRight className="h-3 w-3" /></Button>
                      </Link>
                      {mayExit && (e.status === "Exited"
                        ? <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] text-info" title="Record a re-join" onClick={() => setExitEmp({ e, mode: "rejoin" })}><RotateCcw className="h-3 w-3" /> Re-join</Button>
                        : <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] text-danger" title="Mark as left" onClick={() => setExitEmp({ e, mode: "leave" })}><LogOut className="h-3 w-3" /> Left</Button>)}
                      {mayEdit && <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-danger" title="Delete (move to recycle bin)" onClick={() => setDelEmp(e)}><Trash2 className="h-3.5 w-3.5" /></Button>}
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

      {importOpen && mayImport && (
        <EmployeeImportModal
          employees={employees}
          onClose={() => setImportOpen(false)}
          onApply={(emps) => {
            const { added, updated } = importEmployees(emps);
            push(`Imported ${emps.length} employees`, `${added} added · ${updated} updated from Excel.`);
            return { added, updated };
          }}
        />
      )}

      {exitEmp && (
        <EmployeeExitModal
          employee={exitEmp.e}
          mode={exitEmp.mode}
          onClose={() => {
            push(exitEmp.mode === "leave" ? `${exitEmp.e.name} marked as left` : `${exitEmp.e.name} re-joined`,
              exitEmp.mode === "leave" ? "Recorded in the on-roll movement ledger and the audit log." : "Back on the roll as Active; logged as a Re-join.");
            setExitEmp(null);
          }}
        />
      )}

      {exitView && (
        <Modal title={`Exit details — ${exitView.name}`} description={`${exitView.id} · ${exitView.role} · ${exitView.department}`} onClose={() => setExitView(null)} wide>
          <div className="space-y-3">
            <ExitDetails e={exitView} />
            {(exitView.rejoins ?? []).length > 0 && (
              <div className="rounded-lg border p-3">
                <p className="mb-1.5 text-xs font-bold">Previous re-joins ({exitView.rejoins!.length})</p>
                {exitView.rejoins!.map((r, i) => (
                  <p key={i} className="text-[11px] text-muted-foreground">
                    Re-joined {r.rejoinDate}{r.previousExitDate ? ` (after leaving ${r.previousExitDate})` : ""}{r.note ? ` — ${r.note}` : ""}
                  </p>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="outline" onClick={() => setExitView(null)}>Close</Button>
              <Link href={`/hr/employee/${exitView.id}`}><Button variant="outline">Open record <ChevronRight className="h-3.5 w-3.5" /></Button></Link>
              <Link href="/hr/settlement"><Button>Full &amp; Final Settlement</Button></Link>
              {mayExit && <Button variant="outline" onClick={() => { setExitEmp({ e: exitView, mode: "rejoin" }); setExitView(null); }}><RotateCcw className="h-4 w-4" /> Re-join</Button>}
            </div>
          </div>
        </Modal>
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

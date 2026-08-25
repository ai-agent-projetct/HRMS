"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useHr, canManageUnits } from "@/stores/hr";
import { categoryById } from "@/lib/hr-master";
import { Building2, ChevronRight, Plus, Pencil, Check, X, Users } from "lucide-react";

const UNASSIGNED = "__unassigned__";

/**
 * Branch/unit explorer — click a unit to see only the employees allocated to it,
 * in the same format as the Employees table. Admin/CEO can create and rename units.
 */
export function BranchExplorer({ compact = false }: { compact?: boolean }) {
  const employees = useHr((s) => s.employees);
  const units = useHr((s) => s.units);
  const user = useHr((s) => s.user);
  const addUnit = useHr((s) => s.addUnit);
  const renameUnit = useHr((s) => s.renameUnit);
  const push = useToast((s) => s.push);
  const mayManage = canManageUnits(user?.role);

  const [sel, setSel] = useState<string>("All");
  const [q, setQ] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [manageOpen, setManageOpen] = useState(false);

  const countFor = (u: string) => employees.filter((e) => (e.unit ?? "") === u).length;
  const unassignedCount = employees.filter((e) => !e.unit).length;

  const filtered = useMemo(() => {
    let list = employees;
    if (sel === UNASSIGNED) list = list.filter((e) => !e.unit);
    else if (sel !== "All") list = list.filter((e) => (e.unit ?? "") === sel);
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter((e) => `${e.name} ${e.id} ${e.role} ${e.department}`.toLowerCase().includes(s));
    }
    return list;
  }, [employees, sel, q]);

  const doAdd = () => {
    const r = addUnit(newUnit);
    if (!r.ok) return push("Couldn't add unit", r.error);
    push("Unit created", `${newUnit.trim()} added — now allocatable to employees.`);
    setNewUnit("");
  };
  const doRename = (oldName: string) => {
    const r = renameUnit(oldName, editVal);
    if (!r.ok) return push("Couldn't rename unit", r.error);
    push("Unit renamed", `${oldName} → ${editVal.trim()} (updated on all employees).`);
    if (sel === oldName) setSel(editVal.trim());
    setEditing(null);
  };

  return (
    <Card>
      <CardContent className="py-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-bold"><Building2 className="h-4 w-4 text-primary" /> Branches / Units</p>
          <div className="flex items-center gap-2">
            {!compact && <Input placeholder="Search name, ID, role…" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 w-52" />}
            {mayManage && (
              <Button variant="outline" size="sm" className="h-8" onClick={() => setManageOpen((v) => !v)}>
                <Pencil className="h-3.5 w-3.5" /> Manage units
              </Button>
            )}
          </div>
        </div>

        {/* Unit selector chips */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          <Button variant={sel === "All" ? "default" : "outline"} size="sm" className="h-7 px-2.5 text-[11px]" onClick={() => setSel("All")}>
            All units <Badge tone="muted" className="ml-1">{employees.length}</Badge>
          </Button>
          {units.map((u) => (
            <Button key={u} variant={sel === u ? "default" : "outline"} size="sm" className="h-7 px-2.5 text-[11px]" onClick={() => setSel(u)}>
              {u} <Badge tone="muted" className="ml-1">{countFor(u)}</Badge>
            </Button>
          ))}
          {unassignedCount > 0 && (
            <Button variant={sel === UNASSIGNED ? "default" : "outline"} size="sm" className="h-7 px-2.5 text-[11px]" onClick={() => setSel(UNASSIGNED)}>
              Unassigned <Badge tone="warning" className="ml-1">{unassignedCount}</Badge>
            </Button>
          )}
        </div>

        {/* Manage units (Admin/CEO) */}
        {mayManage && manageOpen && (
          <div className="mb-3 space-y-2 rounded-lg border border-dashed p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Create new unit</p>
            <div className="flex gap-2">
              <Input placeholder="e.g. Unit 3 — Dyeing" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doAdd()} className="h-8 max-w-xs" />
              <Button size="sm" className="h-8" onClick={doAdd}><Plus className="h-3.5 w-3.5" /> Add unit</Button>
            </div>
            <p className="pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Rename existing</p>
            <div className="space-y-1.5">
              {units.map((u) => (
                <div key={u} className="flex items-center gap-2">
                  {editing === u ? (
                    <>
                      <Input value={editVal} onChange={(e) => setEditVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doRename(u)} className="h-8 max-w-xs" autoFocus />
                      <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => doRename(u)}><Check className="h-3.5 w-3.5 text-success" /></Button>
                      <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setEditing(null)}><X className="h-3.5 w-3.5" /></Button>
                    </>
                  ) : (
                    <>
                      <span className="min-w-[160px] text-sm font-medium">{u}</span>
                      <Badge tone="muted">{countFor(u)} staff</Badge>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => { setEditing(u); setEditVal(u); }}><Pencil className="h-3 w-3" /> Rename</Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Employees in the selected unit — same columns as the Employees table (+ Department) */}
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH>Emp ID</TH><TH>Name</TH><TH>Role</TH><TH>Department</TH><TH>Category</TH><TH>Wage</TH><TH>Status</TH><TH></TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((e) => (
                <TR key={e.id}>
                  <TD className="font-mono text-xs text-muted-foreground">{e.id}</TD>
                  <TD className="font-medium">{e.name}</TD>
                  <TD>{e.role}</TD>
                  <TD>{e.department}{e.section ? <span className="text-muted-foreground"> · {e.section}</span> : ""}</TD>
                  <TD><Badge tone="muted">{e.category === "MC_OTHERS" && e.categoryOther ? e.categoryOther : categoryById(e.category)?.label ?? e.category}</Badge></TD>
                  <TD><Badge tone={e.wageType === "Monthly" ? "info" : "warning"}>{e.wageType === "Monthly" ? "Monthly" : `₹${e.salaryPerDay}/day`}</Badge></TD>
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
        </div>
        {filtered.length === 0 && (
          <p className="flex items-center justify-center gap-2 py-8 text-center text-sm text-muted-foreground">
            <Users className="h-4 w-4" /> No employees in {sel === "All" ? "the workforce" : sel === UNASSIGNED ? "the unassigned list" : sel}.
          </p>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          Showing {filtered.length} of {employees.length} employees{sel !== "All" ? ` · ${sel === UNASSIGNED ? "Unassigned" : sel}` : " · all branches"}.
        </p>
      </CardContent>
    </Card>
  );
}

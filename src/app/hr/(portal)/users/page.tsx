"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { FormModal } from "@/components/form-modal";
import { useToast } from "@/components/ui/toast";
import { useHr, canManageUsers, type HrRole, type HrUserAccount } from "@/stores/hr";
import { KeyRound, UserPlus, Users, ShieldCheck, Lock, Pencil, RotateCcw, Trash2, Power } from "lucide-react";

const ALL_ROLES: HrRole[] = ["HR Manager", "HR Executive", "Manager", "CEO", "Admin"];

export default function UsersPage() {
  const hrUsers = useHr((s) => s.hrUsers);
  const user = useHr((s) => s.user);
  const addHrUser = useHr((s) => s.addHrUser);
  const updateHrUser = useHr((s) => s.updateHrUser);
  const resetHrUserPassword = useHr((s) => s.resetHrUserPassword);
  const deleteHrUser = useHr((s) => s.deleteHrUser);
  const toast = useToast((s) => s.push);

  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<HrUserAccount | null>(null);
  const [resetting, setResetting] = useState<HrUserAccount | null>(null);

  const canManage = canManageUsers(user?.role);
  const rows = hrUsers.filter((u) => `${u.loginId} ${u.name} ${u.role}`.toLowerCase().includes(q.toLowerCase()));
  const activeCount = hrUsers.filter((u) => u.active).length;

  return (
    <>
      <PageHeader
        title="Users & Access"
        description="Every HR login is its own account — changes anyone makes across the portal are attributed to it in the Audit Log."
        actions={canManage ? <Button size="sm" onClick={() => setAddOpen(true)}><UserPlus className="h-4 w-4" /> Add login</Button> : undefined}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total accounts" value={`${hrUsers.length}`} icon={Users} sub="HR portal logins" />
        <KpiCard label="Active" value={`${activeCount}`} icon={ShieldCheck} sub="can sign in" tone="success" />
        <KpiCard label="Deactivated" value={`${hrUsers.length - activeCount}`} icon={Power} sub="access blocked" tone={hrUsers.length - activeCount ? "warning" : "info"} />
        <KpiCard label="Your access" value={canManage ? "Manage" : "View only"} icon={KeyRound} sub={canManage ? "CEO / Admin" : "CEO & Admin can manage"} tone={canManage ? "success" : "info"} />
      </div>

      {!canManage && (
        <Card className="border-info/40 bg-info/5">
          <CardContent className="flex items-center gap-2 py-3 text-sm text-info">
            <Lock className="h-4 w-4 shrink-0" /> You can see who has a login. Creating, editing, resetting passwords and deactivating accounts is restricted to CEO and Admin.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="py-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Passwords are never shown — use Reset to issue a new one.</p>
            <Input placeholder="Search login, name, role…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
          </div>
          <Table>
            <THead><TR><TH>Login ID</TH><TH>Name</TH><TH>Role</TH><TH>Status</TH><TH>Created</TH><TH className="text-right">Actions</TH></TR></THead>
            <TBody>
              {rows.map((u) => (
                <TR key={u.id}>
                  <TD className="font-mono text-xs">{u.loginId}{u.loginId === user?.loginId && <span className="ml-1.5 text-[10px] text-muted-foreground">(you)</span>}</TD>
                  <TD className="font-medium">{u.name}</TD>
                  <TD><Badge tone="muted">{u.role}</Badge></TD>
                  <TD>{u.active ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Deactivated</Badge>}</TD>
                  <TD className="whitespace-nowrap text-xs text-muted-foreground">{u.createdAt}</TD>
                  <TD>
                    <div className="flex items-center justify-end gap-1.5">
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" disabled={!canManage} title={canManage ? "Edit" : "CEO / Admin only"} onClick={() => setEditing(u)}>
                        <Pencil className="h-3 w-3" /> Edit
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" disabled={!canManage} title={canManage ? "Reset password" : "CEO / Admin only"} onClick={() => setResetting(u)}>
                        <RotateCcw className="h-3 w-3" /> Reset
                      </Button>
                      <Button
                        size="sm" variant="outline" className="h-7 px-2 text-[11px]"
                        disabled={!canManage}
                        title={canManage ? (u.active ? "Deactivate" : "Activate") : "CEO / Admin only"}
                        onClick={() => {
                          const r = updateHrUser(u.id, { active: !u.active });
                          if (!r.ok) toast("Couldn't update", r.error, "danger");
                          else toast(u.active ? "Account deactivated" : "Account activated", `${u.loginId} — ${u.name}`, u.active ? "warning" : "success");
                        }}
                      >
                        <Power className="h-3 w-3" /> {u.active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        size="sm" variant="danger" className="h-7 px-2 text-[11px]"
                        disabled={!canManage}
                        title={canManage ? "Delete permanently" : "CEO / Admin only"}
                        onClick={() => {
                          if (!window.confirm(`Delete the login "${u.loginId}" (${u.name})? This can't be undone.`)) return;
                          const r = deleteHrUser(u.id);
                          if (!r.ok) toast("Couldn't delete", r.error, "danger");
                          else toast("Login deleted", `${u.loginId} — ${u.name}`, "warning");
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {rows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No accounts match.</p>}
        </CardContent>
      </Card>

      {addOpen && (
        <FormModal
          title="Add HR login"
          description="Creates a new account — the person signs in with this Login ID and password."
          submitLabel="Create login"
          fields={[
            { name: "loginId", label: "Login ID", required: true, placeholder: "e.g. kalpana.hr" },
            { name: "password", label: "Password", type: "password", required: true },
            { name: "name", label: "Full name", required: true },
            { name: "role", label: "Role", type: "select", options: ALL_ROLES, required: true },
          ]}
          onSubmit={(v) => {
            const r = addHrUser({ loginId: v.loginId, password: v.password, name: v.name, role: v.role as HrRole });
            if (!r.ok) return r.error;
            toast("Login created", `${v.loginId} — ${v.name} (${v.role})`);
          }}
          onClose={() => setAddOpen(false)}
        />
      )}

      {editing && (
        <FormModal
          title={`Edit login — ${editing.loginId}`}
          submitLabel="Save changes"
          fields={[
            { name: "loginId", label: "Login ID", required: true, defaultValue: editing.loginId },
            { name: "name", label: "Full name", required: true, defaultValue: editing.name },
            { name: "role", label: "Role", type: "select", options: ALL_ROLES, required: true, defaultValue: editing.role },
          ]}
          onSubmit={(v) => {
            const r = updateHrUser(editing.id, { loginId: v.loginId, name: v.name, role: v.role as HrRole });
            if (!r.ok) return r.error;
            toast("Login updated", `${v.loginId} — ${v.name} (${v.role})`);
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {resetting && (
        <FormModal
          title={`Reset password — ${resetting.loginId}`}
          description={`Sets a new password for ${resetting.name}. Share it with them directly.`}
          submitLabel="Set new password"
          fields={[{ name: "password", label: "New password", type: "password", required: true }]}
          onSubmit={(v) => {
            resetHrUserPassword(resetting.id, v.password);
            toast("Password reset", `${resetting.loginId} — new password set.`);
          }}
          onClose={() => setResetting(null)}
        />
      )}
    </>
  );
}

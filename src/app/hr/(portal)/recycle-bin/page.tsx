"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useHr, canPurge } from "@/stores/hr";
import { Trash2, Undo2, ShieldAlert, User, Lock } from "lucide-react";

const TYPE_LABEL: Record<string, string> = { employee: "Employee", advance: "Advance", leave: "Leave" };

export default function RecycleBinPage() {
  const bin = useHr((s) => s.recycleBin);
  const user = useHr((s) => s.user);
  const restore = useHr((s) => s.restoreFromBin);
  const purge = useHr((s) => s.purgeFromBin);
  const push = useToast((s) => s.push);
  const [q, setQ] = useState("");
  const [type, setType] = useState("All");
  const allowPurge = canPurge(user?.role);

  const types = ["All", ...Array.from(new Set(bin.map((b) => b.type)))];
  const rows = bin
    .filter((b) => type === "All" || b.type === type)
    .filter((b) => `${b.label} ${b.sub ?? ""} ${b.deletedBy}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHeader
        title="Deleted Items"
        description="Recycle bin — restore anything, or permanently delete. Permanent delete is restricted to CEO & Admin; restore is available to everyone."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="In recycle bin" value={`${bin.length}`} icon={Trash2} sub="soft-deleted records" tone="warning" />
        <KpiCard label="Employees" value={`${bin.filter((b) => b.type === "employee").length}`} icon={User} sub="deleted" />
        <KpiCard label="Your role" value={user?.role ?? "—"} icon={ShieldAlert} sub={allowPurge ? "can permanently delete" : "restore only"} tone={allowPurge ? "success" : "info"} />
        <KpiCard label="Permanent delete" value={allowPurge ? "Enabled" : "Locked"} icon={Lock} sub={allowPurge ? "CEO / Admin" : "CEO & Admin only"} tone={allowPurge ? "danger" : "info"} />
      </div>

      {!allowPurge && (
        <Card className="border-info/40 bg-info/5">
          <CardContent className="flex items-center gap-2 py-3 text-sm text-info">
            <Lock className="h-4 w-4 shrink-0" /> You can restore deleted items. Permanent deletion is available only to CEO and Admin logins.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="py-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {types.map((t) => (
                <Button key={t} variant={type === t ? "default" : "outline"} size="sm" className="h-7 px-2.5 text-[11px]" onClick={() => setType(t)}>{t === "All" ? "All" : TYPE_LABEL[t] ?? t}</Button>
              ))}
            </div>
            <Input placeholder="Search deleted items…" value={q} onChange={(e) => setQ(e.target.value)} className="w-60" />
          </div>
          <Table>
            <THead><TR><TH>Type</TH><TH>Item</TH><TH>Deleted by</TH><TH>Deleted at</TH><TH className="text-right">Actions</TH></TR></THead>
            <TBody>
              {rows.map((b) => (
                <TR key={b.id}>
                  <TD><Badge tone="muted">{TYPE_LABEL[b.type] ?? b.type}</Badge></TD>
                  <TD className="font-medium">{b.label}<div className="text-xs font-normal text-muted-foreground">{b.sub}</div></TD>
                  <TD className="text-sm">{b.deletedBy}</TD>
                  <TD className="whitespace-nowrap text-xs text-muted-foreground">{b.deletedAt}</TD>
                  <TD>
                    <div className="flex items-center justify-end gap-1.5">
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => { restore(b.id); push(`Restored — ${b.label}`, `${TYPE_LABEL[b.type]} restored to the ${b.type} list.`); }}>
                        <Undo2 className="h-3 w-3" /> Restore
                      </Button>
                      <Button
                        size="sm" variant="danger" className="h-7 px-2 text-[11px]"
                        disabled={!allowPurge}
                        title={allowPurge ? "Permanently delete" : "Only CEO / Admin can permanently delete"}
                        onClick={() => { purge(b.id); push(`Permanently deleted — ${b.label}`, "This record has been removed for good.", "danger"); }}
                      >
                        {allowPurge ? <Trash2 className="h-3 w-3" /> : <Lock className="h-3 w-3" />} Delete permanently
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {rows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Recycle bin is empty. Deleted employees, advances and leave appear here.</p>}
        </CardContent>
      </Card>
    </>
  );
}

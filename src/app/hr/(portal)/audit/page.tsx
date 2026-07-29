"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { downloadExcel } from "@/lib/excel";
import { useHr } from "@/stores/hr";
import { History, User, ShieldCheck, FileSpreadsheet } from "lucide-react";

export default function AuditPage() {
  const audit = useHr((s) => s.audit);
  const [q, setQ] = useState("");
  const [module, setModule] = useState("All");

  const modules = ["All", ...Array.from(new Set(audit.map((a) => a.module)))];
  const rows = audit
    .filter((a) => module === "All" || a.module === module)
    .filter((a) => `${a.by} ${a.action} ${a.detail} ${a.empId ?? ""}`.toLowerCase().includes(q.toLowerCase()));

  const editors = new Set(audit.map((a) => a.by)).size;

  const exportAudit = () =>
    downloadExcel({
      filename: "audit-log", sheetName: "Audit Log", title: "Audit Log — who changed what",
      columns: [
        { header: "When", key: "at", width: 20 }, { header: "By (login)", key: "by", width: 22 },
        { header: "Module", key: "module", width: 18 }, { header: "Action", key: "action", width: 20 },
        { header: "Detail", key: "detail", width: 50 }, { header: "Employee", key: "empId" },
      ],
      rows: rows as unknown as Record<string, unknown>[],
    });

  return (
    <>
      <PageHeader
        title="Audit Log"
        description="Every change to the database is recorded with the login that made it — full accountability across all modules"
        actions={<Button variant="outline" size="sm" onClick={exportAudit}><FileSpreadsheet className="h-4 w-4" /> Export</Button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total changes" value={`${audit.length}`} icon={History} sub="recorded this session/DB" />
        <KpiCard label="Editors" value={`${editors}`} icon={User} sub="distinct logins" tone="info" />
        <KpiCard label="Modules touched" value={`${modules.length - 1}`} icon={ShieldCheck} sub="areas with changes" tone="success" />
        <KpiCard label="Showing" value={`${rows.length}`} icon={History} sub="after filters" tone="warning" />
      </div>

      <Card>
        <CardContent className="py-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {modules.map((m) => (
                <Button key={m} variant={module === m ? "default" : "outline"} size="sm" className="h-7 px-2.5 text-[11px]" onClick={() => setModule(m)}>{m}</Button>
              ))}
            </div>
            <Input placeholder="Search login, action, detail…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
          </div>
          <Table>
            <THead><TR><TH>When</TH><TH>By (login)</TH><TH>Module</TH><TH>Action</TH><TH>Detail</TH><TH>Employee</TH></TR></THead>
            <TBody>
              {rows.map((a) => (
                <TR key={a.id}>
                  <TD className="whitespace-nowrap text-xs text-muted-foreground">{a.at}</TD>
                  <TD className="font-medium">{a.by}</TD>
                  <TD><Badge tone="muted">{a.module}</Badge></TD>
                  <TD>{a.action}</TD>
                  <TD className="max-w-[360px] whitespace-normal text-xs text-muted-foreground">{a.detail}</TD>
                  <TD className="font-mono text-xs text-muted-foreground">{a.empId ?? "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {rows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No changes recorded yet. Edits across the portal will appear here with the login that made them.</p>}
        </CardContent>
      </Card>
    </>
  );
}

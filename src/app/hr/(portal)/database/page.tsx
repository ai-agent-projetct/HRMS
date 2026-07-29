"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { dbHealth, dbLoadIntoStore, dbSaveFromStore, dbSeed, type DbHealth } from "@/lib/db-client";
import { Database, RefreshCw, Download, Upload, Sprout, CheckCircle2, XCircle } from "lucide-react";

export default function DatabasePage() {
  const push = useToast((s) => s.push);
  const [health, setHealth] = useState<DbHealth | null>(null);
  const [busy, setBusy] = useState<string>("");

  const refresh = async () => { setBusy("refresh"); setHealth(await dbHealth()); setBusy(""); };
  useEffect(() => { refresh(); }, []);

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try { await fn(); push(ok); await refresh(); }
    catch (e) { push("Database error", e instanceof Error ? e.message : String(e), "danger"); }
    finally { setBusy(""); }
  };

  const connected = health?.ok;
  const total = health?.counts ? Object.values(health.counts).reduce((a, b) => a + b, 0) : 0;

  return (
    <>
      <PageHeader
        title="Database"
        description="MySQL backend — connection status, seed, and sync between the app and the database"
        actions={<Button variant="outline" size="sm" onClick={refresh} disabled={!!busy}><RefreshCw className={`h-4 w-4 ${busy === "refresh" ? "animate-spin" : ""}`} /> Refresh</Button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Connection" value={connected ? "Connected" : "Offline"} icon={Database} sub={connected ? `${health?.db} @ ${health?.host}` : "MySQL not reachable"} tone={connected ? "success" : "danger"} />
        <KpiCard label="Tables" value={`${health?.counts ? Object.keys(health.counts).length : 0}`} icon={Database} sub="in schema" tone="info" />
        <KpiCard label="Total rows" value={`${total}`} icon={Database} sub="across all tables" />
        <KpiCard label="Employees in DB" value={`${health?.counts?.employees ?? 0}`} icon={Database} sub="workforce persisted" tone="warning" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {connected ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-danger" />}
            {connected ? "MySQL connected" : "MySQL not connected"}
          </CardTitle>
          <CardDescription>
            {connected
              ? "The ERP is backed by MySQL. Use the actions below to seed, load or save data."
              : `Could not reach MySQL: ${health?.error ?? "unknown"}. Ensure the MySQL service is running and db/setup.sql has been applied.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button disabled={!connected || !!busy} onClick={() => run("seed", dbSeed, "Database seeded from workforce data")}><Sprout className="h-4 w-4" /> {busy === "seed" ? "Seeding…" : "Seed database"}</Button>
          <Button variant="outline" disabled={!connected || !!busy} onClick={() => run("load", dbLoadIntoStore, "Loaded data from database into the app")}><Download className="h-4 w-4" /> {busy === "load" ? "Loading…" : "Load from DB"}</Button>
          <Button variant="outline" disabled={!connected || !!busy} onClick={() => run("save", dbSaveFromStore, "Saved current app data to the database")}><Upload className="h-4 w-4" /> {busy === "save" ? "Saving…" : "Save to DB"}</Button>
        </CardContent>
      </Card>

      {health?.counts && (
        <Card>
          <CardHeader><CardTitle>Tables</CardTitle><CardDescription>Row counts per table in <code className="text-[11px]">{health.db}</code></CardDescription></CardHeader>
          <CardContent>
            <Table>
              <THead><TR><TH>Table</TH><TH className="text-right">Rows</TH></TR></THead>
              <TBody>
                {Object.entries(health.counts).map(([t, n]) => (
                  <TR key={t}><TD className="font-mono text-xs">{t}</TD><TD className="text-right font-semibold">{n}</TD></TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card className="border-dashed">
        <CardContent className="py-4 text-xs text-muted-foreground">
          <p className="mb-1 font-semibold text-foreground">First-time setup</p>
          <p>1. As MySQL root: <code>mysql -u root -p &lt; db/setup.sql</code> (creates the <code>loomhr</code> database &amp; user).</p>
          <p>2. <code>npm run db:reset</code> (creates tables &amp; seeds), or click <b>Seed database</b> above.</p>
          <p className="mt-1">Connection settings live in <code>.env.local</code>.</p>
        </CardContent>
      </Card>
    </>
  );
}

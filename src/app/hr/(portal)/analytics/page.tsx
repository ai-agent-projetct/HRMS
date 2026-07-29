"use client";

import { useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ApexChart } from "@/components/charts/apex";
import { downloadExcel } from "@/lib/excel";
import { useHr } from "@/stores/hr";
import { UNITS, unitOf, WORKER_CATEGORIES } from "@/lib/hr-master";
import { tenure } from "@/lib/hr-data";
import { formatINR } from "@/lib/utils";
import { Users, IndianRupee, TrendingDown, Percent, GraduationCap, FileSpreadsheet } from "lucide-react";

export default function AnalyticsPage() {
  const employees = useHr((s) => s.employees);

  const a = useMemo(() => {
    const active = employees.filter((e) => e.status !== "Exited");
    const byUnit = UNITS.map((u) => ({ u, n: active.filter((e) => unitOf(e.department, e.role) === u.id).length }))
      .filter((x) => x.n > 0);
    const costByUnit = byUnit.map((x) => ({ u: x.u, cost: active.filter((e) => unitOf(e.department, e.role) === x.u.id).reduce((s, e) => s + e.monthlyGross, 0) }));
    const cats = WORKER_CATEGORIES.map((c) => ({ c, n: active.filter((e) => e.category === c.id).length })).filter((x) => x.n > 0);
    const male = active.filter((e) => e.gender === "Male").length;
    const female = active.filter((e) => e.gender === "Female").length;
    const wageTypes = ["Monthly", "Weekly", "Daily"].map((w) => active.filter((e) => e.wageType === w).length);
    const buckets = [
      { label: "<1 yr", n: 0 }, { label: "1–3 yr", n: 0 }, { label: "3–5 yr", n: 0 }, { label: "5–10 yr", n: 0 }, { label: "10+ yr", n: 0 },
    ];
    active.forEach((e) => {
      const y = tenure(e.doj).totalDays / 365;
      if (y < 1) buckets[0].n++; else if (y < 3) buckets[1].n++; else if (y < 5) buckets[2].n++; else if (y < 10) buckets[3].n++; else buckets[4].n++;
    });
    const totalCost = active.reduce((s, e) => s + e.monthlyGross, 0);
    const avgTenure = active.length ? active.reduce((s, e) => s + tenure(e.doj).totalDays, 0) / active.length / 365 : 0;
    const attrition = employees.length ? Math.round((employees.filter((e) => e.status === "Exited").length / employees.length) * 100) : 0;
    return { active, byUnit, costByUnit, cats, male, female, wageTypes, buckets, totalCost, avgTenure, attrition };
  }, [employees]);

  const donut = (labels: string[]) => ({ labels, legend: { position: "bottom" as const }, stroke: { width: 0 }, plotOptions: { pie: { donut: { size: "62%" } } }, dataLabels: { enabled: true, formatter: (v: number) => Math.round(v) + "%" } });

  const exportWorkforce = () =>
    downloadExcel({
      filename: "hr-analytics", sheetName: "Workforce Analytics", title: "Workforce Analytics",
      columns: [{ header: "Unit", key: "unit", width: 26 }, { header: "Headcount", key: "n" }, { header: "Monthly wage cost ₹", key: "cost" }],
      rows: a.costByUnit.map((x) => ({ unit: x.u.label, n: a.byUnit.find((b) => b.u.id === x.u.id)?.n ?? 0, cost: x.cost })),
    });

  return (
    <>
      <PageHeader
        title="HR Analytics"
        description="Workforce, cost, diversity and tenure analytics across the mill"
        actions={<Button variant="outline" size="sm" onClick={exportWorkforce}><FileSpreadsheet className="h-4 w-4" /> Export</Button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Active workforce" value={`${a.active.length}`} icon={Users} sub={`${employees.length} on record`} />
        <KpiCard label="Monthly wage cost" value={formatINR(a.totalCost, true)} icon={IndianRupee} sub="gross · all workers" tone="info" />
        <KpiCard label="Avg tenure" value={`${a.avgTenure.toFixed(1)} yrs`} icon={GraduationCap} sub="workforce stability" tone="success" />
        <KpiCard label="Women in workforce" value={`${a.active.length ? Math.round((a.female / a.active.length) * 100) : 0}%`} icon={Percent} sub={`${a.female} of ${a.active.length}`} tone="warning" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Headcount by unit</CardTitle><CardDescription>Where the workforce sits across the mill</CardDescription></CardHeader>
          <CardContent>
            <ApexChart type="bar" height={300}
              series={[{ name: "Workers", data: a.byUnit.map((x) => x.n) }]}
              options={{ xaxis: { categories: a.byUnit.map((x) => x.u.label) }, plotOptions: { bar: { borderRadius: 4, horizontal: true } } }} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Monthly wage cost by unit</CardTitle><CardDescription>Where the wage bill is concentrated</CardDescription></CardHeader>
          <CardContent>
            <ApexChart type="bar" height={300}
              series={[{ name: "₹ / month", data: a.costByUnit.map((x) => x.cost) }]}
              options={{ xaxis: { categories: a.costByUnit.map((x) => x.u.label) }, plotOptions: { bar: { borderRadius: 4, horizontal: true } }, colors: ["#14b8a6"] }} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Worker categories</CardTitle><CardDescription>Permanent · hostel · casual · migrant mix</CardDescription></CardHeader>
          <CardContent>
            <ApexChart type="donut" height={300} series={a.cats.map((x) => x.n)} options={donut(a.cats.map((x) => x.c.label))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Wage type & diversity</CardTitle><CardDescription>Pay cycle split and gender diversity</CardDescription></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <ApexChart type="donut" height={230} series={a.wageTypes} options={donut(["Monthly", "Weekly", "Daily"])} />
            <ApexChart type="donut" height={230} series={[a.male, a.female]} options={{ ...donut(["Male", "Female"]), colors: ["#6366f1", "#ec4899"] }} />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div><CardTitle>Tenure distribution</CardTitle><CardDescription>Experience spread — retention & succession risk</CardDescription></div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingDown className="h-4 w-4" /> Attrition {a.attrition}%</div>
          </CardHeader>
          <CardContent>
            <ApexChart type="bar" height={280}
              series={[{ name: "Workers", data: a.buckets.map((b) => b.n) }]}
              options={{ xaxis: { categories: a.buckets.map((b) => b.label) }, plotOptions: { bar: { borderRadius: 4, columnWidth: "45%" } }, colors: ["#f59e0b"] }} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

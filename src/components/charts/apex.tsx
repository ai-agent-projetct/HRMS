"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import type { ApexOptions } from "apexcharts";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[200px] items-center justify-center text-xs text-muted-foreground">
      Loading chart…
    </div>
  ),
});

export const CHART_COLORS = [
  "#6366f1", // indigo
  "#14b8a6", // teal
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#22c55e", // green
];

/**
 * Theme-aware ApexCharts wrapper. Merges sensible ERP defaults (fonts, grid,
 * legend, dark mode) with per-chart options.
 */
export function ApexChart({
  type,
  series,
  options,
  height = 280,
}: {
  type: NonNullable<ApexOptions["chart"]>["type"];
  series: ApexOptions["series"];
  options?: ApexOptions;
  height?: number;
}) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div style={{ height }} />;
  }

  const dark = resolvedTheme === "dark";
  const axisColor = dark ? "#94a3b8" : "#64748b";
  const gridColor = dark ? "rgba(148,163,184,0.12)" : "rgba(100,116,139,0.14)";

  const base: ApexOptions = {
    chart: {
      type,
      toolbar: { show: false },
      background: "transparent",
      fontFamily: "Inter, system-ui, sans-serif",
      animations: { enabled: true, speed: 500 },
    },
    theme: { mode: dark ? "dark" : "light" },
    colors: CHART_COLORS,
    grid: { borderColor: gridColor, strokeDashArray: 4 },
    dataLabels: { enabled: false },
    legend: {
      labels: { colors: axisColor },
      fontSize: "12px",
      markers: { size: 5, strokeWidth: 0 },
    },
    xaxis: {
      labels: { style: { colors: axisColor, fontSize: "11px" } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { labels: { style: { colors: axisColor, fontSize: "11px" } } },
    tooltip: { theme: dark ? "dark" : "light" },
    stroke: { curve: "smooth", width: type === "line" || type === "area" ? 2.5 : 0 },
  };

  const merged: ApexOptions = {
    ...base,
    ...options,
    chart: { ...base.chart, ...options?.chart, type },
    xaxis: { ...base.xaxis, ...options?.xaxis },
    legend: { ...base.legend, ...options?.legend },
  };

  return (
    <ReactApexChart
      type={type}
      series={series}
      options={merged}
      height={height}
      width="100%"
    />
  );
}

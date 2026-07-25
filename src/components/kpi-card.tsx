"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";

export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
  tone = "primary",
  className,
  onClick,
  active,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  trend?: { value: string; up: boolean; good?: boolean };
  tone?: "primary" | "success" | "warning" | "danger" | "info";
  className?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const iconTone = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning",
    danger: "bg-danger/10 text-danger",
    info: "bg-info/10 text-info",
  }[tone];

  const trendGood = trend ? (trend.good ?? trend.up) : true;

  return (
    <Card
      onClick={onClick}
      className={cn(
        "animate-fade-in-up p-4",
        onClick && "cursor-pointer",
        active && "ring-2 ring-primary ring-offset-1 ring-offset-background",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-1.5 truncate text-2xl font-bold tracking-tight">
            {value}
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-xs">
            {trend && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-semibold",
                  trendGood ? "text-success" : "text-danger"
                )}
              >
                {trend.up ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                {trend.value}
              </span>
            )}
            {sub && <span className="truncate text-muted-foreground">{sub}</span>}
          </div>
        </div>
        <div className={cn("rounded-lg p-2.5", iconTone)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

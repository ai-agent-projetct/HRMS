import { cn } from "@/lib/utils";

export type BadgeTone =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "muted";

const tones: Record<BadgeTone, string> = {
  default: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/10 text-danger",
  info: "bg-info/10 text-info",
  muted: "bg-muted text-muted-foreground",
};

export function Badge({
  tone = "default",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}

/** Maps common domain statuses to a badge tone. */
export function statusTone(status: string): BadgeTone {
  const s = status.toLowerCase();
  if (
    [
      "running",
      "active",
      "completed",
      "paid",
      "approved",
      "passed",
      "present",
      "in stock",
      "dispatched",
      "won",
      "healthy",
      "delivered",
    ].some((k) => s.includes(k))
  )
    return "success";
  if (
    ["pending", "in progress", "partial", "low stock", "due", "scheduled", "on hold", "negotiation", "in process"].some(
      (k) => s.includes(k)
    )
  )
    return "warning";
  if (
    ["breakdown", "failed", "overdue", "rejected", "critical", "absent", "out of stock", "lost", "idle"].some(
      (k) => s.includes(k)
    )
  )
    return "danger";
  if (["new", "draft", "maintenance", "leave", "proposal"].some((k) => s.includes(k)))
    return "info";
  return "muted";
}

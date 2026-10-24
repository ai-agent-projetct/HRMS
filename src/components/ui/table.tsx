import { cn } from "@/lib/utils";

export function Table({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableElement>) {
  return (
    // Own scroll area so the header row can stay pinned while rows scroll
    // (an overflow-x wrapper would otherwise capture `sticky`).
    <div className="w-full max-h-[75vh] overflow-auto">
      <table
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

export function THead({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  // Pinned to the top of the table's scroll area so EMP ID / Name / Role /
  // Dept / Category stay visible while the long list scrolls.
  return <thead className={cn("sticky top-0 z-20 bg-card [&_tr]:border-b", className)} {...props} />;
}

export function TBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  );
}

export function TR({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b transition-colors hover:bg-muted/50",
        className
      )}
      {...props}
    />
  );
}

export function TH({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "h-10 whitespace-nowrap bg-card px-3 text-left align-middle text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

export function TD({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("whitespace-nowrap px-3 py-2.5 align-middle", className)}
      {...props}
    />
  );
}

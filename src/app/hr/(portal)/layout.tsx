"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  Users, LayoutDashboard, CalendarClock, Banknote, FileBarChart,
  LogOut, Moon, Sun, Menu, Building2, ArrowLeftRight,
  CalendarCheck, HandCoins, Gift, Handshake, HeartPulse, Database,
  Bot, CalendarRange, ShieldCheck, UserMinus, Star, PieChart, FileText, History, Trash2, KeyRound, Timer, ShieldCheck as ShieldLock, Unlock, ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toast";
import { useHr } from "@/stores/hr";
import { COMPANY, PRODUCT } from "@/lib/company";
import { dbHealth, dbHydrateIfUntouched, startDbAutoSync, storeMark, suspendAutoSync, type SyncStatus } from "@/lib/db-client";

const NAV = [
  { label: "Dashboard", href: "/hr", icon: LayoutDashboard },
  { label: "AI Command Centre", href: "/hr/ai", icon: Bot },
  { label: "Employees", href: "/hr/employees", icon: Users },
  { label: "Branches / Units", href: "/hr/branches", icon: Building2 },
  { label: "Attendance & Shifts", href: "/hr/attendance", icon: CalendarCheck },
  { label: "Leave", href: "/hr/leave", icon: CalendarClock },
  { label: "Advances & Deductions", href: "/hr/advances", icon: HandCoins },
  { label: "Incentives", href: "/hr/incentives", icon: Gift },
  { label: "Agents & Commission", href: "/hr/agents", icon: Handshake },
  { label: "Payroll & Payslips", href: "/hr/payroll", icon: Banknote },
  { label: "Wage Statements", href: "/hr/statements", icon: FileText },
  { label: "Weekly Wages", href: "/hr/weekly", icon: CalendarRange },
  { label: "Overtime (OT)", href: "/hr/overtime", icon: Timer },
  { label: "Bank Transfer", href: "/hr/transfer", icon: ArrowLeftRight },
  { label: "Statutory & Compliance", href: "/hr/compliance", icon: ShieldCheck },
  { label: "Appraisals", href: "/hr/appraisals", icon: Star },
  { label: "Full & Final Settlement", href: "/hr/settlement", icon: UserMinus },
  { label: "Health Check", href: "/hr/health", icon: HeartPulse },
  { label: "HR Analytics", href: "/hr/analytics", icon: PieChart },
  { label: "Masters & Database", href: "/hr/masters", icon: Database },
  { label: "Database (MySQL)", href: "/hr/database", icon: Database },
  { label: "Audit Log", href: "/hr/audit", icon: History },
  { label: "Users & Access", href: "/hr/users", icon: KeyRound },
  { label: "Go-Live & Data Lock", href: "/hr/go-live", icon: ShieldLock },
  { label: "Deleted Items", href: "/hr/recycle-bin", icon: Trash2 },
  { label: "Daily Report", href: "/hr/reports", icon: FileBarChart },
  { label: "On-Roll Report", href: "/hr/onroll", icon: ClipboardList },
];

export default function HrPortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useHr((s) => s.user);
  const dataLock = useHr((s) => s.dataLock);
  const logout = useHr((s) => s.logout);
  const { resolvedTheme, setTheme } = useTheme();
  const [hydrated, setHydrated] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [dbOk, setDbOk] = useState<boolean | null>(null);
  const [sync, setSync] = useState<SyncStatus>("idle");

  useEffect(() => { setHydrated(true); setMounted(true); }, []);
  // Auto-connect to the database: if reachable and populated, make it the
  // source of truth, then keep it in step with every later edit.
  useEffect(() => {
    let cancelled = false;
    let stopSync: (() => void) | undefined;
    // Marked before the first request so edits made anywhere during startup
    // — health check included — survive the hydration below.
    const mark = storeMark();
    (async () => {
      try {
        const h = await dbHealth();
        if (cancelled) return;
        setDbOk(h.ok);
        if (!h.ok) return;
        // True only when hydration was deliberately skipped because this
        // browser already held edits the database doesn't have. A failed
        // request must not push possibly-stale local data over the cloud.
        let hasUnsavedLocalEdits = false;
        if ((h.counts?.employees ?? 0) > 0) {
          // Hydrating writes to the store; don't echo it straight back — and
          // don't clobber edits the user made while the request was running.
          try { hasUnsavedLocalEdits = !(await suspendAutoSync(() => dbHydrateIfUntouched(mark))); }
          catch { /* database unreachable — keep local, don't overwrite it */ }
        }
        if (cancelled) return;
        stopSync = startDbAutoSync((s, err) => {
          setSync(s);
          if (s === "error") console.error("DB auto-sync failed:", err);
        }, { pushOnStart: hasUnsavedLocalEdits });
      } catch { if (!cancelled) setDbOk(false); }
    })();
    return () => { cancelled = true; stopSync?.(); };
  }, []);
  useEffect(() => {
    if (hydrated && !user) router.replace("/hr/login");
  }, [hydrated, user, router]);

  if (!hydrated || !user) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading HRMS Portal…</div>;
  }

  const activeHref = NAV.map((n) => n.href)
    .filter((h) => pathname === h || (h !== "/hr" && pathname.startsWith(h)))
    .sort((a, b) => b.length - a.length)[0] ?? (pathname.startsWith("/hr/employee") ? "/hr/employees" : "/hr");

  return (
    <div className="min-h-screen">
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r bg-card transition-transform duration-200 lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-16 items-center gap-3 border-b px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
            <Users className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight">{PRODUCT.name}</p>
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">HRMS Portal</p>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {NAV.map((item) => {
            const active = item.href === activeHref;
            return (
              <Link key={item.href} href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
                  active ? "bg-emerald-600/10 text-emerald-600" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}>
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-4">
          <div className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-muted-foreground">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="leading-tight">{COMPANY.shortName}<br /><span className="text-[10px] text-muted-foreground/70">{COMPANY.location}</span></span>
          </div>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md lg:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen((v) => !v)} aria-label="Menu">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="ml-auto flex items-center gap-1.5">
            {dbOk !== null && (
              <span className={cn("mr-1 hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline-flex",
                !dbOk ? "bg-amber-500/10 text-amber-600"
                  : sync === "error" ? "bg-red-500/10 text-red-600"
                  : sync === "saving" ? "bg-sky-500/10 text-sky-600"
                  : "bg-emerald-500/10 text-emerald-600")}
                title={!dbOk ? "Database offline — using local data"
                  : sync === "error" ? "Could not save to the database — changes are still in this browser"
                  : sync === "saving" ? "Saving changes to the database…"
                  : "Connected — changes save automatically"}>
                <span className={cn("h-1.5 w-1.5 rounded-full",
                  !dbOk ? "bg-amber-500"
                    : sync === "error" ? "bg-red-500"
                    : sync === "saving" ? "animate-pulse-dot bg-sky-500"
                    : "bg-emerald-500")} />
                {!dbOk ? "DB offline"
                  : sync === "saving" ? "Saving…"
                  : sync === "saved" ? "DB · Saved"
                  : sync === "error" ? "DB · Error"
                  : "DB · Cloud"}
              </span>
            )}
            <Link href="/hr/go-live" className={cn(
              "mr-1 hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline-flex",
              dataLock.locked ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
            )} title={dataLock.locked
              ? `Master data locked by ${dataLock.by} — only CEO / Super Admin can edit`
              : "Data-entry mode — master data is editable. Verify and lock before going live."}>
              {dataLock.locked ? <ShieldCheck className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
              {dataLock.locked ? "Data locked" : "Data entry"}
            </Link>
            <span className="mr-1 hidden items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 sm:inline-flex">
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-emerald-500" /> HRMS · Live
            </span>
            {mounted && (
              <Button variant="ghost" size="icon" aria-label="Theme" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
                {resolvedTheme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
              </Button>
            )}
            <div className="ml-1 flex items-center gap-2.5 border-l pl-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600/15 text-xs font-bold text-emerald-600">
                {user.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
              </div>
              <div className="hidden leading-tight sm:block">
                <p className="text-xs font-semibold">{user.name}</p>
                <p className="text-[10px] text-muted-foreground">{user.role}</p>
              </div>
              <Button variant="ghost" size="icon" aria-label="Logout" onClick={() => { logout(); router.push("/hr/login"); }}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] space-y-6 p-4 lg:p-6">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}

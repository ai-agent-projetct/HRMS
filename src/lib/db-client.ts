"use client";

/** Client helpers to talk to the MySQL-backed API and sync the Zustand store. */

import { useHr } from "@/stores/hr";
import type { HrState } from "@/lib/db-repo";

export interface DbHealth { ok: boolean; db?: string; host?: string; counts?: Record<string, number>; error?: string; }

export async function dbHealth(): Promise<DbHealth> {
  try {
    const r = await fetch("/api/health", { cache: "no-store" });
    return await r.json();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Fetch the full state from the database without touching the store. */
export async function dbFetchState(): Promise<HrState> {
  const r = await fetch("/api/state", { cache: "no-store" });
  const data = await r.json();
  if (!data.ok) throw new Error(data.error || "load failed");
  return data.state as HrState;
}

function applyState(s: HrState) {
  useHr.setState({
    employees: s.employees, attendance: s.attendance, advances: s.advances, deductions: s.deductions,
    weeklyPaid: s.weeklyPaid, appraisals: s.appraisals, leave: s.leave, payslipLog: s.payslipLog, transfers: s.transfers, audit: s.audit ?? [], recycleBin: s.recycleBin ?? [],
    // An empty list from the DB means the hr_users table isn't populated yet
    // (older DB, not re-seeded) — keep the local defaults rather than wiping
    // every login account out from under whoever's mid-session.
    hrUsers: s.hrUsers?.length ? s.hrUsers : useHr.getState().hrUsers,
  });
}

/** Pull the full state from the database into the store. */
export async function dbLoadIntoStore(): Promise<boolean> {
  applyState(await dbFetchState());
  return true;
}

/** Opaque marker of the store's data at a point in time. */
export type StoreMark = readonly unknown[];

/** Take a marker to compare against later. */
export function storeMark(): StoreMark {
  return snapshot(useHr.getState());
}

/**
 * Hydrate on startup, but never at the cost of work already in progress.
 *
 * Startup does a health check and then a full state fetch — against a cloud
 * database that is seconds of round-trip away, and the user can type through
 * all of it. Applying the response blindly would silently wipe those edits.
 * So the caller marks the store *before the first request goes out*, and we
 * skip the overwrite if anything changed since; auto-sync then pushes the
 * local copy up instead.
 *
 * Returns true if the database copy was applied.
 */
export async function dbHydrateIfUntouched(since: StoreMark): Promise<boolean> {
  const state = await dbFetchState();
  const now = snapshot(useHr.getState());
  if (now.length !== since.length || !now.every((v, i) => v === since[i])) return false;
  applyState(state);
  return true;
}

/** Push the current store state to MySQL. */
export async function dbSaveFromStore(): Promise<void> {
  const s = useHr.getState();
  const payload: HrState = {
    employees: s.employees, attendance: s.attendance, advances: s.advances, deductions: s.deductions,
    weeklyPaid: s.weeklyPaid, appraisals: s.appraisals, leave: s.leave, payslipLog: s.payslipLog, transfers: s.transfers, audit: s.audit, recycleBin: s.recycleBin,
    hrUsers: s.hrUsers,
  };
  const r = await fetch("/api/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await r.json();
  if (!data.ok) throw new Error(data.error || "save failed");
}

export async function dbSeed(): Promise<void> {
  const r = await fetch("/api/seed", { method: "POST" });
  const data = await r.json();
  if (!data.ok) throw new Error(data.error || "seed failed");
}

/* ------------------------------------------------------------------ *
 * Auto-sync: keep the database in step with the store.
 *
 * Without this, edits live only in the browser (Zustand + localStorage)
 * until someone visits the Database page and presses "Save to DB" — so an
 * employee added on one machine never reaches the cloud, and is silently
 * discarded on the next reload when the store is re-hydrated from the DB.
 * ------------------------------------------------------------------ */

export type SyncStatus = "idle" | "saving" | "saved" | "error";

/** Store keys that represent persisted data. `user` is session-only, so a
 *  login or logout must not trigger a write. */
const SYNCED_KEYS = [
  "employees", "attendance", "advances", "deductions", "weeklyPaid",
  "appraisals", "leave", "payslipLog", "transfers", "audit", "recycleBin", "hrUsers",
] as const;

/** Debounce window — long enough that a burst of edits (typing through a
 *  form, bulk attendance) collapses into a single write. */
const DEBOUNCE_MS = 1200;

function snapshot(s: ReturnType<typeof useHr.getState>) {
  return SYNCED_KEYS.map((k) => s[k as keyof typeof s]);
}

/**
 * Starts pushing store changes to the database. Returns an unsubscribe fn.
 *
 * `suspend()` wraps the initial DB→store hydration so it doesn't bounce
 * straight back as a write.
 */
export function startDbAutoSync(
  onStatus?: (s: SyncStatus, error?: string) => void,
  opts?: { pushOnStart?: boolean },
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight = false;
  let pending = false;      // a change arrived while a save was running
  let prev = snapshot(useHr.getState());

  const flush = async () => {
    if (inFlight) { pending = true; return; }
    inFlight = true;
    onStatus?.("saving");
    try {
      await dbSaveFromStore();
      onStatus?.("saved");
    } catch (e) {
      onStatus?.("error", e instanceof Error ? e.message : String(e));
    } finally {
      inFlight = false;
      if (pending) { pending = false; schedule(); }
    }
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, DEBOUNCE_MS);
  };

  const unsubscribe = useHr.subscribe((state) => {
    if (autoSyncSuspended) return;
    const next = snapshot(state);
    // Reference comparison: every store action replaces the arrays it edits.
    if (next.every((v, i) => v === prev[i])) return;
    prev = next;
    schedule();
  });

  // Startup skipped hydration because the store already held unsaved edits —
  // they exist only in this browser, so push them up now rather than waiting
  // for the next change.
  if (opts?.pushOnStart) schedule();

  // Don't lose the last edit if the tab closes mid-debounce.
  const onHide = () => {
    if (timer && document.visibilityState === "hidden") { clearTimeout(timer); void flush(); }
  };
  document.addEventListener("visibilitychange", onHide);

  return () => {
    if (timer) clearTimeout(timer);
    document.removeEventListener("visibilitychange", onHide);
    unsubscribe();
  };
}

let autoSyncSuspended = false;

/** Runs `fn` without the resulting store writes being synced back to the DB. */
export async function suspendAutoSync<T>(fn: () => Promise<T>): Promise<T> {
  autoSyncSuspended = true;
  try { return await fn(); } finally { autoSyncSuspended = false; }
}

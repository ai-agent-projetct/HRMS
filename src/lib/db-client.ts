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

/** Pull the full state from MySQL into the store. */
export async function dbLoadIntoStore(): Promise<boolean> {
  const r = await fetch("/api/state", { cache: "no-store" });
  const data = await r.json();
  if (!data.ok) throw new Error(data.error || "load failed");
  const s = data.state as HrState;
  useHr.setState({
    employees: s.employees, attendance: s.attendance, advances: s.advances, deductions: s.deductions,
    weeklyPaid: s.weeklyPaid, appraisals: s.appraisals, leave: s.leave, payslipLog: s.payslipLog, transfers: s.transfers, audit: s.audit ?? [], recycleBin: s.recycleBin ?? [],
  });
  return true;
}

/** Push the current store state to MySQL. */
export async function dbSaveFromStore(): Promise<void> {
  const s = useHr.getState();
  const payload: HrState = {
    employees: s.employees, attendance: s.attendance, advances: s.advances, deductions: s.deductions,
    weeklyPaid: s.weeklyPaid, appraisals: s.appraisals, leave: s.leave, payslipLog: s.payslipLog, transfers: s.transfers, audit: s.audit, recycleBin: s.recycleBin,
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

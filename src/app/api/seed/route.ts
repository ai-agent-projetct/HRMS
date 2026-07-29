import { NextResponse } from "next/server";
import { saveAll } from "@/lib/db-repo";
import { buildSeedState } from "@/lib/seed-data";

export const dynamic = "force-dynamic";

/** Loads the demo/seed workforce into MySQL (overwrites existing rows). */
export async function POST() {
  try {
    const state = buildSeedState();
    await saveAll(state);
    return NextResponse.json({ ok: true, seeded: { employees: state.employees.length, attendance: state.attendance.length, advances: state.advances.length } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

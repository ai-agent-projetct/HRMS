import { NextResponse } from "next/server";
import { saveAll } from "@/lib/db-repo";
import { query } from "@/lib/db";
import { buildSeedState } from "@/lib/seed-data";

export const dynamic = "force-dynamic";

/** Loads the demo/seed workforce into an EMPTY database only — never over real data. */
export async function POST() {
  try {
    const [{ n }] = await query<{ n: number }>("SELECT COUNT(*) AS n FROM employees");
    if (Number(n) > 0) {
      return NextResponse.json({ ok: false, error: `Database already holds ${n} employees — seeding demo data would overwrite them. Refused.` }, { status: 409 });
    }
    const state = buildSeedState();
    await saveAll(state);
    return NextResponse.json({ ok: true, seeded: { employees: state.employees.length, attendance: state.attendance.length, advances: state.advances.length } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

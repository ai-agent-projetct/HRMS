import { NextResponse } from "next/server";
import { counts } from "@/lib/db-repo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const c = await counts();
    return NextResponse.json({ ok: true, db: process.env.DB_NAME, host: process.env.DB_HOST, counts: c });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

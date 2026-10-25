import { NextResponse } from "next/server";
import { findLogin } from "@/lib/db-repo";
import { verifyPassword } from "@/lib/password";

export const dynamic = "force-dynamic";

/** Server-side sign-in: checks the password against the stored hash. Never returns the hash. */
export async function POST(req: Request) {
  try {
    const { loginId, password } = (await req.json()) as { loginId?: string; password?: string };
    if (!loginId?.trim() || !password) return NextResponse.json({ ok: false, error: "Enter your login ID and password." }, { status: 400 });
    const found = await findLogin(loginId);
    if (!found) return NextResponse.json({ ok: false, error: "No account with that login ID." }, { status: 401 });
    if (!found.account.active) return NextResponse.json({ ok: false, error: "This account has been deactivated — contact your Admin." }, { status: 403 });
    if (!verifyPassword(password, found.hash)) return NextResponse.json({ ok: false, error: "Incorrect password." }, { status: 401 });
    const { name, role } = found.account;
    return NextResponse.json({ ok: true, account: { name, role, loginId: found.account.loginId } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: `Cannot reach the database — ${e instanceof Error ? e.message : String(e)}` }, { status: 503 });
  }
}

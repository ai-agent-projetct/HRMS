import { NextResponse } from "next/server";
import { loadAll, saveAll, loadDataLock, ensureSchema, type HrState } from "@/lib/db-repo";
import { CAN_EDIT_LOCKED_ROLES, type HrRole } from "@/stores/hr";

export const dynamic = "force-dynamic";

/** Who is asking — sent by the client alongside the state it wants to save. */
interface SavePayload extends HrState {
  actor?: { loginId?: string; role?: HrRole };
}

export async function GET() {
  try {
    return NextResponse.json({ ok: true, state: await loadAll() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

/**
 * Save the full state.
 *
 * The go-live lock is enforced here, not only in the UI: once the data is
 * locked, the server refuses any write from a role that isn't CEO / Super
 * Admin. The one exception is a write that only *changes the lock itself*
 * (a CEO/Super Admin re-opening the data) — that is handled by the same role
 * check, so a locked database cannot be modified by hiding the buttons alone.
 *
 * Caveat: the actor's role is asserted by the client, because this app has no
 * server-side sessions yet. This closes the "delete the button in devtools"
 * hole and makes the lock consistent across machines; it is not a substitute
 * for real authentication, which needs a session/JWT before this is exposed
 * beyond the mill's own network.
 */
export async function PUT(req: Request) {
  try {
    await ensureSchema();
    const body = (await req.json()) as SavePayload;
    const stored = await loadDataLock();

    if (stored.locked) {
      const role = body.actor?.role;
      const allowed = !!role && CAN_EDIT_LOCKED_ROLES.includes(role);
      if (!allowed) {
        return NextResponse.json({
          ok: false,
          code: "DATA_LOCKED",
          error: `Master data was locked by ${stored.by ?? "an administrator"}${stored.at ? ` on ${stored.at}` : ""}. Only CEO or Super Admin can change it.`,
        }, { status: 423 }); // 423 Locked
      }
    }

    const { actor: _actor, ...state } = body;
    await saveAll(state);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

/**
 * Map the musters' / registers' agent codes to named agents and assign workers.
 *
 *   [DRY=1] npx tsx scripts/assign-agent-codes.ts
 *
 * - Creates any missing agent (synced to every machine via app_settings).
 * - Workers whose profile says "Agent code X (to map)" get that agent; the
 *   note is cleared. Code M = Mill → direct hire (no agent).
 * - Register-paid months whose ORISSA AG named one of these agents are tagged,
 *   so Agents & Commission history tallies with the register.
 * Target DB: db-config.json. A backup is written to backups/ first.
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import type { Agent } from "@/lib/hr-master";

Object.assign(process.env, JSON.parse(readFileSync("db-config.json", "utf8")));

// code (as written on the muster / register) → agent; null = Mill / direct hire
const CODES: Record<string, { id: string; name: string } | null> = {
  J: { id: "AGT-JAGANATH", name: "Jaganath" },
  JEGAN: { id: "AGT-JAGANATH", name: "Jaganath" },
  PG: { id: "AGT-PROMOD", name: "Promod Guru" },
  PS: { id: "AGT-SENDIL", name: "P Sendil Kumar" },
  T: { id: "AGT-TAMIL", name: "Tamil" },
  CS: { id: "AGT-CHANDRA", name: "ChandraSekar" },
  GB: { id: "AGT-GOBI", name: "Gobinath" },
  M: null,
  MILL: null,
};
const NOTE = /^Agent code (\S+) \(to map\)$/;

async function main() {
  const dry = process.env.DRY === "1";
  const repo = await import("@/lib/db-repo");
  const st = await repo.loadAll();
  if (!dry) {
    mkdirSync("backups", { recursive: true });
    writeFileSync(`backups/db-before-agents-${new Date().toISOString().replace(/[:.]/g, "-")}.json`, JSON.stringify(st));
  }

  const agents: Agent[] = [...(st.customAgents ?? [])];
  for (const a of Object.values(CODES)) {
    if (a && !agents.some((x) => x.id === a.id)) agents.push({ id: a.id, name: a.name, phone: "", place: "", commissionPerWorker: 0, active: true });
  }

  const assigned: Record<string, number> = {};
  const left: string[] = [];
  for (const e of st.employees) {
    const m = NOTE.exec(e.referredBy ?? "");
    if (!m) continue;
    const code = m[1].toUpperCase();
    if (!(code in CODES)) { left.push(`${e.id}:${code}`); continue; }
    const a = CODES[code];
    e.agentId = a?.id;
    e.referredBy = undefined;
    assigned[a?.name ?? "Mill (direct)"] = (assigned[a?.name ?? "Mill (direct)"] ?? 0) + 1;
  }

  // history: register months where this worker's agent is now known
  const byId = new Map(st.employees.map((e) => [e.id, e]));
  let tagged = 0;
  for (const a of st.attendance) {
    const p = a.paid;
    if (!p || p.agentId || !(p.agent > 0) || !String(p.src).includes("ORISSA")) continue;
    const ag = byId.get(a.empId)?.agentId;
    if (ag && ag.startsWith("AGT-") && ag !== "AGT-GUNA" && ag !== "AGT-RAJESH") { p.agentId = ag; tagged++; }
  }

  console.log({ agentsNow: agents.map((a) => a.name), assigned, historyMonthsTagged: tagged, stillUnmapped: left });
  if (dry) { console.log("DRY RUN — nothing written."); process.exit(0); }
  await repo.saveAll({ employees: st.employees, attendance: st.attendance, customAgents: agents });
  console.log("✔ saved");
  process.exit(0);
}
main().catch((e) => { console.error("FAILED:", e); process.exit(1); });

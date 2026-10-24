/**
 * Snapshot / restore the whole HR database.
 *
 *   ACTION=dump    [TARGET=local]  OUT=backups/x.json  npx tsx scripts/db-snapshot.ts
 *   ACTION=restore [TARGET=local]  IN=backups/x.json   npx tsx scripts/db-snapshot.ts
 *
 * TARGET=local → .env.local (local MySQL); otherwise db-config.json (cloud).
 * Restore replaces every table (each one atomically) with the snapshot.
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { config } from "dotenv";

if (process.env.TARGET === "local") config({ path: ".env.local", override: true });
else Object.assign(process.env, JSON.parse(readFileSync("db-config.json", "utf8")));

async function main() {
  const repo = await import("@/lib/db-repo");
  const action = process.env.ACTION;
  if (action === "dump") {
    const st = await repo.loadAll();
    mkdirSync("backups", { recursive: true });
    writeFileSync(process.env.OUT!, JSON.stringify(st));
    console.log(`✔ dumped ${st.employees.length} employees, ${st.attendance.length} attendance, ${st.dailyAttendance.length} day marks → ${process.env.OUT}`);
  } else if (action === "restore") {
    const st = JSON.parse(readFileSync(process.env.IN!, "utf8"));
    await repo.applyTypeFixes();
    await repo.saveAll(st);
    console.log(`✔ restored ${st.employees.length} employees into ${process.env.DB_HOST}/${process.env.DB_NAME}`);
  } else throw new Error("ACTION must be dump or restore");
  process.exit(0);
}
main().catch((e) => { console.error("FAILED:", e.message ?? e); process.exit(1); });

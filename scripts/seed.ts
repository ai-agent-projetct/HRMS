/** Loads the seed workforce into MySQL. Run: npm run db:seed */
import { config } from "dotenv";
config({ path: ".env.local" });

import { saveAll } from "@/lib/db-repo";
import { buildSeedState } from "@/lib/seed-data";
import { getPool, query } from "@/lib/db";

async function main() {
  const [{ n }] = await query<{ n: number }>("SELECT COUNT(*) AS n FROM employees");
  if (Number(n) > 0 && process.env.FORCE !== "1") {
    console.error(`Refused: database already holds ${n} employees. Seeding demo data would overwrite them (FORCE=1 to override).`);
    await getPool().end();
    process.exit(1);
  }
  const state = buildSeedState();
  await saveAll(state);
  console.log(`✔ Seeded ${state.employees.length} employees, ${state.attendance.length} attendance rows, ${state.advances.length} advances, ${state.leave.length} leave requests.`);
  await getPool().end();
}
main().catch((e) => { console.error("Seed failed:", e.message); process.exit(1); });

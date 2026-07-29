/** Loads the seed workforce into MySQL. Run: npm run db:seed */
import { config } from "dotenv";
config({ path: ".env.local" });

import { saveAll } from "@/lib/db-repo";
import { buildSeedState } from "@/lib/seed-data";
import { getPool } from "@/lib/db";

async function main() {
  const state = buildSeedState();
  await saveAll(state);
  console.log(`✔ Seeded ${state.employees.length} employees, ${state.attendance.length} attendance rows, ${state.advances.length} advances, ${state.leave.length} leave requests.`);
  await getPool().end();
}
main().catch((e) => { console.error("Seed failed:", e.message); process.exit(1); });

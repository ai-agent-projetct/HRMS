/** Creates the LoomHR schema in MySQL. Run: npm run db:migrate */
import { config } from "dotenv";
config({ path: ".env.local" });

import { ensureSchema } from "@/lib/db-repo";
import { getPool } from "@/lib/db";

async function main() {
  await ensureSchema();
  console.log("✔ Schema created / verified in database:", process.env.DB_NAME);
  await getPool().end();
}
main().catch((e) => { console.error("Migrate failed:", e.message); process.exit(1); });

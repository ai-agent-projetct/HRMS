/**
 * One-off: the importer filled gaps with made-up values — DOB "1995-01-01"
 * (every such worker showed age 31) and name@company.in e-mails. Blank them.
 *   npx tsx scripts/fix-placeholders.ts            (db-config.json)
 *   TARGET=local npx tsx scripts/fix-placeholders.ts  (.env.local)
 */
import { readFileSync } from "fs";
import { config } from "dotenv";

if (process.env.TARGET === "local") config({ path: ".env.local" });
else Object.assign(process.env, JSON.parse(readFileSync("db-config.json", "utf8")));

async function main() {
  const { query } = await import("@/lib/db");
  const r = await query("UPDATE employees SET dob = '' WHERE dob = '1995-01-01'");
  const m = await query("UPDATE employees SET email = '' WHERE email LIKE '%@company.in'");
  const n = (x: unknown) => (x as { affectedRows?: number }).affectedRows;
  console.log("blanked placeholder DOB:", n(r), "· fake e-mails:", n(m));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

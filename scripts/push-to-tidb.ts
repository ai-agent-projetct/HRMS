/**
 * Copies the LoomHR dataset from the local MySQL server into TiDB Cloud.
 *
 * Reads the source from .env.local (DB_*) and the target from .env.tidb
 * (TIDB_*), so the running app keeps pointing at whichever database its own
 * .env.local names. Creates the schema on the target, then replaces each
 * table's contents with the local rows.
 *
 * Run: npm run db:push-tidb
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env.tidb" });

import mysql from "mysql2/promise";
import { SCHEMA } from "@/lib/db-schema";

/** Tables in insert order — no FKs, so table order only affects readability. */
const TABLES = [
  "employees", "attendance", "advances", "monthly_deductions",
  "weekly_payments", "appraisals", "leave_requests", "payslip_log",
  "transfer_batches", "audit_log", "recycle_bin",
];

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} — add it to .env.tidb (see .env.example)`);
  return v;
}

async function main() {
  const source = await mysql.createConnection({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "loomhr",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "loomhr",
    dateStrings: true,
  });

  const targetDb = process.env.TIDB_NAME ?? "loomhr";
  const target = await mysql.createConnection({
    host: required("TIDB_HOST"),
    port: Number(process.env.TIDB_PORT ?? 4000),
    user: required("TIDB_USER"),
    password: required("TIDB_PASSWORD"),
    ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    dateStrings: true,
    multipleStatements: false,
  });
  // Connect without a database first so a brand-new cluster works unattended.
  await target.query(
    `CREATE DATABASE IF NOT EXISTS \`${targetDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await target.changeUser({ database: targetDb });

  console.log(`→ ${process.env.DB_HOST} → ${process.env.TIDB_HOST}`);

  for (const stmt of SCHEMA) await target.query(stmt);
  console.log("✔ Schema created / verified on TiDB");

  for (const table of TABLES) {
    const [rows] = await source.query<mysql.RowDataPacket[]>(`SELECT * FROM \`${table}\``);
    await target.query(`DELETE FROM \`${table}\``);
    if (rows.length) {
      const cols = Object.keys(rows[0]);
      // JSON columns come back as objects; mysql2 needs them re-serialised.
      const values = rows.map((r) => cols.map((c) => {
        const v = r[c];
        return v !== null && typeof v === "object" ? JSON.stringify(v) : v;
      }));
      await target.query(
        `INSERT INTO \`${table}\` (${cols.map((c) => `\`${c}\``).join(",")}) VALUES ?`,
        [values],
      );
    }
    console.log(`  ${table.padEnd(20)} ${rows.length} rows`);
  }

  await source.end();
  await target.end();
  console.log("✔ Done — point .env.local at TiDB to serve from it.");
}

main().catch((e) => { console.error("Push to TiDB failed:", e.message); process.exit(1); });

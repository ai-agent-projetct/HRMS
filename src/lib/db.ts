/**
 * MySQL connection pool (mysql2/promise).
 *
 * Server-only. Reads connection settings from environment variables
 * (see .env.example). Used by the API route handlers and the migrate/seed
 * scripts. A single pool is reused across requests.
 *
 * Works against a local MySQL server and against TiDB Cloud (MySQL-compatible,
 * port 4000) for access from anywhere. TiDB Cloud requires TLS: set DB_SSL=true
 * — hosts ending in `.tidbcloud.com` enable it automatically.
 */

import mysql from "mysql2/promise";

declare global {
  // eslint-disable-next-line no-var
  var __loomhrPool: mysql.Pool | undefined;
}

/**
 * TLS options for the connection, or undefined for a plaintext local socket.
 * TiDB Cloud serves a certificate from a public CA, so Node's bundled trust
 * store verifies it without shipping a CA bundle.
 */
function sslOptions(host: string): mysql.PoolOptions["ssl"] {
  const flag = (process.env.DB_SSL ?? "").toLowerCase();
  const enabled = flag === "true" || flag === "1"
    || (flag !== "false" && flag !== "0" && host.endsWith(".tidbcloud.com"));
  if (!enabled) return undefined;
  return { minVersion: "TLSv1.2", rejectUnauthorized: true };
}

export function getPool(): mysql.Pool {
  if (!global.__loomhrPool) {
    const host = process.env.DB_HOST ?? "127.0.0.1";
    global.__loomhrPool = mysql.createPool({
      host,
      port: Number(process.env.DB_PORT ?? 3306),
      user: process.env.DB_USER ?? "loomhr",
      password: process.env.DB_PASSWORD ?? "",
      database: process.env.DB_NAME ?? "loomhr",
      ssl: sslOptions(host),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      namedPlaceholders: true,
      dateStrings: true,
    });
  }
  return global.__loomhrPool;
}

/** Run a query and return typed rows. */
export async function query<T = Record<string, unknown>>(sql: string, params?: unknown): Promise<T[]> {
  const [rows] = await getPool().query(sql, params as never);
  return rows as T[];
}

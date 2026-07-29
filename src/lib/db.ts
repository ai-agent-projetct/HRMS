/**
 * MySQL connection pool (mysql2/promise).
 *
 * Server-only. Reads connection settings from environment variables
 * (see .env.example). Used by the API route handlers and the migrate/seed
 * scripts. A single pool is reused across requests.
 */

import mysql from "mysql2/promise";

declare global {
  // eslint-disable-next-line no-var
  var __loomhrPool: mysql.Pool | undefined;
}

export function getPool(): mysql.Pool {
  if (!global.__loomhrPool) {
    global.__loomhrPool = mysql.createPool({
      host: process.env.DB_HOST ?? "127.0.0.1",
      port: Number(process.env.DB_PORT ?? 3306),
      user: process.env.DB_USER ?? "loomhr",
      password: process.env.DB_PASSWORD ?? "",
      database: process.env.DB_NAME ?? "loomhr",
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

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (_db) return _db;

  const pool = new pg.Pool({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT ?? 5432),
    user: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
    query_timeout: 15000,
    ssl:
      process.env.DATABASE_SSL === "1" ? { rejectUnauthorized: false } : false,
  });

  _db = drizzle(pool, { schema, logger: process.env.DATABASE_LOGGING === "1" });
  return _db;
}

export type Db = ReturnType<typeof getDb>;

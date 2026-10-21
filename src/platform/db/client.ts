import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { parseEnv } from "../config/env.ts";
import { logger } from "../logging/logger.ts";

export function createDb(url: string) {
  // No connectionTimeoutMillis: pg-pool applies it to waiting for a free connection too, so a busy
  // pool would fail requests. /readyz bounds its own checks instead.
  const pool = new Pool({ connectionString: url });
  // Without a listener, an idle connection the server drops (restart, outage) crashes the process.
  // Log only the message: pg-pool attaches the whole client to the error.
  pool.on("error", (error) =>
    logger.error({ reason: error.message }, "idle database connection lost"),
  );
  return { db: drizzle({ client: pool }), pool };
}

export type Db = ReturnType<typeof createDb>["db"];
// A transaction runs the same queries as the database it belongs to.
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

// Created on first use, never at import: next build runs without DATABASE_URL.
let shared: ReturnType<typeof createDb> | undefined;

function getShared() {
  shared ??= createDb(parseEnv(process.env).DATABASE_URL);
  return shared;
}

export function getPool() {
  return getShared().pool;
}

export function getDb() {
  return getShared().db;
}

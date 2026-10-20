import type { Pool } from "pg";
import { PgBoss } from "pg-boss";
import { getPool } from "../db/client.ts";

const CHECK_TIMEOUT_MS = 3000;

// A check that throws or outlasts the timeout counts as down.
async function passes(check: () => Promise<boolean>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(resolve, CHECK_TIMEOUT_MS, false);
  });
  try {
    return await Promise.race([check(), timeout]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Whether the database answers and the pg-boss schema is installed in it. */
export async function checkReadiness(pool: Pool = getPool()) {
  // Never started: it only borrows the pool to look for its schema.
  const boss = new PgBoss({
    db: { executeSql: (text, values) => pool.query(text, values) },
  });
  const [database, queue] = await Promise.all([
    passes(async () => {
      await pool.query("select 1");
      return true;
    }),
    passes(() => boss.isInstalled()),
  ]);
  return { ok: database && queue, checks: { database, queue } };
}

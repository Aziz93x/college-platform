import type { Pool } from "pg";
import packageJson from "../../../../package.json" with { type: "json" };
import { type Db, getDb, getPool } from "../../../platform/db/client.ts";
import { checkReadiness } from "../../../platform/health/readiness.ts";
import { workerState } from "../domain/worker.ts";
import { lastBeat } from "./heartbeat.ts";

// The system's state as the system page and the console show it (ADR-0029): the readiness checks,
// how long the database takes to answer, the worker's last beat, the database's size, the version
// that runs and since when. A check that fails reads as down, never as an error of the page.
export async function systemStatus(
  now = new Date(),
  pool: Pool = getPool(),
  db: Db = getDb(),
) {
  const { checks } = await checkReadiness(pool);
  const timed = async () => {
    const started = performance.now();
    await pool.query("select 1");
    return Math.round(performance.now() - started);
  };
  const [latencyMs, beat, databaseBytes] = await Promise.all([
    checks.database ? timed().catch(() => undefined) : undefined,
    lastBeat(db).catch(() => undefined),
    pool
      .query<{ bytes: string }>(
        "select pg_database_size(current_database()) as bytes",
      )
      .then(({ rows }) => Number(rows[0]?.bytes))
      .catch(() => undefined),
  ]);
  return {
    database: checks.database,
    latencyMs,
    queue: checks.queue,
    worker: workerState(beat, now),
    lastBeat: beat,
    databaseBytes,
    version: packageJson.version,
    node: process.versions.node,
    upSince: new Date(now.getTime() - process.uptime() * 1000),
  };
}

import { desc, sql } from "drizzle-orm";
import { type Db, getDb } from "../../../platform/db/client.ts";
import { workerHeartbeats } from "./schema.ts";

const WORKER = "worker";

// The worker's beat, written by its heartbeat job each minute (ADR-0029).
export async function recordBeat(db: Db = getDb()) {
  await db
    .insert(workerHeartbeats)
    .values({ worker: WORKER })
    .onConflictDoUpdate({
      target: workerHeartbeats.worker,
      set: { beatAt: sql`now()` },
    });
}

// When the worker last beat; none before its first.
export async function lastBeat(db: Db = getDb()) {
  const [row] = await db
    .select({ at: workerHeartbeats.beatAt })
    .from(workerHeartbeats)
    .orderBy(desc(workerHeartbeats.beatAt))
    .limit(1);
  return row?.at;
}

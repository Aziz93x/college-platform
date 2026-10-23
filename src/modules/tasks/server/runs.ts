import { and, asc, desc, eq, lt, ne, or, sql } from "drizzle-orm";
import { type Db, getDb, type Tx } from "../../../platform/db/client.ts";
import { terms } from "../../terms/index.ts";
import type { GenerationReason } from "../domain/status.ts";
import { generateTerm } from "./generate.ts";
import { generationRuns } from "./schema.ts";

// How long a run may stay running before another worker takes it over: one that stopped mid-run
// leaves it so, and generating again is safe (Step 20).
const STALE = sql`now() - interval '15 minutes'`;

// Queues a pass of the engine over a term's tasks, which the worker runs within the minute: after
// its framework is published, its SS01 applied or rolled back, or one of its sections transferred
// or the transfer cancelled (Step 20).
export async function queueGeneration(
  collegeId: string,
  termId: string,
  reason: GenerationReason,
  db: Db | Tx = getDb(),
) {
  await db.insert(generationRuns).values({ collegeId, termId, reason });
}

// Queues a pass over every term not yet closed, of every college: the nightly one, which reaches
// those who began or stopped holding a role, and hands a section's work still to do to the trainer
// a transfer gives it from the week the transfer takes effect.
export async function queueOpenTerms(db: Db = getDb()) {
  const open = await db
    .select({ collegeId: terms.collegeId, termId: terms.id })
    .from(terms)
    .where(ne(terms.status, "closed"));
  if (open.length === 0) return 0;
  await db
    .insert(generationRuns)
    .values(open.map((term) => ({ ...term, reason: "daily" as const })));
  return open.length;
}

// The run waiting longest, or one left running too long, now the caller's; none when none waits.
async function claim(db: Db) {
  return db.transaction(async (tx) => {
    const [next] = await tx
      .select({
        id: generationRuns.id,
        collegeId: generationRuns.collegeId,
        termId: generationRuns.termId,
        reason: generationRuns.reason,
      })
      .from(generationRuns)
      .where(
        or(
          eq(generationRuns.status, "queued"),
          and(
            eq(generationRuns.status, "running"),
            lt(generationRuns.startedAt, STALE),
          ),
        ),
      )
      .orderBy(asc(generationRuns.queuedAt), asc(generationRuns.id))
      .limit(1)
      .for("update", { skipLocked: true });
    if (!next) return undefined;
    await tx
      .update(generationRuns)
      .set({ status: "running", startedAt: sql`now()`, done: 0, total: null })
      .where(eq(generationRuns.id, next.id));
    return next;
  });
}

// Runs the queued passes one after another until none waits, each writing how far it has got and
// then what it did, or why it failed: a later pass, or the nightly one, does what a failed one left
// undone. Gives how many it ran.
export async function runQueued(
  db: Db = getDb(),
  now: () => Date = () => new Date(),
) {
  let ran = 0;
  for (let run = await claim(db); run; run = await claim(db)) {
    const id = run.id;
    try {
      const result = await generateTerm(run.collegeId, run.termId, run.reason, {
        at: now(),
        db,
        progress: (done, total) =>
          db
            .update(generationRuns)
            .set({ done, total })
            .where(eq(generationRuns.id, id)),
      });
      await db
        .update(generationRuns)
        .set({
          status: "done",
          finishedAt: sql`now()`,
          ...(result && {
            total: result.total,
            done: result.total,
            created: result.created,
            updated: result.updated,
            reassigned: result.reassigned,
            cancelled: result.cancelled,
          }),
        })
        .where(eq(generationRuns.id, id));
    } catch (error) {
      await db
        .update(generationRuns)
        .set({
          status: "failed",
          finishedAt: sql`now()`,
          error: (error as Error).message,
        })
        .where(eq(generationRuns.id, id));
    }
    ran += 1;
  }
  return ran;
}

// The latest pass over a term's tasks, for the page that shows it.
export async function latestRun(
  collegeId: string,
  termId: string,
  db: Db = getDb(),
) {
  const [run] = await db
    .select({
      status: generationRuns.status,
      reason: generationRuns.reason,
      total: generationRuns.total,
      done: generationRuns.done,
      created: generationRuns.created,
      updated: generationRuns.updated,
      reassigned: generationRuns.reassigned,
      cancelled: generationRuns.cancelled,
      queuedAt: generationRuns.queuedAt,
      finishedAt: generationRuns.finishedAt,
    })
    .from(generationRuns)
    .where(
      and(
        eq(generationRuns.collegeId, collegeId),
        eq(generationRuns.termId, termId),
      ),
    )
    .orderBy(desc(generationRuns.queuedAt), desc(generationRuns.id))
    .limit(1);
  return run;
}

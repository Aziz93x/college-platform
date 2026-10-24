import { and, asc, desc, eq, gte, lt, ne, or, sql } from "drizzle-orm";
import { type Db, getDb, type Tx } from "../../../platform/db/client.ts";
import { writeAudit } from "../../audit/index.ts";
import { terms } from "../../terms/index.ts";
import type { GenerationReason } from "../domain/status.ts";
import { generateTerm } from "./generate.ts";
import { generationRuns } from "./schema.ts";

// How long a run may stay running before another worker takes it over: one that stopped mid-run
// leaves it so, and generating again is safe (Step 20).
const STALE = sql`now() - interval '15 minutes'`;

// Queues a pass of the engine over a term's tasks, which the worker runs within the minute: after
// its framework is published, its SS01 applied or rolled back, one of its sections transferred or
// the transfer cancelled (Step 20), or its exam periods changed. Gives the pass's id, which a quick
// request runs at once (runNow()).
export async function queueGeneration(
  collegeId: string,
  termId: string,
  reason: GenerationReason,
  db: Db | Tx = getDb(),
) {
  const [run] = await db
    .insert(generationRuns)
    .values({ collegeId, termId, reason })
    .returning({ id: generationRuns.id });
  return run.id;
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

type Run = {
  id: string;
  collegeId: string;
  termId: string;
  reason: GenerationReason;
};
const runColumns = {
  id: generationRuns.id,
  collegeId: generationRuns.collegeId,
  termId: generationRuns.termId,
  reason: generationRuns.reason,
};

// One claim at a time on a term's passes, held until the claim's transaction ends. A pass is
// claimed only while no other pass of its term is running, so two passes of one term never run at
// once, whichever process runs them: one that read its sources before a quick request was kept
// would otherwise cancel the request's tasks that another pass had just made (lead review D,
// proposal 7). A pass left running too long counts as stopped.
async function claimable(tx: Tx, run: Run) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`generation:${run.termId}`}, 0))`,
  );
  const [running] = await tx
    .select({ id: generationRuns.id })
    .from(generationRuns)
    .where(
      and(
        eq(generationRuns.termId, run.termId),
        ne(generationRuns.id, run.id),
        eq(generationRuns.status, "running"),
        gte(generationRuns.startedAt, STALE),
      ),
    )
    .limit(1);
  if (running) return false;
  await tx
    .update(generationRuns)
    .set({ status: "running", startedAt: sql`now()`, done: 0, total: null })
    .where(eq(generationRuns.id, run.id));
  return true;
}

// How many waiting passes one claim considers, the longest waiting first: those of a term with a
// pass running are passed over until it ends.
const CLAIM_BATCH = 20;

// The run waiting longest, or one left running too long, of a term with no other pass running, now
// the caller's; none when none waits.
async function claim(db: Db) {
  return db.transaction(async (tx) => {
    const waiting = await tx
      .select(runColumns)
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
      .limit(CLAIM_BATCH)
      .for("update", { skipLocked: true });
    for (const run of waiting) {
      if (await claimable(tx, run)) return run;
    }
    return undefined;
  });
}

// Why a pass failed, as the system page shows it: the database's own words, not the statement
// drizzle wraps them in, which would show its values too (lead review D).
const reasonOf = (error: unknown) =>
  error instanceof Error
    ? error.cause instanceof Error
      ? error.cause.message
      : error.message
    : String(error);

// Runs a claimed pass, writing how far it has got and then what it did, or why it failed.
async function execute(db: Db, run: Run, now: () => Date) {
  try {
    const result = await generateTerm(run.collegeId, run.termId, run.reason, {
      at: now(),
      db,
      progress: (done, total) =>
        db
          .update(generationRuns)
          .set({ done, total })
          .where(eq(generationRuns.id, run.id)),
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
      .where(eq(generationRuns.id, run.id));
    return "done" as const;
  } catch (error) {
    await db
      .update(generationRuns)
      .set({
        status: "failed",
        finishedAt: sql`now()`,
        error: reasonOf(error),
      })
      .where(eq(generationRuns.id, run.id));
    return "failed" as const;
  }
}

// Runs the queued passes one after another until none waits: a later pass, or the nightly one,
// does what a failed one left undone. Gives how many it ran.
export async function runQueued(
  db: Db = getDb(),
  now: () => Date = () => new Date(),
) {
  let ran = 0;
  for (let run = await claim(db); run; run = await claim(db)) {
    await execute(db, run, now);
    ran += 1;
  }
  return ran;
}

// Runs one queued pass now, in the request that queued it, as the worker runs one: a quick
// request's, which makes its tasks at once (ADR-0030). It is left to the worker when the worker has
// taken it or another pass of its term is running; when it fails, it is recorded so, and the same
// pass is queued again for the worker, which runs it within the minute (lead review D, M2). Gives
// "done", or "pending" for a pass the worker runs.
export async function runNow(
  runId: string,
  { db = getDb(), now = () => new Date() }: { db?: Db; now?: () => Date } = {},
) {
  const run = await db.transaction(async (tx) => {
    const [queued] = await tx
      .select(runColumns)
      .from(generationRuns)
      .where(
        and(eq(generationRuns.id, runId), eq(generationRuns.status, "queued")),
      )
      .for("update");
    return queued && (await claimable(tx, queued)) ? queued : undefined;
  });
  if (!run) return "pending" as const;
  if ((await execute(db, run, now)) === "done") return "done" as const;
  await queueGeneration(run.collegeId, run.termId, run.reason, db);
  return "pending" as const;
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

// The college's passes, the latest first, with their term's name and state: what the system page
// lists (ADR-0029).
export async function listRuns(
  collegeId: string,
  options: { limit?: number } = {},
  db: Db = getDb(),
) {
  return db
    .select({
      id: generationRuns.id,
      termId: generationRuns.termId,
      termName: terms.name,
      termStatus: terms.status,
      reason: generationRuns.reason,
      status: generationRuns.status,
      total: generationRuns.total,
      done: generationRuns.done,
      created: generationRuns.created,
      updated: generationRuns.updated,
      reassigned: generationRuns.reassigned,
      cancelled: generationRuns.cancelled,
      error: generationRuns.error,
      queuedAt: generationRuns.queuedAt,
      finishedAt: generationRuns.finishedAt,
    })
    .from(generationRuns)
    .innerJoin(terms, eq(terms.id, generationRuns.termId))
    .where(eq(generationRuns.collegeId, collegeId))
    .orderBy(desc(generationRuns.queuedAt), desc(generationRuns.id))
    .limit(options.limit ?? 20);
}

// Runs a failed pass again, as a new pass over its term that an admin caused (ADR-0029): only the
// latest pass of a term still open, since a later one already does what the failed one left. Records
// generation.rerun on the term.
export async function rerunPass(
  collegeId: string,
  runId: string,
  change: { actorId: string; ip?: string | null; userAgent?: string | null },
  db: Db = getDb(),
): Promise<"queued" | "notFound" | "notFailed" | "superseded" | "closed"> {
  return db.transaction(async (tx) => {
    const [run] = await tx
      .select({
        termId: generationRuns.termId,
        status: generationRuns.status,
        termStatus: terms.status,
      })
      .from(generationRuns)
      .innerJoin(terms, eq(terms.id, generationRuns.termId))
      .where(
        and(
          eq(generationRuns.id, runId),
          eq(generationRuns.collegeId, collegeId),
        ),
      )
      .for("update", { of: generationRuns });
    if (!run) return "notFound";
    if (run.status !== "failed") return "notFailed";
    if (run.termStatus === "closed") return "closed";
    // Later in the lists' order, compared in the database: a Date read back keeps milliseconds
    // only, and the run itself would come after it.
    const [later] = await tx
      .select({ id: generationRuns.id })
      .from(generationRuns)
      .where(
        and(
          eq(generationRuns.termId, run.termId),
          sql`(${generationRuns.queuedAt}, ${generationRuns.id}) > (select queued_at, id from generation_runs where id = ${runId})`,
        ),
      )
      .limit(1);
    if (later) return "superseded";
    await queueGeneration(collegeId, run.termId, "admin", tx);
    await writeAudit(
      {
        collegeId,
        actorId: change.actorId,
        action: "generation.rerun",
        entityType: "term",
        entityId: run.termId,
        ip: change.ip,
        userAgent: change.userAgent,
      },
      tx,
    );
    return "queued";
  });
}

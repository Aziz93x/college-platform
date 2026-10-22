import { eq } from "drizzle-orm";
import {
  generationRuns,
  latestRun,
  queueGeneration,
  runQueued,
} from "../../../src/modules/tasks/index.ts";
import { activeTerm } from "../../../src/modules/terms/index.ts";
import type { Db } from "../../../src/platform/db/client.ts";

// The demo term's tasks (Step 20): the pass of the generation engine its framework's publication
// queued, run as the worker runs it, on the day the term has reached. It comes after Rayat's
// reports and the transfers, so its tasks are for the trainers who teach each section this week.
// Written once, while the term has had no pass.
export async function seedDemoTasks({ db }: { db: Db }, collegeId: string) {
  const term = await activeTerm(collegeId, db);
  if (!term) throw new Error("seed:demo: the demo term is missing");
  const [ran] = await db
    .select({ id: generationRuns.id })
    .from(generationRuns)
    .where(eq(generationRuns.termId, term.id))
    .limit(1);
  if (ran) return;
  await queueGeneration(collegeId, term.id, "framework", db);
  await runQueued(db);
  const run = await latestRun(collegeId, term.id, db);
  if (run?.status !== "done") {
    throw new Error(
      `seed:demo: the term's tasks were not generated (${run?.status})`,
    );
  }
}

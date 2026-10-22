import type { Logger } from "pino";
import { queueOpenTerms, runQueued } from "../../src/modules/tasks/index.ts";
import type { Db } from "../../src/platform/db/client.ts";

// Each minute, the queued passes of the generation engine run, one after another (Step 20).
export function taskGeneration(logger: Logger, db: Db) {
  return async () => {
    const runs = await runQueued(db);
    if (runs > 0) logger.info({ runs }, "task generation");
  };
}

// Each night, a pass over every term not yet closed: it reaches whoever began or stopped holding a
// role, and hands a section's work still to do to the trainer a transfer gives it from the week the
// transfer takes effect.
export function nightlyTaskGeneration(logger: Logger, db: Db) {
  return async () => {
    const terms = await queueOpenTerms(db);
    logger.info({ terms }, "nightly task generation queued");
  };
}

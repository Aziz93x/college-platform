import type { Job } from "pg-boss";
import type { Logger } from "pino";
import { recordBeat } from "../../src/modules/system/index.ts";
import type { Db } from "../../src/platform/db/client.ts";

// One line per job proves the schedule and the queue both run, and the beat it records tells the
// system page the worker does (ADR-0029).
export function heartbeat(logger: Logger, db: Db) {
  return async (jobs: Job[]) => {
    for (const job of jobs) {
      logger.info({ queue: job.name, jobId: job.id }, "heartbeat");
    }
    await recordBeat(db);
  };
}

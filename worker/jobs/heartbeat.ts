import type { Job } from "pg-boss";
import type { Logger } from "pino";

// One line per job proves the schedule and the queue both run.
export function heartbeat(logger: Logger) {
  return async (jobs: Job[]) => {
    for (const job of jobs) {
      logger.info({ queue: job.name, jobId: job.id }, "heartbeat");
    }
  };
}

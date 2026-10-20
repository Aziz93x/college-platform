import { type Clock, PgBoss } from "pg-boss";
import type { Logger } from "pino";
import { heartbeat } from "./jobs/heartbeat.ts";

// Docker kills a container 10 s after SIGTERM, so active jobs get 8 s to finish.
const STOP_TIMEOUT_MS = 8000;

export async function startWorker({
  databaseUrl,
  logger,
  clock,
}: {
  databaseUrl: string;
  logger: Logger;
  /** Tests pass a pg-boss TestClock to run the schedule without waiting. */
  clock?: Clock;
}) {
  const boss = new PgBoss({ connectionString: databaseUrl, clock });
  // pg-boss re-emits lost connections and job failures; with no listener, the first one crashes the worker.
  boss.on("error", (error) =>
    logger.error({ reason: error.message }, "pg-boss error"),
  );
  await boss.start();
  await boss.createQueue("heartbeat");
  await boss.schedule("heartbeat", "* * * * *");
  await boss.work("heartbeat", heartbeat(logger));
  return {
    boss,
    stop: async () => {
      await boss.stop({ graceful: true, timeout: STOP_TIMEOUT_MS });
      logger.info("worker stopped");
    },
  };
}

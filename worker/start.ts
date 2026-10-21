import { type Clock, PgBoss } from "pg-boss";
import type { Logger } from "pino";
import { createDb } from "../src/platform/db/client.ts";
import { auditRetention } from "./jobs/audit-retention.ts";
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
  // pnpm db:migrate installs and upgrades pg-boss's schema as the tables' owner; the worker's role
  // only reads and writes its rows.
  const boss = new PgBoss({
    connectionString: databaseUrl,
    clock,
    migrate: false,
  });
  // pg-boss re-emits lost connections and job failures; with no listener, the first one crashes the worker.
  boss.on("error", (error) =>
    logger.error({ reason: error.message }, "pg-boss error"),
  );
  await boss.start();
  await boss.createQueue("heartbeat");
  await boss.schedule("heartbeat", "* * * * *");
  await boss.work("heartbeat", heartbeat(logger));
  // The jobs' own reads and writes go through a pool of their own.
  const { db, pool } = createDb(databaseUrl);
  // Each night, at an hour no one works, in UTC.
  await boss.createQueue("audit-retention");
  await boss.schedule("audit-retention", "17 0 * * *");
  await boss.work("audit-retention", auditRetention(logger, db));
  return {
    boss,
    stop: async () => {
      await boss.stop({ graceful: true, timeout: STOP_TIMEOUT_MS });
      await pool.end();
      logger.info("worker stopped");
    },
  };
}

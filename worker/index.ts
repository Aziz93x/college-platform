import { type Env, parseEnv } from "../src/platform/config/env.ts";
import { logger } from "../src/platform/logging/logger.ts";
import { onStopSignal } from "./shutdown.ts";
import { startWorker } from "./start.ts";

// An invalid environment exits 1 before any connection opens.
let env: Env;
try {
  env = parseEnv(process.env);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

let worker: Awaited<ReturnType<typeof startWorker>>;
try {
  worker = await startWorker({ databaseUrl: env.DATABASE_URL, logger });
} catch (error) {
  // For example, the database is unreachable: one JSON line like every other, then exit 1.
  logger.error({ reason: (error as Error).message }, "worker failed to start");
  process.exit(1);
}

// Docker sends SIGTERM and Ctrl-C sends SIGINT.
const shutdown = onStopSignal(worker.stop, logger);
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
// Only now: until the handlers above exist, a signal kills the process without a graceful stop,
// so "worker started" promises that a signal from here on stops it gracefully.
logger.info("worker started");

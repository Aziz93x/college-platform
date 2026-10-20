import type { Logger } from "pino";

// Docker sends SIGKILL 10 s after SIGTERM: exit before it, whatever is still running,
// so the last log line is written and the exit code says how the stop went.
const EXIT_DEADLINE_MS = 9500;

/**
 * The handler for SIGTERM and SIGINT. The first signal stops the worker, which lets running jobs
 * finish, then exits 0. The exit is explicit because a job may still hold a timer, a socket or a
 * child process after pg-boss closes its connections. A stop that fails or runs late exits 1.
 */
export function onStopSignal(
  stop: () => Promise<void>,
  logger: Logger,
  exit: (code: number) => void = (code) => process.exit(code),
) {
  let stopping = false;
  return async () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => {
      logger.error("worker stop timed out");
      exit(1);
    }, EXIT_DEADLINE_MS);
    try {
      await stop();
      exit(0);
    } catch (error) {
      logger.error({ reason: (error as Error).message }, "worker stop failed");
      exit(1);
    } finally {
      clearTimeout(deadline);
    }
  };
}

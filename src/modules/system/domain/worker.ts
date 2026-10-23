// The worker beats each minute (worker/start.ts): one not seen for three has stopped, or lost the
// database (ADR-0029).
export const WORKER_LATE_MS = 3 * 60_000;

export type WorkerState = "running" | "late" | "never";

// The worker's state from its last beat, at a moment.
export function workerState(beat: Date | undefined, now: Date): WorkerState {
  if (!beat) return "never";
  return now.getTime() - beat.getTime() > WORKER_LATE_MS ? "late" : "running";
}

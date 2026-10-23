import { expect, it } from "vitest";
import { WORKER_LATE_MS, workerState } from "./worker.ts";

const now = new Date("2026-10-23T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

it("names a worker that never beat, one that beat within three minutes, and one late", () => {
  expect(workerState(undefined, now)).toBe("never");
  expect(workerState(ago(60_000), now)).toBe("running");
  expect(workerState(ago(WORKER_LATE_MS), now)).toBe("running");
  expect(workerState(ago(WORKER_LATE_MS + 1), now)).toBe("late");
});

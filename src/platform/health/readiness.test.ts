import type { Pool } from "pg";
import { afterEach, expect, test, vi } from "vitest";
import { checkReadiness } from "./readiness.ts";

afterEach(() => {
  vi.useRealTimers();
});

test("a database that never answers counts as down after about 3 s", async () => {
  vi.useFakeTimers();
  const hanging = { query: () => new Promise(() => {}) } as unknown as Pool;

  const result = checkReadiness(hanging);
  await vi.advanceTimersByTimeAsync(3000);

  await expect(result).resolves.toEqual({
    ok: false,
    checks: { database: false, queue: false },
  });
});

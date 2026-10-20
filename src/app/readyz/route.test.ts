import { beforeEach, expect, test, vi } from "vitest";
import { GET } from "./route.ts";

const mocks = vi.hoisted(() => ({ checkReadiness: vi.fn(), warn: vi.fn() }));

// The route runs here without a request, so connection() and the request logger are stubbed.
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/platform/health/readiness", () => ({
  checkReadiness: mocks.checkReadiness,
}));
vi.mock("@/platform/logging/request-logger", () => ({
  getRequestLogger: async () => ({ warn: mocks.warn }),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

test("answers 200 when every check passes", async () => {
  const ready = { ok: true, checks: { database: true, queue: true } };
  mocks.checkReadiness.mockResolvedValue(ready);

  const response = await GET();

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(ready);
  expect(mocks.warn).not.toHaveBeenCalled();
});

test("answers 503 and logs the checks when one fails", async () => {
  const down = { ok: false, checks: { database: false, queue: false } };
  mocks.checkReadiness.mockResolvedValue(down);

  const response = await GET();

  expect(response.status).toBe(503);
  expect(await response.json()).toEqual(down);
  expect(mocks.warn).toHaveBeenCalledWith(down.checks, "not ready");
});

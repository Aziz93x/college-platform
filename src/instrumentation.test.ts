import { afterEach, expect, test, vi } from "vitest";
import { logger } from "@/platform/logging/logger";
import { onRequestError } from "./instrumentation";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

test("logs a server error with the request's id, leaving out the query", async () => {
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
  const error = vi.spyOn(logger, "error").mockImplementation(() => {});
  const thrown = new Error("relation does not exist");

  await onRequestError(
    thrown,
    {
      path: "/reset?token=secret",
      method: "GET",
      headers: { "x-request-id": "0b5e2a4c-request" },
    },
    {
      routerKind: "App Router",
      routePath: "/reset/page",
      routeType: "render",
      revalidateReason: undefined,
    },
  );

  expect(error).toHaveBeenCalledWith(
    {
      requestId: "0b5e2a4c-request",
      method: "GET",
      path: "/reset",
      routePath: "/reset/page",
      routeType: "render",
      err: thrown,
    },
    "request failed",
  );
});

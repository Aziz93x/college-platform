import { expect, test, vi } from "vitest";
import { getRequestLogger } from "./request-logger.ts";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "req-12345678" }),
}));

test("binds the request id that the proxy forwarded", async () => {
  expect((await getRequestLogger()).bindings()).toMatchObject({
    requestId: "req-12345678",
  });
});

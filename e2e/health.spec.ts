import { expect, test } from "@playwright/test";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

test("/healthz says the process is alive", async ({ request }) => {
  const response = await request.get("/healthz");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
  expect(response.headers()["x-request-id"]).toMatch(UUID);
});

test("/readyz says the database and the queue are reachable", async ({
  request,
}) => {
  const response = await request.get("/readyz");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({
    ok: true,
    checks: { database: true, queue: true },
  });
  expect(response.headers()["x-request-id"]).toMatch(UUID);
});

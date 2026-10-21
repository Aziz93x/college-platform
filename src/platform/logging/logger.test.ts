import { randomBytes } from "node:crypto";
import { DrizzleQueryError } from "drizzle-orm";
import { expect, test } from "vitest";
import { createLogger } from "./logger.ts";

test("a child with a request id writes it on every JSON line", () => {
  const lines: string[] = [];
  const log = createLogger({ write: (line) => lines.push(line) }).child({
    requestId: "req-12345678",
  });

  log.info("first");
  log.warn({ detail: 1 }, "second");

  expect(lines).toHaveLength(2);
  for (const line of lines) {
    expect(JSON.parse(line)).toMatchObject({
      requestId: "req-12345678",
      service: "college-platform",
      time: expect.stringMatching(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      ),
    });
  }
});

test("an error keeps its query and loses the values it ran with, which can hold a session token", () => {
  const lines: string[] = [];
  const log = createLogger({ write: (line) => lines.push(line) });
  // Made at run time: a token written in the source would be a secret to the secret scan.
  const token = randomBytes(24).toString("base64url");
  const failed = new DrizzleQueryError(
    'select "id" from "sessions" where "sessions"."token" = $1',
    [token],
    new Error("Connection terminated unexpectedly"),
  );

  log.error({ err: failed, action: "signIn" }, "server action failed");

  expect(lines[0]).not.toContain(token);
  expect(JSON.parse(lines[0]).err).toMatchObject({
    message: expect.stringContaining('from "sessions"'),
    stack: expect.stringContaining("    at "),
  });
});

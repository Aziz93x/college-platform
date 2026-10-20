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

import { expect, it } from "vitest";
import messages from "../../messages/ar.json" with { type: "json" };
import { generationReasons } from "../../src/modules/tasks/domain/status.ts";

// Every cause of a generation pass has its words: in the audit log, and on /framework, where a
// finished pass says why it ran. The nightly pass is the other branch there (Audit 7, enhancement 3).
it("words every cause of a generation pass, in the log and on the framework's page", () => {
  const done = messages.framework.generation.done;
  expect(
    generationReasons.filter((reason) => !(reason in messages.audit.causes)),
  ).toEqual([]);
  expect(
    generationReasons.filter(
      (reason) => reason !== "daily" && !done.includes(` ${reason} {`),
    ),
  ).toEqual([]);
});

import { expect, it } from "vitest";
import { failedTerms } from "./attention.ts";

const run = (termId: string, status: string, termStatus = "active") => ({
  termId,
  status,
  termStatus,
});

it("counts the open terms whose latest pass failed, the passes newest first", () => {
  expect(
    failedTerms([
      run("a", "failed"),
      run("a", "done"),
      run("b", "done"),
      run("b", "failed"),
      run("c", "queued"),
      run("c", "failed"),
      run("d", "failed", "closed"),
      run("e", "failed", "draft"),
    ]),
  ).toBe(2);
  expect(failedTerms([])).toBe(0);
});

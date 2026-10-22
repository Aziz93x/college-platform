import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const e2e = join(import.meta.dirname, "../../e2e");

// The specs the production stack's smoke leaves out, each with why (Audit 5, enhancement 1). Every
// other spec runs behind Caddy, on the app's own database role, as a new journey's must
// (docs/PLAN.md, Step 41).
const outside: Record<string, string> = {
  "announcements.spec.ts":
    "each of its tests makes accounts in the database, which the stack does not publish",
  "browsers.spec.ts":
    "the safari project runs it on the stack by its own testMatch (playwright.config.ts)",
  "design.spec.ts":
    "the design catalog draws the same in every build; the checks job runs it on the standalone build",
  "design.visual.spec.ts":
    "its baselines come from CI's pinned Chromium in the checks job, and nowhere else",
  "identity-font.spec.ts":
    "the identity font's files and shaping are the build's; the checks job runs it on the standalone build",
  "streaming.spec.ts":
    "React's streaming runtime is the build's; the checks job runs it on the standalone build",
};

it("runs every spec in the production stack's smoke, or names why it stays out", () => {
  const config = readFileSync(join(e2e, "stack.config.ts"), "utf8");
  const listed = [...config.matchAll(/"([\w.-]+\.spec\.ts)"/g)].map(
    ([, spec]) => spec,
  );
  const specs = readdirSync(e2e).filter((file) => file.endsWith(".spec.ts"));
  expect(
    specs.filter((spec) => !listed.includes(spec) && !(spec in outside)),
  ).toEqual([]);
  // Each one named outside exists, and is not listed after all.
  expect(
    Object.keys(outside).filter(
      (spec) => !specs.includes(spec) || listed.includes(spec),
    ),
  ).toEqual([]);
});

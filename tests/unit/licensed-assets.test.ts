import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { expect, it } from "vitest";
import lock from "../../scripts/identity/identity.lock.json" with {
  type: "json",
};

const repo = join(import.meta.dirname, "../..");
const git = (...args: string[]) =>
  execFileSync("git", args, { cwd: repo, encoding: "utf8" });

// ADR-0004: the repository is public, so licensed fonts and fetched brand assets never enter git.
it("keeps font files and fetched brand assets out of git", () => {
  const paths = [
    "public/fonts/DINNextLTArabic-Regular.woff2",
    "src/app/fonts/DINNextLTArabic-Medium.woff",
    "src/styles/fonts/x.ttf",
    "x.otf",
    "public/brand/logo.svg",
  ];
  expect(
    git("check-ignore", "--no-index", ...paths)
      .trim()
      .split("\n"),
  ).toEqual(paths);
  expect(
    git("ls-files", "*.woff", "*.woff2", "*.ttf", "*.otf", "public/brand"),
  ).toBe("");
});

it("keeps every file identity:sync fetches out of git", () => {
  const targets = lock.files.map((file) => file.to);
  expect(
    git("check-ignore", "--no-index", ...targets)
      .trim()
      .split("\n"),
  ).toEqual(targets);
});

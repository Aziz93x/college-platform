import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const APP = join(import.meta.dirname, "../../src/app");

// CLAUDE.md asks every screen for a loading state. A page has one when its folder, or a folder
// between it and the root layout, holds loading.tsx.
describe("loading states", () => {
  it("cover every page", () => {
    const pages = readdirSync(APP, {
      recursive: true,
      encoding: "utf8",
    }).filter((path) => path === "page.tsx" || path.endsWith("/page.tsx"));
    const uncovered = pages.filter((page) => {
      let dir = dirname(page);
      while (!existsSync(join(APP, dir, "loading.tsx"))) {
        if (dir === ".") return true;
        dir = dirname(dir);
      }
      return false;
    });

    expect(pages.length).toBeGreaterThan(0);
    expect(uncovered).toEqual([]);
  });
});

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const repo = join(import.meta.dirname, "../..");
let root: string;

function write(file: string, content: string) {
  const path = join(root, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function violations() {
  const result = spawnSync(
    join(repo, "node_modules/.bin/depcruise"),
    [
      "src",
      "--config",
      join(repo, ".dependency-cruiser.cjs"),
      "--output-type",
      "json",
    ],
    { cwd: root, encoding: "utf8" },
  );
  const output: {
    summary: { violations: { from: string; rule: { name: string } }[] };
  } = JSON.parse(result.stdout);
  return output.summary.violations
    .map((v) => `${v.from}:${v.rule.name}`)
    .sort();
}

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("check:boundaries", () => {
  it("lets domain/ import only zod and its own domain files", () => {
    root = mkdtempSync(join(tmpdir(), "boundaries-"));
    symlinkSync(join(repo, "node_modules"), join(root, "node_modules"));
    copyFileSync(join(repo, "tsconfig.json"), join(root, "tsconfig.json"));
    const domain = "src/modules/probe/domain";
    write(
      `${domain}/ok.ts`,
      'import { z } from "zod";\nimport { one } from "./sibling.ts";\nexport const schema = z.number().default(one);\n',
    );
    write(`${domain}/sibling.ts`, "export const one = 1;\n");
    write(
      `${domain}/ok.test.ts`,
      'import { expect, it } from "vitest";\nimport { schema } from "./ok.ts";\nit("parses", () => expect(schema.parse(1)).toBe(1));\n',
    );
    write(
      `${domain}/types.ts`,
      'import type { Week } from "../../other/index.ts";\nexport const first = (weeks: Week[]) => weeks[0];\n',
    );
    write("src/modules/probe/server/x.ts", "export const x = 1;\n");
    write("src/platform/x.ts", "export const x = 1;\n");
    write(
      "src/modules/other/index.ts",
      "export type Week = number;\nexport const week: Week = 1;\n",
    );
    const bad: Record<string, string> = {
      pg: "pg",
      pgboss: "pg-boss",
      drizzle: "drizzle-orm",
      headers: "next/headers",
      fs: "node:fs",
      server: "../server/x.ts",
      platform: "../../../platform/x.ts",
      "pg.test": "pg",
      "platform.test": "../../../platform/x.ts",
    };
    for (const [file, specifier] of Object.entries(bad)) {
      write(`${domain}/${file}.ts`, `export * from "${specifier}";\n`);
    }
    write(
      `${domain}/runtime.ts`,
      'export { week } from "../../other/index.ts";\n',
    );
    expect(violations()).toEqual(
      [
        ...Object.keys(bad).map(
          (file) => `${domain}/${file}.ts:domain-has-no-io`,
        ),
        `${domain}/runtime.ts:domain-imports-only-types-from-modules`,
      ].sort(),
    );
  });
});

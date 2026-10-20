import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findHardcodedValues } from "../../scripts/check-hardcode.mjs";

let root: string;

function write(file: string, content: string) {
  const path = join(root, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function rules() {
  return findHardcodedValues(root).map((f) => `${f.file}:${f.rule}`);
}

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("check:hardcode", () => {
  it("passes clean source", () => {
    root = mkdtempSync(join(tmpdir(), "hardcode-"));
    write(
      "src/app/page.tsx",
      'export default () => <main className="flex-1" />;\n',
    );
    expect(rules()).toEqual([]);
  });

  it("fails on an Arabic word in src/ but not in a test file", () => {
    root = mkdtempSync(join(tmpdir(), "hardcode-"));
    write("src/app/page.tsx", "export const title = 'المهام';\n");
    write("src/app/page.test.tsx", "expect(title).toBe('المهام');\n");
    expect(rules()).toEqual(["src/app/page.tsx:arabic-text"]);
  });

  it("fails on role names compared in code", () => {
    root = mkdtempSync(join(tmpdir(), "hardcode-"));
    write(
      "src/a.ts",
      [
        'if (user.role === "head") {}',
        'if ("dean" === actor.role) {}',
        'if (roles.includes("trainer")) {}',
        'if (user.roleKey !== "admin") {}',
        "if (can(actor, permission)) {}",
      ].join("\n"),
    );
    expect(rules()).toEqual([
      "src/a.ts:role-name-comparison",
      "src/a.ts:role-name-comparison",
      "src/a.ts:role-name-comparison",
      "src/a.ts:role-name-comparison",
    ]);
  });

  it("fails on hex colors outside src/styles/tokens.css", () => {
    root = mkdtempSync(join(tmpdir(), "hardcode-"));
    write("src/styles/tokens.css", ":root { --brand: #00843d; }\n");
    write("src/app/globals.css", "body { color: #fff; }\n");
    write(
      "src/app/c.tsx",
      'const style = { color: "#1A2b3C" };\nconst href = "#main";\n',
    );
    expect(rules()).toEqual([
      "src/app/c.tsx:hex-color",
      "src/app/globals.css:hex-color",
    ]);
  });
});

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
    const roleChecks = [
      'if (user.role === "head") {}',
      'if ("dean" === actor.role) {}',
      'if (roles.includes("trainer")) {}',
      'if (user.roleKey !== "admin") {}',
      'if (hasRole(user, "admin")) {}',
      'if (user.role.name === "dean") {}',
      'if (actor.role.key !== "head") {}',
      'switch (role) { case "trainer": break; }',
      'if (["dean", "vice_dean"].includes(user.role)) {}',
      "const isHead = membership.roleId === HEAD_ROLE_ID;",
      'const rows = await db.select().from(memberships).where(eq(roles.key, "head"));',
      '  .where(and(eq(memberships.collegeId, id), eq(roles.key, "head")))',
      '  .where(inArray(roles.key, ["dean", "vice_dean"]))',
      '  .where(like(roles.key, "vice_%"))',
      "const rows = await db.execute(sql`select * from roles where key = 'dean'`);",
      'const ADMIN_ROLES = ["dean", "vice_dean"];',
      "if (ADMIN_ROLES.includes(user.role.key)) {}",
      'const adminRoles = ["dean", "vice_dean"];',
      'const ROLE_DEAN = "dean";',
      "if (role.key === ROLE_DEAN) {}",
      'const ADMIN_ROLE_KEY = "admin";',
      'if (new Set(["dean", "head"]).has(actor.role.key)) {}',
      'if (user.role.key.startsWith("vice_")) {}',
      'export enum Role { Dean = "dean", Head = "head" }',
      'export const ROLES = { DEAN: "dean", HEAD: "head" } as const;',
    ];
    write("src/a.ts", roleChecks.join("\n"));
    write(
      "src/b.ts",
      [
        "switch (actor.role.key) {",
        '  case "head":',
        "    switch (kind) {",
        '      case "upload":',
        "        break;",
        "    }",
        "    break;",
        '  case "dean":',
        "    break;",
        "}",
        "switch (kind) {",
        '  case "upload":',
        "    break;",
        "}",
      ].join("\n"),
    );
    expect(
      findHardcodedValues(root).map((f) => `${f.file}:${f.line}:${f.rule}`),
    ).toEqual([
      ...roleChecks.map((_, i) => `src/a.ts:${i + 1}:role-name-comparison`),
      "src/b.ts:2:role-name-comparison",
      "src/b.ts:8:role-name-comparison",
    ]);
  });

  it("passes permission checks and other uses of the word role", () => {
    root = mkdtempSync(join(tmpdir(), "hardcode-"));
    write(
      "src/a.tsx",
      [
        'authorize(actor, "settings.edit", scope);',
        "if (can(actor, permission)) {}",
        'const status = <div role="status" />;',
        "const role = await getRole(id);",
        "if (membership.roleId === input.roleId) {}",
        'if (status === "done") {}',
        'const title = t("roles.title");',
        'const canAssign = permissions.includes("roles.assign");',
        'if (pathname === "/admin/roles") {}',
        "const value = await db.select().from(settings).where(eq(settings.key, key));",
        "  .where(eq(memberships.roleId, input.roleId))",
        '  .where(eq(rolePermissions.permissionKey, "roles.assign"))',
        'const rows = await pool.query("select * from roles where key = any($1)", [keys]);',
        'export const roles = pgTable("roles", {',
        '  roleId: uuid("role_id").notNull(),',
        "switch (kind) {",
        '  case "upload":',
        "    break;",
        "}",
      ].join("\n"),
    );
    expect(rules()).toEqual([]);
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

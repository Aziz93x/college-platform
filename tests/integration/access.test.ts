import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedBase } from "../../db/seed/base.ts";
import {
  createFirstAdmin,
  loadAccess,
  permissionKeys,
} from "../../src/modules/access/index.ts";
import { signIn } from "../../src/modules/identity/index.ts";
import {
  createSharedTestDatabase,
  createTestDatabase,
  runScript,
  scriptEnv,
} from "./support/database.ts";

const college = { name: "Test College", shortName: "TC" };

let database: Awaited<ReturnType<typeof createSharedTestDatabase>>;
let collegeId: string;

beforeAll(async () => {
  database = await createSharedTestDatabase();
  collegeId = await seedBase(database.db, college);
});

afterAll(() => database?.drop());

const query = async (text: string, values: unknown[] = []) =>
  (await database.pool.query(text, values)).rows;

describe("loadAccess", () => {
  it("gives the permissions of the person's roles in that college, each in its membership's scope, ignoring keys the code does not know", async () => {
    const [{ id: userId }] = await query(
      "insert into users (name, email) values ('Holder', 'holder@college.example') returning id",
    );
    const [{ id: roleId }] = await query(
      `insert into roles (college_id, key, labels) values ($1, 'viewer', '{"ar": "x"}') returning id`,
      [collegeId],
    );
    await query(
      "insert into role_permissions (role_id, permission) values ($1, 'design.view'), ($1, 'retired.key')",
      [roleId],
    );
    await query(
      "insert into memberships (user_id, role_id, college_id) values ($1, $2, $3)",
      [userId, roleId, collegeId],
    );
    const [{ id: departmentId }] = await query(
      "insert into departments (college_id, name, short_name) values ($1, 'Electrical', 'Elec') returning id",
      [collegeId],
    );
    await query(
      `insert into memberships (user_id, role_id, college_id, department_id)
       select $1, id, $2, $3 from roles where key = 'head' and college_id = $2`,
      [userId, collegeId, departmentId],
    );
    const [{ id: otherCollegeId }] = await query(
      "insert into colleges (name, short_name) values ('Other College', 'OC') returning id",
    );

    const access = await loadAccess(userId, collegeId);
    // The viewer role across the college, the head's keys in the department.
    expect(access.grants).toHaveLength(5);
    expect(access.grants).toEqual(
      expect.arrayContaining([
        { permission: "design.view", departmentId: null },
        { permission: "sections.transfer", departmentId },
        { permission: "accounts.resetPassword", departmentId },
        { permission: "accounts.linkEmployeeNumber", departmentId },
        { permission: "announcements.publish", departmentId },
      ]),
    );
    expect(access.permissions).toEqual(
      new Set([
        "design.view",
        "sections.transfer",
        "accounts.resetPassword",
        "accounts.linkEmployeeNumber",
        "announcements.publish",
      ]),
    );
    expect(access.roleKeys.sort()).toEqual(["head", "viewer"]);
    expect(await loadAccess(userId, otherCollegeId)).toEqual({
      grants: [],
      permissions: new Set(),
      roleKeys: [],
    });
  });
});

describe("pnpm admin:create", () => {
  const run = (args: string[]) =>
    runScript("scripts/admin-create.ts", args, scriptEnv(database.url));

  it("makes the first admin, who signs in with the password it prints once, then refuses to run again", async () => {
    const created = await run([
      "--name",
      "First Admin",
      "--email",
      "First.Admin@College.example",
      "--employee-number",
      "١٠٠١",
    ]);
    expect(created.code, created.stderr).toBe(0);
    const password = created.stdout.match(/shown only now: (\S+)/)?.[1] ?? "";

    const [admin] = await query(
      "select id, email, must_change_password from users where email = 'first.admin@college.example'",
    );
    expect(admin.must_change_password).toBe(true);
    const { permissions, roleKeys } = await loadAccess(admin.id, collegeId);
    expect([...permissions]).toEqual(permissionKeys);
    expect(roleKeys).toEqual(["system-admin"]);
    expect(
      await query(
        "select actor_id, action, diff from audit_events where entity_id = $1",
        [admin.id],
      ),
    ).toEqual([
      {
        actor_id: null,
        action: "account.create",
        diff: { role: "system-admin" },
      },
    ]);
    expect(
      await signIn(
        { identifier: "1001", password, remember: false },
        new Headers({ "x-forwarded-for": "10.1.0.1" }),
      ),
    ).toEqual({ status: "signedIn" });

    const again = await run([
      "--name",
      "Second Admin",
      "--email",
      "second.admin@college.example",
      "--employee-number",
      "1002",
    ]);
    expect(again.code).toBe(1);
    expect(again.stderr).toContain("the college has an admin already");
    expect(
      await query(
        "select id from users where email = 'second.admin@college.example'",
      ),
    ).toEqual([]);
  });

  it("explains what is wrong with the options", async () => {
    const result = await run(["--name", "", "--email", "not-an-email"]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("--name");
    expect(result.stderr).toContain("--email");
    expect(result.stderr).toContain("--employee-number");
    expect(result.stderr).toContain("usage: pnpm admin:create");
  });
});

describe("createFirstAdmin", () => {
  it("makes one admin when two runs start at once", async () => {
    const fresh = await createTestDatabase();
    try {
      const freshCollegeId = await seedBase(fresh.db, college);
      const results = await Promise.all(
        ["2001", "2002"].map((employeeNumber) =>
          createFirstAdmin(
            {
              collegeId: freshCollegeId,
              name: `Admin ${employeeNumber}`,
              email: `admin.${employeeNumber}@college.example`,
              employeeNumber,
            },
            fresh.db,
          ),
        ),
      );

      expect(results.map(({ status }) => status).sort()).toEqual([
        "adminExists",
        "created",
      ]);
      expect(
        (await fresh.pool.query("select id from memberships")).rows,
      ).toHaveLength(1);
    } finally {
      await fresh.drop();
    }
  });
});

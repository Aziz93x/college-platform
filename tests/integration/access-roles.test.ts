import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { defaultRoles, seedBase, systemRole } from "../../db/seed/base.ts";
import {
  addMembership,
  createRole,
  disableAccount,
  findRole,
  joinRole,
  listRoles,
  loadAccess,
  permissionKeys,
  removeMembership,
  renameRole,
  setRolePermissions,
} from "../../src/modules/access/index.ts";
import { createAccount } from "../../src/modules/identity/index.ts";
import { createTestDatabase } from "./support/database.ts";

let database: Awaited<ReturnType<typeof createTestDatabase>>;
let collegeId: string;
let otherCollegeId: string;
let electrical: string;
let otherDepartment: string;
let admin: string;
let trainer: string;
let stranger: string;

const query = async (text: string, values: unknown[] = []) =>
  (await database.pool.query(text, values)).rows;

const person = (name: string, employeeNumber: string, college = collegeId) =>
  database.db.transaction(
    async (tx) =>
      (
        await createAccount(
          {
            collegeId: college,
            name,
            email: `${employeeNumber}@college.example`,
            employeeNumber,
          },
          tx,
          `password-${employeeNumber}`,
        )
      ).userId,
  );

beforeAll(async () => {
  database = await createTestDatabase();
  collegeId = await seedBase(database.db, {
    name: "Test College",
    shortName: "TC",
  });
  [{ id: otherCollegeId }] = await query(
    "insert into colleges (name, short_name) values ('Other College', 'OC') returning id",
  );
  [{ id: electrical }] = await query(
    "insert into departments (college_id, name, short_name) values ($1, 'Electrical', 'Elec') returning id",
    [collegeId],
  );
  [{ id: otherDepartment }] = await query(
    "insert into departments (college_id, name, short_name) values ($1, 'Electrical', 'Elec') returning id",
    [otherCollegeId],
  );
  admin = await person("Admin", "1001");
  trainer = await person("Trainer", "2001");
  stranger = await person("Stranger", "3001", otherCollegeId);
  await joinRole(
    { userId: admin, collegeId, role: { system: true } },
    database.db,
  );
});

afterAll(() => database?.drop());

const change = () => ({ collegeId, actorId: admin, ip: "203.0.113.9" });

const eventsOf = (entityId: string) =>
  query(
    `select action, actor_id, diff from audit_events
     where entity_id = $1 order by created_at`,
    [entityId],
  );

const count = async (table: string) =>
  Number((await query(`select count(*) from ${table}`))[0].count);

const roleId = async (key: string) =>
  (
    await query("select id from roles where college_id = $1 and key = $2", [
      collegeId,
      key,
    ])
  )[0].id as string;

describe("listRoles", () => {
  it("puts the system role first, holding every key, then the default roles in their order, with how many hold each", async () => {
    const roles = await listRoles(collegeId, database.db);

    expect(
      roles.map(({ key, system, members }) => ({ key, system, members })),
    ).toEqual([
      { key: systemRole.key, system: true, members: 1 },
      ...defaultRoles.map(({ key }) => ({ key, system: false, members: 0 })),
    ]);
    expect(roles[0].permissions).toEqual(permissionKeys);
    expect(roles.find(({ key }) => key === "head")?.permissions).toEqual([
      "accounts.resetPassword",
      "accounts.linkEmployeeNumber",
      "announcements.publish",
      "rayat.import",
      "plan.edit",
      "plan.publish",
      "assignment.manage",
      "review.decide",
      "portfolio.approve",
    ]);
  });
});

describe("createRole and renameRole", () => {
  it("adds a role holding no key under the given name, records role.create, and refuses a name another role has", async () => {
    const created = await createRole(
      { label: "Coordinator" },
      "ar",
      change(),
      database.db,
    );
    if (created.status !== "created") throw new Error(created.status);

    const role = await findRole(collegeId, created.id, database.db);
    expect(role).toMatchObject({
      labels: { ar: "Coordinator" },
      system: false,
      permissions: [],
      members: [],
    });
    expect(role?.key).toMatch(/^custom-[0-9a-f]{8}$/);
    expect(await eventsOf(created.id)).toEqual([
      {
        action: "role.create",
        actor_id: admin,
        diff: { to: { key: role?.key, labels: { ar: "Coordinator" } } },
      },
    ]);

    const before = [await count("roles"), await count("audit_events")];
    await expect(
      createRole({ label: "Coordinator" }, "ar", change(), database.db),
    ).resolves.toEqual({ status: "labelTaken" });
    expect([await count("roles"), await count("audit_events")]).toEqual(before);
  });

  it("renames a role in the college's language, records the names before and after, and writes nothing for the same name", async () => {
    const id = await roleId("secretary");
    await expect(
      renameRole(
        id,
        { label: "Department Secretary" },
        "ar",
        change(),
        database.db,
      ),
    ).resolves.toEqual({ status: "saved" });
    expect((await eventsOf(id)).at(-1)).toEqual({
      action: "role.update",
      actor_id: admin,
      diff: {
        from: { labels: { ar: "أمين القسم" } },
        to: { labels: { ar: "Department Secretary" } },
      },
    });

    const before = await count("audit_events");
    await expect(
      renameRole(
        id,
        { label: "Department Secretary" },
        "ar",
        change(),
        database.db,
      ),
    ).resolves.toEqual({ status: "unchanged" });
    await expect(
      renameRole(id, { label: "رئيس القسم" }, "ar", change(), database.db),
    ).resolves.toEqual({ status: "labelTaken" });
    await expect(
      renameRole(
        id,
        { label: "Elsewhere" },
        "ar",
        { ...change(), collegeId: otherCollegeId },
        database.db,
      ),
    ).resolves.toEqual({ status: "notFound" });
    expect(await count("audit_events")).toBe(before);
  });
});

describe("setRolePermissions", () => {
  it("gives the role exactly these keys, which its members hold at their next request, and records the keys before and after", async () => {
    const id = await roleId("trainer");
    await joinRole(
      {
        userId: trainer,
        collegeId,
        role: { key: "trainer" },
        departmentId: electrical,
      },
      database.db,
    );
    expect([
      ...(await loadAccess(trainer, collegeId, database.db)).permissions,
    ]).toEqual(["task.complete"]);

    await expect(
      setRolePermissions(
        id,
        { permissions: ["design.view", "task.complete"] },
        change(),
        database.db,
      ),
    ).resolves.toEqual({ status: "saved" });

    expect((await loadAccess(trainer, collegeId, database.db)).grants).toEqual([
      { permission: "design.view", departmentId: electrical },
      { permission: "task.complete", departmentId: electrical },
    ]);
    expect((await eventsOf(id)).at(-1)).toEqual({
      action: "role.update",
      actor_id: admin,
      diff: {
        from: { permissions: ["task.complete"] },
        to: { permissions: ["design.view", "task.complete"] },
      },
    });
  });

  it("writes nothing for the same keys, and leaves the system role's keys alone", async () => {
    const before = await count("audit_events");
    await expect(
      setRolePermissions(
        await roleId("trainer"),
        { permissions: ["task.complete", "design.view"] },
        change(),
        database.db,
      ),
    ).resolves.toEqual({ status: "unchanged" });
    await expect(
      setRolePermissions(
        await roleId(systemRole.key),
        { permissions: [] },
        change(),
        database.db,
      ),
    ).resolves.toEqual({ status: "system" });
    expect(await count("audit_events")).toBe(before);
  });
});

describe("addMembership and removeMembership", () => {
  it("gives a person a role across the college or in a department, records it, and gives it once per scope", async () => {
    const head = await roleId("head");
    const added = await addMembership(
      { userId: trainer, roleId: head, departmentId: electrical },
      change(),
      database.db,
    );
    if (added.status !== "added") throw new Error(added.status);

    expect(await eventsOf(added.id)).toEqual([
      {
        action: "membership.create",
        actor_id: admin,
        diff: {
          to: { userId: trainer, role: "head", departmentId: electrical },
        },
      },
    ]);
    await expect(
      addMembership(
        { userId: trainer, roleId: head, departmentId: electrical },
        change(),
        database.db,
      ),
    ).resolves.toEqual({ status: "exists" });
    await expect(
      addMembership(
        { userId: trainer, roleId: head, departmentId: null },
        change(),
        database.db,
      ),
    ).resolves.toMatchObject({ status: "added" });
    await expect(
      addMembership(
        { userId: trainer, roleId: head, departmentId: null },
        change(),
        database.db,
      ),
    ).resolves.toEqual({ status: "exists" });

    // By name, then in the order they were given.
    expect((await findRole(collegeId, head, database.db))?.members).toEqual([
      expect.objectContaining({
        userId: trainer,
        name: "Trainer",
        employeeNumber: "2001",
        departmentId: electrical,
      }),
      expect.objectContaining({ userId: trainer, departmentId: null }),
    ]);
  });

  it("finds no person, role or department of another college, and keeps the system role across the college", async () => {
    const before = await count("memberships");
    const head = await roleId("head");
    for (const input of [
      { userId: stranger, roleId: head, departmentId: null },
      { userId: trainer, roleId: head, departmentId: otherDepartment },
    ]) {
      await expect(
        addMembership(input, change(), database.db),
      ).resolves.toEqual({ status: "notFound" });
    }
    await expect(
      addMembership(
        { userId: trainer, roleId: head, departmentId: null },
        { ...change(), collegeId: otherCollegeId },
        database.db,
      ),
    ).resolves.toEqual({ status: "notFound" });
    await expect(
      addMembership(
        {
          userId: trainer,
          roleId: await roleId(systemRole.key),
          departmentId: electrical,
        },
        change(),
        database.db,
      ),
    ).resolves.toEqual({ status: "collegeOnly" });
    expect(await count("memberships")).toBe(before);
  });

  it("keeps a membership's department in the membership's college, even without the check", async () => {
    await expect(
      query(
        "insert into memberships (user_id, role_id, college_id, department_id) values ($1, $2, $3, $4)",
        [trainer, await roleId("head"), collegeId, otherDepartment],
      ),
    ).rejects.toThrow(/memberships_department_fk/);
  });

  // The form offers active departments only; a call made without it is refused too (Audit 3).
  it("gives no role in a department that was set aside", async () => {
    const [{ id: setAside }] = await query(
      "insert into departments (college_id, name, short_name, active) values ($1, 'Set aside', 'Old', false) returning id",
      [collegeId],
    );
    const before = await count("memberships");
    await expect(
      addMembership(
        {
          userId: trainer,
          roleId: await roleId("head"),
          departmentId: setAside,
        },
        change(),
        database.db,
      ),
    ).resolves.toEqual({ status: "inactive" });
    expect(await count("memberships")).toBe(before);
  });

  it("takes a role away and records it, but never the system role's last member, not even from themselves", async () => {
    const [{ id: adminMembership }] = await query(
      "select m.id from memberships m join roles r on r.id = m.role_id where r.system and m.user_id = $1",
      [admin],
    );
    await expect(
      removeMembership(adminMembership, change(), database.db),
    ).resolves.toEqual({ status: "lastAdmin" });

    const second = await addMembership(
      {
        userId: trainer,
        roleId: await roleId(systemRole.key),
        departmentId: null,
      },
      change(),
      database.db,
    );
    if (second.status !== "added") throw new Error(second.status);
    // Two removals at once: the role keeps one of them.
    const results = await Promise.all([
      removeMembership(adminMembership, change(), database.db),
      removeMembership(second.id, change(), database.db),
    ]);
    expect(results.map(({ status }) => status).sort()).toEqual([
      "lastAdmin",
      "removed",
    ]);
    const removed =
      results[0].status === "removed" ? adminMembership : second.id;
    expect(await eventsOf(removed)).toContainEqual({
      action: "membership.delete",
      actor_id: admin,
      diff: {
        from: {
          userId: removed === adminMembership ? admin : trainer,
          role: systemRole.key,
          departmentId: null,
        },
      },
    });
    await expect(
      removeMembership(removed, change(), database.db),
    ).resolves.toEqual({ status: "notFound" });
  });

  it("keeps an admin who can sign in: a disabled member of the system role counts for nothing (Audit 4)", async () => {
    const system = await roleId(systemRole.key);
    const membershipOf = async (userId: string) =>
      (
        await query(
          "select id from memberships where role_id = $1 and user_id = $2",
          [system, userId],
        )
      )[0]?.id as string;
    // Whoever the test before left in the role, and two more admins.
    const [{ user_id: first }] = await query(
      "select user_id from memberships where role_id = $1",
      [system],
    );
    const second = await person("Second Admin", "1002");
    const leaving = await person("Leaving Admin", "1003");
    for (const userId of [second, leaving]) {
      const added = await addMembership(
        { userId, roleId: system, departmentId: null },
        change(),
        database.db,
      );
      expect(added.status).toBe("added");
    }

    // An admin who leaves is disabled, not removed; the role page marks them.
    expect(
      (await disableAccount(leaving, true, change(), database.db)).status,
    ).toBe("saved");
    const members = (await findRole(collegeId, system, database.db))?.members;
    expect(
      members?.map(({ userId, disabled }) => ({ userId, disabled })),
    ).toEqual(
      expect.arrayContaining([
        { userId: leaving, disabled: true },
        { userId: second, disabled: false },
      ]),
    );

    // Two enabled admins: one may go. Then the other is the last who can sign in, and stays,
    // though the disabled one still holds the role; the disabled one's role may go.
    await expect(
      removeMembership(await membershipOf(first), change(), database.db),
    ).resolves.toEqual({ status: "removed" });
    await expect(
      removeMembership(await membershipOf(second), change(), database.db),
    ).resolves.toEqual({ status: "lastAdmin" });
    await expect(
      removeMembership(await membershipOf(leaving), change(), database.db),
    ).resolves.toEqual({ status: "removed" });
    expect(
      (await findRole(collegeId, system, database.db))?.members.map(
        ({ userId }) => userId,
      ),
    ).toEqual([second]);
  });
});

it("gives and takes a role on one connection: nothing in its transaction waits for a second one (lead review B)", async () => {
  // With a pool of one, a read inside the transaction would wait for ever for a second connection.
  const single = new Pool({ connectionString: database.url, max: 1 });
  const db = drizzle({ client: single });
  const within = <T>(work: Promise<T>) =>
    Promise.race([
      work,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("waited for a second connection")),
          5000,
        ),
      ),
    ]);
  try {
    const userId = await person("One Connection", "1009");
    const added = await within(
      addMembership(
        { userId, roleId: await roleId("trainer"), departmentId: electrical },
        change(),
        db,
      ),
    );
    expect(added.status).toBe("added");
    if (added.status !== "added") return;
    await expect(
      within(removeMembership(added.id, change(), db)),
    ).resolves.toEqual({ status: "removed" });
  } finally {
    // Not awaited: a transaction left waiting holds its connection, and end() would wait with it.
    void single.end();
  }
});

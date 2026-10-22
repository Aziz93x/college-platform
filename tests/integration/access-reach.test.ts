import { afterAll, beforeAll, expect, it } from "vitest";
import { seedBase } from "../../db/seed/base.ts";
import {
  joinRole,
  listDirectory,
  loadAccess,
  reachesAccount,
  setRolePermissions,
} from "../../src/modules/access/index.ts";
import { createAccount } from "../../src/modules/identity/index.ts";
import { createSharedTestDatabase } from "./support/database.ts";

// Lead review B's probe: one switch on the roles grid gave the vice-dean temporary passwords across
// the college, and with them the system admin's account. What the database gives each person now
// decides whose account such a key reaches: no one holding a power its holder lacks.

let database: Awaited<ReturnType<typeof createSharedTestDatabase>>;
let collegeId: string;
const people: Record<string, string> = {};

const query = async (text: string, values: unknown[] = []) =>
  (await database.pool.query(text, values)).rows;

beforeAll(async () => {
  // Shared: the directory reads the lockout settings through getDb().
  database = await createSharedTestDatabase();
  collegeId = await seedBase(database.db, {
    name: "Test College",
    shortName: "TC",
  });
  const [{ id: electrical }] = await query(
    "insert into departments (college_id, name, short_name) values ($1, 'Electrical', 'Elec') returning id",
    [collegeId],
  );
  const holders = [
    ["admin", { system: true as const }, null],
    ["viceDean", { key: "vice-dean" }, null],
    ["dean", { key: "dean" }, null],
    ["head", { key: "head" }, electrical],
    ["trainer", { key: "trainer" }, electrical],
  ] as const;
  for (const [name, role, departmentId] of holders) {
    people[name] = await database.db.transaction(
      async (tx) =>
        (
          await createAccount(
            {
              collegeId,
              name,
              email: `${name}@college.example`,
              employeeNumber: `9${Object.keys(people).length}0001`,
            },
            tx,
            `password-${name}`,
          )
        ).userId,
    );
    await joinRole(
      { userId: people[name], collegeId, role, departmentId },
      database.db,
    );
  }
  // The switch: "temporary passwords" on the vice-dean's grid, beside its seeded keys.
  const [{ id: viceDean, permissions }] = await query(
    `select r.id, array_agg(p.permission order by p.permission) as permissions
     from roles r join role_permissions p on p.role_id = r.id
     where r.college_id = $1 and r.key = 'vice-dean' group by r.id`,
    [collegeId],
  );
  await expect(
    setRolePermissions(
      viceDean,
      { permissions: [...permissions, "accounts.resetPassword"] },
      { collegeId, actorId: people.admin },
      database.db,
    ),
  ).resolves.toEqual({ status: "saved" });
});

afterAll(() => database?.drop());

const reaches = async (actor: string) => {
  const { grants } = await loadAccess(people[actor], collegeId, database.db);
  const directory = await listDirectory(collegeId, {}, database.db);
  return Object.fromEntries(
    Object.entries(people).map(([name, userId]) => [
      name,
      reachesAccount(
        { userId: people[actor], collegeId, grants },
        "accounts.resetPassword",
        directory.find((person) => person.userId === userId) ??
          expect.unreachable(),
      ),
    ]),
  );
};

it("lets a vice-dean given temporary passwords help the trainers, whose keys it holds, never the admin, a head or the dean, who endorses the framework", async () => {
  expect(await reaches("viceDean")).toEqual({
    admin: false,
    viceDean: true,
    dean: false,
    head: false,
    trainer: true,
  });
});

it("still lets the admin reach everyone", async () => {
  expect(await reaches("admin")).toEqual({
    admin: true,
    viceDean: true,
    dean: true,
    head: true,
    trainer: true,
  });
});

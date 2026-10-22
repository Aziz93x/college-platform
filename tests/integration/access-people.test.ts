import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedBase, systemRole } from "../../db/seed/base.ts";
import {
  disableAccount,
  importPeople,
  joinRole,
  listDirectory,
  type PeopleRow,
  planPeopleImport,
} from "../../src/modules/access/index.ts";
import { createAccount } from "../../src/modules/identity/index.ts";
import { getDb } from "../../src/platform/db/client.ts";
import { createSharedTestDatabase } from "./support/database.ts";

let database: Awaited<ReturnType<typeof createSharedTestDatabase>>;
let collegeId: string;
let electrical: string;
let mechanical: string;
let lastNumber = 7000;

const query = async (text: string, values: unknown[] = []) =>
  (await database.pool.query(text, values)).rows;

// A person with an employee number and an email of their own; with a password, an active account,
// and without one, an invited one.
async function person(name: string, password?: string) {
  const employeeNumber = String(++lastNumber);
  const email = `p${employeeNumber}@college.example`;
  const { userId } = await getDb().transaction((tx) =>
    createAccount({ collegeId, name, email, employeeNumber }, tx, password),
  );
  return { userId, email, employeeNumber, name };
}

const hold = (
  userId: string,
  role: { system: true } | { key: string },
  departmentId: string | null = null,
) =>
  joinRole(
    { userId, collegeId, role, ...(departmentId && { departmentId }) },
    getDb(),
  );

const change = (actorId: string) => ({
  collegeId,
  actorId,
  ip: "10.0.70.1",
  userAgent: "integration-test",
});

beforeAll(async () => {
  database = await createSharedTestDatabase();
  collegeId = await seedBase(database.db, {
    name: "Test College",
    shortName: "TC",
  });
  [{ id: electrical }, { id: mechanical }] = await query(
    `insert into departments (college_id, name, short_name) values
       ($1, 'Electrical Technology', 'Electrical'), ($1, 'Mechanical Technology', 'Mechanical')
     returning id`,
    [collegeId],
  );
  await query(
    `insert into department_rayat_values (college_id, department_id, value) values
       ($1, $2, 'ELEC-1'), ($1, $3, 'MECH-1')`,
    [collegeId, electrical, mechanical],
  );
});

afterAll(() => database?.drop());

describe("listDirectory", () => {
  let people: Record<string, Awaited<ReturnType<typeof person>>>;

  beforeAll(async () => {
    people = {
      admin: await person("A Admin", "password-admin"),
      head: await person("B Head", "password-head"),
      trainer: await person("C Trainer", "password-trainer"),
      both: await person("D Both"),
      mechanic: await person("E Mechanic", "password-mechanic"),
      dean: await person("F Dean", "password-dean"),
      none: await person("G None", "password-none"),
    };
    await hold(people.admin.userId, { system: true });
    await hold(people.head.userId, { key: "head" }, electrical);
    await hold(people.trainer.userId, { key: "trainer" }, electrical);
    await hold(people.both.userId, { key: "trainer" }, electrical);
    await hold(people.both.userId, { key: "trainer" }, mechanical);
    await hold(people.mechanic.userId, { key: "trainer" }, mechanical);
    await hold(people.dean.userId, { key: "dean" });
    await query("update users set disabled_at = now() where id = $1", [
      people.none.userId,
    ]);
    await query(
      "insert into sign_in_lockouts (subject, attempts, started_at) values ($1, 5, now())",
      [`typed:${people.mechanic.employeeNumber}`],
    );
  });

  it("lists everyone by name, each with their roles and where, every key those give, and the account's state", async () => {
    const all = await listDirectory(collegeId);
    expect(all.map(({ name, state }) => [name, state])).toEqual([
      ["A Admin", "active"],
      ["B Head", "active"],
      ["C Trainer", "active"],
      ["D Both", "invited"],
      ["E Mechanic", "locked"],
      ["F Dean", "active"],
      ["G None", "disabled"],
    ]);
    const [admin, head, , both] = all;
    expect(admin.memberships).toMatchObject([
      { system: true, departmentId: null, roleLabels: systemRole.labels },
    ]);
    expect(admin.permissions.has("people.manage")).toBe(true);
    expect(head.permissions).toEqual(
      new Set([
        "plan.edit",
        "plan.publish",
        "assignment.manage",
        "review.decide",
        "portfolio.approve",
        "accounts.resetPassword",
        "accounts.linkEmployeeNumber",
      ]),
    );
    expect(
      both.memberships.map(({ departmentId }) => departmentId).sort(),
    ).toEqual([electrical, mechanical].sort());
  });

  it("keeps to the people who hold a role in the given departments, or to one person", async () => {
    expect(
      (await listDirectory(collegeId, { departments: [electrical] })).map(
        ({ name }) => name,
      ),
    ).toEqual(["B Head", "C Trainer", "D Both"]);
    expect(await listDirectory(collegeId, { departments: [] })).toEqual([]);
    expect(
      (await listDirectory(collegeId, { userId: people.dean.userId })).map(
        ({ name }) => name,
      ),
    ).toEqual(["F Dean"]);
  });
});

describe("disableAccount", () => {
  it("refuses one's own account and the college's last admin who can sign in, and audits the rest", async () => {
    // A college of its own, so the admins counted are this test's.
    const [{ id: college }] = await query(
      "insert into colleges (name, short_name) values ('Second College', 'SC') returning id",
    );
    await seedBase(getDb(), { name: "unused", shortName: "unused" });
    await query(
      `insert into roles (college_id, key, labels, system) values ($1, 'system-admin', '{"ar":"x"}', true)`,
      [college],
    );
    const make = async (name: string) => {
      const number = String(++lastNumber);
      const { userId } = await getDb().transaction((tx) =>
        createAccount(
          {
            collegeId: college,
            name,
            email: `p${number}@college.example`,
            employeeNumber: number,
          },
          tx,
          "password",
        ),
      );
      await joinRole(
        { userId, collegeId: college, role: { system: true } },
        getDb(),
      );
      return userId;
    };
    const first = await make("First Admin");
    const second = await make("Second Admin");
    const by = (actorId: string) => ({
      ...change(actorId),
      collegeId: college,
    });

    await expect(disableAccount(first, true, by(first))).resolves.toEqual({
      status: "self",
    });
    await expect(disableAccount(second, true, by(first))).resolves.toEqual({
      status: "saved",
    });
    await expect(disableAccount(first, true, by(second))).resolves.toEqual({
      status: "lastAdmin",
    });
    await expect(disableAccount(second, false, by(first))).resolves.toEqual({
      status: "saved",
    });
    await expect(disableAccount(first, true, by(second))).resolves.toEqual({
      status: "saved",
    });
    expect(
      (
        await query(
          "select action from audit_events where entity_id = any($1) and action like 'account.%able' order by created_at, id",
          [[first, second]],
        )
      ).map(({ action }) => action),
    ).toEqual(["account.disable", "account.enable", "account.disable"]);
  });
});

describe("importing people", () => {
  let importer: string;
  const row = (line: number, fields: Partial<PeopleRow>): PeopleRow => ({
    line,
    employeeNumber: "",
    name: "",
    email: "",
    department: "",
    role: "",
    ...fields,
  });

  beforeAll(async () => {
    importer = (await person("Importer", "password-importer")).userId;
  });

  it("plans each row against the college, with every reason a row cannot be imported", async () => {
    const existing = await person("Existing Trainer", "password");
    await hold(existing.userId, { key: "trainer" }, electrical);
    const someoneElse = await person("Someone Else", "password");
    await query(
      "insert into departments (college_id, name, short_name, active) values ($1, 'Old', 'Old', false)",
      [collegeId],
    );
    const plan = await planPeopleImport(
      collegeId,
      [
        row(2, {
          employeeNumber: "٨٠٠١",
          name: "New Trainer",
          email: "NEW.TRAINER@college.example",
          department: "elec-1",
          role: "trainer",
        }),
        row(3, {
          employeeNumber: existing.employeeNumber,
          name: "Existing Trainer",
          email: existing.email,
          department: "Mechanical",
          role: "المدرب",
        }),
        row(4, {
          employeeNumber: existing.employeeNumber,
          name: "Existing Trainer",
          email: existing.email,
          department: "electrical technology",
          role: "trainer",
        }),
        row(5, {
          employeeNumber: "8001",
          name: "Again",
          email: "again@college.example",
        }),
        row(6, {
          employeeNumber: someoneElse.employeeNumber,
          name: "Clash",
          email: "clash@college.example",
        }),
        row(7, {
          employeeNumber: "8002",
          name: "Taken",
          email: someoneElse.email,
        }),
        row(8, {
          employeeNumber: "80A",
          name: " ",
          email: "not-an-email",
          department: "Nowhere",
          role: "Nobody",
        }),
        row(9, {
          employeeNumber: "8003",
          name: "Set Aside",
          email: "aside@college.example",
          department: "Old",
          role: "trainer",
        }),
        row(10, {
          employeeNumber: "8004",
          name: "Admin",
          email: "admin.import@college.example",
          role: "system-admin",
        }),
        row(11, {
          employeeNumber: "8005",
          name: "No Role",
          email: "norole@college.example",
          department: "Mechanical",
        }),
        row(12, {
          employeeNumber: "8001",
          name: "New Trainer",
          email: "new.trainer@college.example",
          department: "Mechanical",
          role: "trainer",
        }),
        row(13, {
          employeeNumber: "8006",
          name: "Same Email",
          email: "new.trainer@college.example",
        }),
      ],
      { canGiveRoles: true },
    );
    expect(
      plan.map(({ line, outcome, errors }) => [line, outcome, errors]),
    ).toEqual([
      [2, "new", []],
      [3, "roleAdded", []],
      [4, "unchanged", []],
      [5, "invalid", ["repeated"]],
      [6, "invalid", ["employeeNumberTaken"]],
      [7, "invalid", ["emailTaken"]],
      [8, "invalid", ["name", "email", "employeeNumber", "department", "role"]],
      [9, "invalid", ["departmentInactive"]],
      [10, "invalid", ["systemRole"]],
      [11, "invalid", ["departmentWithoutRole"]],
      [12, "roleAdded", []],
      [13, "invalid", ["repeated"]],
    ]);
    expect(plan[0]).toMatchObject({
      employeeNumber: "8001",
      email: "new.trainer@college.example",
      department: { id: electrical, name: "Electrical Technology" },
      role: { key: "trainer" },
    });

    const withoutRoles = await planPeopleImport(
      collegeId,
      [
        row(2, {
          employeeNumber: "8001",
          name: "A",
          email: "a@college.example",
          role: "trainer",
        }),
      ],
      { canGiveRoles: false },
    );
    expect(withoutRoles[0].errors).toEqual(["roleNotAllowed"]);
  });

  it("imports 40 people with their roles, each with a temporary password shown once, audits every account and role, and a second run changes nothing", async () => {
    const rows = Array.from({ length: 40 }, (_, index) =>
      row(index + 2, {
        employeeNumber: String(900100 + index),
        name: `Trainer ${index + 1}`,
        email: `trainer.${index + 1}@college.example`,
        department: index % 2 === 0 ? "Electrical" : "MECH-1",
        role: "trainer",
      }),
    );
    const result = await importPeople(
      rows,
      { canGiveRoles: true },
      change(importer),
    );
    expect(result.created).toHaveLength(40);
    expect(result).toMatchObject({ rolesAdded: 0, unchanged: 0, skipped: [] });
    expect(new Set(result.created.map(({ password }) => password)).size).toBe(
      40,
    );

    const accounts = await query(
      `select u.must_change_password, m.department_id from users u
       join people p on p.user_id = u.id
       join memberships m on m.user_id = u.id
       where p.employee_number like '9001%' order by p.employee_number`,
    );
    expect(accounts).toHaveLength(40);
    expect(
      accounts.every(({ must_change_password }) => must_change_password),
    ).toBe(true);
    expect(
      accounts.slice(0, 2).map(({ department_id }) => department_id),
    ).toEqual([electrical, mechanical]);
    const events = await query(
      `select action, count(*)::int as count from audit_events
       where actor_id = $1::text group by action order by action`,
      [importer],
    );
    expect(events).toEqual([
      { action: "account.create", count: 40 },
      { action: "membership.create", count: 40 },
    ]);
    const [created] = await query(
      "select diff from audit_events where actor_id = $1::text and action = 'account.create' order by created_at, id limit 1",
      [importer],
    );
    expect(JSON.stringify(created.diff)).not.toContain(
      result.created[0].password,
    );

    const again = await importPeople(
      rows,
      { canGiveRoles: true },
      change(importer),
    );
    expect(again).toEqual({
      created: [],
      rolesAdded: 0,
      unchanged: 40,
      skipped: [],
    });
  });

  it("makes a person once from their rows, with each row's role", async () => {
    const result = await importPeople(
      [
        row(2, {
          employeeNumber: "910001",
          name: "Two Departments",
          email: "two.departments@college.example",
          department: "Electrical",
          role: "trainer",
        }),
        row(3, {
          employeeNumber: "910001",
          name: "Two Departments",
          email: "two.departments@college.example",
          department: "Mechanical",
          role: "trainer",
        }),
      ],
      { canGiveRoles: true },
      change(importer),
    );
    expect(result).toMatchObject({ rolesAdded: 1, unchanged: 0, skipped: [] });
    expect(result.created).toHaveLength(1);
    expect(
      (
        await query(
          "select department_id from memberships where user_id = $1 order by department_id",
          [result.created[0].userId],
        )
      ).map(({ department_id }) => department_id),
    ).toEqual([electrical, mechanical].sort());
  });

  it("keeps no lock on the college while it imports: an event written meanwhile does not wait for it (lead review B)", async () => {
    const rows = Array.from({ length: 40 }, (_, at) =>
      row(at + 2, {
        employeeNumber: String(930001 + at),
        name: `Imported ${at + 1}`,
        email: `imported.${at + 1}@college.example`,
        department: "Electrical",
        role: "trainer",
      }),
    );
    const finished: string[] = [];
    const importing = importPeople(
      rows,
      { canGiveRoles: true },
      change(importer),
    ).then((result) => {
      finished.push("import");
      return result;
    });
    // Once the import's transaction is open, between its writes.
    await expect
      .poll(
        async () =>
          (
            await query(
              `select count(*)::int as open from pg_stat_activity
               where datname = current_database() and state = 'idle in transaction'`,
            )
          )[0].open,
        { timeout: 10_000, interval: 20 },
      )
      .toBeGreaterThan(0);
    // A sign-in's event, as every sign-in in the college writes one.
    await query(
      `insert into audit_events (college_id, actor_id, action, entity_type, entity_id)
       values ($1, $2, 'session.signIn', 'user', $2)`,
      [collegeId, importer],
    );
    finished.push("event");
    expect((await importing).created).toHaveLength(40);
    expect(finished).toEqual(["event", "import"]);
  });

  it("runs one import at a time per college, so two at once make a person once (Audit 4)", async () => {
    const same = [
      row(2, {
        employeeNumber: "920001",
        name: "Imported Twice",
        email: "imported.twice@college.example",
        department: "Electrical",
        role: "trainer",
      }),
    ];
    const results = await Promise.all([
      importPeople(same, { canGiveRoles: true }, change(importer)),
      importPeople(same, { canGiveRoles: true }, change(importer)),
    ]);
    // The second plans again once the first has finished, and finds the person there.
    expect(
      results
        .map(({ created, unchanged }) => [created.length, unchanged])
        .sort(),
    ).toEqual([
      [0, 1],
      [1, 0],
    ]);
    expect(
      await query(
        "select count(*)::int as made from people where employee_number = '920001'",
      ),
    ).toEqual([{ made: 1 }]);
  });
});

import { readFileSync } from "node:fs";
import { afterAll, expect, it } from "vitest";
import {
  assignmentCatalog,
  defaultNavigationOrder,
  defaultRoles,
  examPeriodTypes,
  portfolioAxes,
  seedBase,
  systemRole,
} from "../../db/seed/base.ts";
import { rayatColumns } from "../../db/seed/rayat-columns.ts";
import { getSetting } from "../../src/modules/settings/index.ts";
import { createTestDatabase } from "./support/database.ts";

const databases: Awaited<ReturnType<typeof createTestDatabase>>[] = [];

async function freshDatabase() {
  const database = await createTestDatabase();
  databases.push(database);
  return database;
}

afterAll(() => Promise.all(databases.map((database) => database.drop())));

const college = { name: "Test College", shortName: "TC" };

it("returns the first college once others exist", async () => {
  const { db, pool } = await freshDatabase();
  const first = await seedBase(db, college);
  await pool.query(
    "insert into colleges (name, short_name) values ('Other College', 'OC')",
  );
  // An update writes a new row version after the other college's, so an unordered read finds that one first.
  await pool.query("update colleges set name = 'Renamed' where id = $1", [
    first,
  ]);

  expect(await seedBase(db, college)).toBe(first);
});

it("gives the college its system role and the default roles with their keys, once, also after a second run", async () => {
  const { db, pool } = await freshDatabase();
  const collegeId = await seedBase(db, college);
  await seedBase(db, college);

  const { rows } = await pool.query(`
    select r.college_id, r.key, r.labels, r.system,
      coalesce(array_agg(p.permission order by p.permission)
        filter (where p.permission is not null), '{}') as permissions
    from roles r left join role_permissions p on p.role_id = r.id
    group by r.id order by r.system desc, r.created_at, r.id`);
  expect(rows).toEqual([
    {
      college_id: collegeId,
      ...systemRole,
      system: true,
      permissions: [],
    },
    ...defaultRoles.map(({ permissions, ...role }) => ({
      college_id: collegeId,
      ...role,
      system: false,
      permissions: [...permissions].sort(),
    })),
  ]);
});

it("gives the college the 11 axes in 3 groups and the closing group, once, and keeps an axis the admin renamed", async () => {
  const { db, pool } = await freshDatabase();
  await seedBase(db, college);
  await pool.query("update axes set title = 'محور معدّل' where code = '7'");
  await seedBase(db, college);

  const { rows } = await pool.query(`
    select g.code as group, array_agg(a.code order by a.position) as axes
    from axis_groups g join axes a on a.group_id = g.id
    group by g.id order by g.position`);
  expect(rows).toEqual(
    portfolioAxes.map((group) => ({
      group: group.code,
      axes: group.axes.map(({ code }) => code),
    })),
  );
  expect(rows.slice(0, 3).flatMap((group) => group.axes)).toHaveLength(11);
  expect(
    (await pool.query("select title from axes where code = '7'")).rows,
  ).toEqual([{ title: "محور معدّل" }]);
});

it("gives the college the four types of exam period in order, once, and keeps one already there (the owner's notes, 21 October 2026)", async () => {
  const { db, pool } = await freshDatabase();
  await seedBase(db, college);
  await pool.query(
    "update exam_period_types set short_name = 'الدوري ١' where code = 'first-periodic'",
  );
  await seedBase(db, college);
  expect(
    (
      await pool.query(
        "select code, name, short_name from exam_period_types order by position",
      )
    ).rows,
  ).toEqual(
    examPeriodTypes.map(({ code, name, shortName }) => ({
      code,
      name,
      short_name: code === "first-periodic" ? "الدوري ١" : shortName,
    })),
  );
});

it("gives the college the six shared assignment templates under axis 9 with their items, the secretary's granting its role, once, and keeps one already there (Step 21)", async () => {
  const { db, pool } = await freshDatabase();
  const collegeId = await seedBase(db, college);
  await pool.query(
    `update assignment_template_items set title = 'بند معدّل'
     where position = 0 and template_id = (select id from assignment_templates where key = 'safety-supervisor')`,
  );
  await seedBase(db, college);

  const { rows } = await pool.query(`
    select t.key, t.title, t.department_id, a.code as axis, r.key as grants,
      array_agg(i.title order by i.position) as items
    from assignment_templates t
    join axes a on a.id = t.axis_id
    left join roles r on r.id = t.grants_role_id
    join assignment_template_items i on i.template_id = t.id
    group by t.id, a.code, r.key order by t.id`);
  expect(rows).toEqual(
    assignmentCatalog.map((template) => ({
      key: template.key,
      title: template.title,
      department_id: null,
      axis: "9",
      grants: template.grants ?? null,
      items: template.items.map(({ title }, index) =>
        template.key === "safety-supervisor" && index === 0
          ? "بند معدّل"
          : title,
      ),
    })),
  );
  expect(rows.flatMap(({ items }) => items)).toHaveLength(41);
  // Evidence is welcome and not required, of every type the college accepts.
  expect(
    (
      await pool.query(
        "select distinct kind, evidence from assignment_template_items",
      )
    ).rows,
  ).toEqual([
    {
      kind: "general",
      evidence: {
        required: false,
        types: await getSetting("files.acceptedTypes", { collegeId }, db),
        maxFiles: 5,
        requiresApproval: false,
      },
    },
  ]);
});

it("gives the college Rayat's column maps, once, and keeps a map an admin changed (Step 16)", async () => {
  const { db, pool } = await freshDatabase();
  const collegeId = await seedBase(db, college);
  const maps = async () =>
    (
      await pool.query(
        "select key, value, version from settings where key like 'rayat.%' order by key",
      )
    ).rows;
  expect(await maps()).toEqual(
    Object.entries(rayatColumns)
      .map(([kind, value]) => ({
        key: `rayat.columns.${kind}`,
        value,
        version: 1,
      }))
      .sort((a, b) => (a.key < b.key ? -1 : 1)),
  );
  const sf01 = "rayat.columns.sf01";
  const changed = { ...rayatColumns.sf01, traineeStatus: "حالة المتدرب الآن" };
  await pool.query(
    "update settings set value = $2, version = 2 where college_id = $1 and key = $3",
    [collegeId, changed, sf01],
  );
  await seedBase(db, college);
  expect(await maps()).toContainEqual({
    key: sf01,
    value: changed,
    version: 2,
  });
});

it("gives the default roles their order of pages, once, and keeps an order an admin changed (UX review 2)", async () => {
  const { db, pool } = await freshDatabase();
  const collegeId = await seedBase(db, college);
  const order = async () =>
    (
      await pool.query(
        "select value from settings where college_id = $1 and key = 'navigation.order'",
        [collegeId],
      )
    ).rows[0]?.value;
  expect(await order()).toEqual(defaultNavigationOrder);
  const changed = { head: ["today", "people", "plan"] };
  await pool.query(
    "update settings set value = $2 where college_id = $1 and key = 'navigation.order'",
    [collegeId, changed],
  );
  await seedBase(db, college);
  expect(await order()).toEqual(changed);
});

it("leaves a default role's keys as the admins set them when it runs again", async () => {
  const { db, pool } = await freshDatabase();
  await seedBase(db, college);
  await pool.query(`
    delete from role_permissions
    where role_id = (select id from roles where key = 'trainer')`);
  await seedBase(db, college);

  expect(
    (
      await pool.query(`
        select count(*) from role_permissions
        where role_id = (select id from roles where key = 'trainer')`)
    ).rows,
  ).toEqual([{ count: "0" }]);
});

it("creates one college when several runs start at once", async () => {
  const { db, pool } = await freshDatabase();
  // Open the connections first, so the runs reach the database together.
  const clients = await Promise.all(
    Array.from({ length: 8 }, () => pool.connect()),
  );
  for (const client of clients) client.release();

  const ids = await Promise.all(
    Array.from({ length: 8 }, () => seedBase(db, college)),
  );

  const { rows } = await pool.query("select id from colleges");
  expect(rows).toEqual([{ id: ids[0] }]);
  expect(new Set(ids).size).toBe(1);
});

// A college seeded before a step gave the head a key has a head without it, and the base seed
// never adds a key to a role it finds: the step's migration adds it, once (Audit 3). plan.edit was
// out of the code for a day before Step 18 brought it back (docs/PLAN.md, section 0).
it.each([
  {
    college: "seeded before Step 10 its new keys through migration 0009",
    migration: "0009_people_and_accounts.sql",
    added: ["accounts.linkEmployeeNumber", "accounts.resetPassword"],
  },
  {
    college: "seeded while plan.edit was out the key through migration 0020",
    migration: "0020_section_templates.sql",
    added: ["plan.edit"],
  },
  {
    college: "seeded before Step 19 its new key through migration 0023",
    migration: "0023_department_plans.sql",
    added: ["plan.publish"],
  },
  {
    college: "seeded before Step 21 its new key through migration 0026",
    migration: "0026_assignments.sql",
    added: ["assignment.manage"],
  },
])("gives the head of a college $college, once", async ({
  migration,
  added,
}) => {
  const { db, pool } = await freshDatabase();
  await seedBase(db, college);
  await pool.query(
    `delete from role_permissions
     where permission = any($1) and role_id = (select id from roles where key = 'head')`,
    [added],
  );
  const inserts = readFileSync(
    new URL(`../../db/migrations/${migration}`, import.meta.url),
    "utf8",
  )
    .split("--> statement-breakpoint")
    .filter((statement) =>
      statement.includes('INSERT INTO "role_permissions"'),
    );
  for (const run of [1, 2]) {
    for (const statement of inserts) await pool.query(statement);
    expect(
      (
        await pool.query(
          `select p.permission from role_permissions p join roles r on r.id = p.role_id
           where r.key = 'head' and p.permission = any($1) order by p.permission`,
          [added],
        )
      ).rows,
      `run ${run}`,
    ).toEqual(added.map((permission) => ({ permission })));
  }
});

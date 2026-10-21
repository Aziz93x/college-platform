import { afterAll, expect, it } from "vitest";
import { defaultRoles, seedBase, systemRole } from "../../db/seed/base.ts";
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

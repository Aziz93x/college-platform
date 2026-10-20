import { afterAll, expect, it } from "vitest";
import { seedBase } from "../../db/seed/base.ts";
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

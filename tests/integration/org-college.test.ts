import { afterAll, beforeAll, expect, it } from "vitest";
import { findCollege, findCollegeId } from "../../src/modules/org/index.ts";
import { createTestDatabase } from "./support/database.ts";

let database: Awaited<ReturnType<typeof createTestDatabase>>;

beforeAll(async () => {
  database = await createTestDatabase();
});

afterAll(() => database?.drop());

const insertCollege = async (name: string) =>
  (
    await database.pool.query(
      "insert into colleges (name, short_name) values ($1, $1) returning id",
      [name],
    )
  ).rows[0].id;

it("finds no college before db:seed", async () => {
  await expect(findCollegeId(database.db)).resolves.toBeUndefined();
  await expect(findCollege(database.db)).resolves.toBeUndefined();
});

it("finds the college created first", async () => {
  const first = await insertCollege("First");
  await insertCollege("Second");
  // An update writes a new row version after the second college's, so an unordered read finds that one first.
  await database.pool.query(
    "update colleges set name = 'Renamed' where id = $1",
    [first],
  );

  await expect(findCollegeId(database.db)).resolves.toBe(first);
});

it("gives the first college's names with its id", async () => {
  const id = await findCollegeId(database.db);
  await expect(findCollege(database.db)).resolves.toEqual({
    id,
    name: "Renamed",
    shortName: "First",
  });
});

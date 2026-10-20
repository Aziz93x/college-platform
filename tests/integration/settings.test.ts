import { afterAll, beforeAll, expect, it } from "vitest";
import { seedBase } from "../../db/seed/base.ts";
import { getSetting } from "../../src/modules/settings/index.ts";
import { createTestDatabase } from "./support/database.ts";

let database: Awaited<ReturnType<typeof createTestDatabase>>;
let collegeId: string;
let otherCollegeId: string;

beforeAll(async () => {
  database = await createTestDatabase();
  collegeId = await seedBase(database.db, {
    name: "Test College",
    shortName: "TC",
  });
  const { rows } = await database.pool.query(
    "insert into colleges (name, short_name) values ('Other College', 'OC') returning id",
  );
  otherCollegeId = rows[0].id;
});

afterAll(() => database?.drop());

async function store(college: string, key: string, value: unknown) {
  await database.pool.query(
    `insert into settings (college_id, key, value) values ($1, $2, $3)
     on conflict (college_id, key) do update set value = excluded.value`,
    [college, key, JSON.stringify(value)],
  );
}

const timeZone = () =>
  getSetting("locale.timeZone", { collegeId }, database.db);

it("returns the registered default while the college has no stored value", async () => {
  // Rows for another college or another key do not count.
  await store(otherCollegeId, "locale.timeZone", "Asia/Dubai");
  await store(collegeId, "locale.other", "Europe/London");

  await expect(timeZone()).resolves.toBe("Asia/Riyadh");
});

it("returns the stored value once one exists", async () => {
  await store(collegeId, "locale.timeZone", "Asia/Dubai");

  await expect(timeZone()).resolves.toBe("Asia/Dubai");
});

it("throws, naming the key, when the stored value fails the schema", async () => {
  await store(collegeId, "locale.timeZone", "Mars/Olympus");

  await expect(timeZone()).rejects.toThrow(
    "Invalid stored value for setting locale.timeZone",
  );
});

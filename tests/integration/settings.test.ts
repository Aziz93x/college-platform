import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { seedBase } from "../../db/seed/base.ts";
import { getSetting } from "../../src/modules/settings/index.ts";
import { logger } from "../../src/platform/logging/logger.ts";
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

// One bad row, such as one a later step's stricter schema refuses, must not take down every page.
it("falls back to the default when the stored value fails the schema, and logs the key, never the value", async () => {
  const logged = vi.spyOn(logger, "error").mockImplementation(() => {});
  await store(collegeId, "locale.timeZone", "Mars/Olympus");

  await expect(timeZone()).resolves.toBe("Asia/Riyadh");
  expect(logged).toHaveBeenCalledWith(
    expect.objectContaining({ setting: "locale.timeZone" }),
    expect.any(String),
  );
  expect(JSON.stringify(logged.mock.calls)).not.toContain("Mars/Olympus");
  logged.mockRestore();
});

// "ar" is the only language with a catalog so far, so the stored value equals the default;
// the refused value shows the row is read.
const language = () =>
  getSetting("locale.language", { collegeId }, database.db);

it("returns the default language, then the stored one, and the default again for a language the schema refuses", async () => {
  const logged = vi.spyOn(logger, "error").mockImplementation(() => {});
  await expect(language()).resolves.toBe("ar");

  await store(collegeId, "locale.language", "ar");
  await expect(language()).resolves.toBe("ar");
  expect(logged).not.toHaveBeenCalled();

  await store(collegeId, "locale.language", "xx");
  await expect(language()).resolves.toBe("ar");
  expect(logged).toHaveBeenCalledOnce();
  logged.mockRestore();
});

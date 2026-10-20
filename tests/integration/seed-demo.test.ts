import type { Pool } from "pg";
import { afterAll, expect, it } from "vitest";
import { demoCollege } from "../../db/seed/demo/college.ts";
import {
  createTestDatabase,
  runScript,
  scriptEnv,
} from "./support/database.ts";
import { tableRows } from "./support/rows.ts";

const databases: Awaited<ReturnType<typeof createTestDatabase>>[] = [];

async function freshDatabase() {
  const database = await createTestDatabase();
  databases.push(database);
  return database;
}

afterAll(() => Promise.all(databases.map((database) => database.drop())));

const seedDemo = (args: string[], env: NodeJS.ProcessEnv) =>
  runScript("db/seed/demo.ts", args, env);

async function seedDemoOk(url: string) {
  const result = await seedDemo(["--seed", "42"], scriptEnv(url));
  expect(result.code, result.stderr).toBe(0);
}

const collegeNames = async (pool: Pool) =>
  (await pool.query("select name, short_name from colleges")).rows;

const theDemoCollege = [
  { name: demoCollege.name, short_name: demoCollege.shortName },
];

it("gives db:seed's college the demo values and settings, then a second run changes no row", async () => {
  const { url, pool } = await freshDatabase();
  const base = await runScript("db/seed/base.ts", [], scriptEnv(url));
  expect(base.code, base.stderr).toBe(0);

  await seedDemoOk(url);
  const first = await tableRows(pool);
  await seedDemoOk(url);

  expect(await tableRows(pool)).toEqual(first);
  expect(Object.keys(first)).toEqual(
    expect.arrayContaining([
      "public.audit_events",
      "public.colleges",
      "public.settings",
    ]),
  );
  expect(await collegeNames(pool)).toEqual(theDemoCollege);
  expect(
    (await pool.query("select key, value from settings order by key")).rows,
  ).toEqual([{ key: "locale.language", value: "ar" }]);
});

it("builds the same rows from the same seed on two fresh databases", async () => {
  const [one, two] = await Promise.all([freshDatabase(), freshDatabase()]);
  await seedDemoOk(one.url);
  await seedDemoOk(two.url);

  const generated = ["id", "college_id", "created_at", "updated_at"];
  expect(await tableRows(two.pool, generated)).toEqual(
    await tableRows(one.pool, generated),
  );
  expect(await collegeNames(one.pool)).toEqual(theDemoCollege);
});

it("refuses to run when APP_ENV is production or unset, and writes nothing", async () => {
  const { url, pool } = await freshDatabase();
  const { APP_ENV: _unset, ...withoutAppEnv } = scriptEnv(url);

  for (const env of [
    scriptEnv(url, { APP_ENV: "production" }),
    withoutAppEnv,
  ]) {
    const result = await seedDemo([], env);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain(
      "seed:demo refuses to run when APP_ENV=production",
    );
  }
  expect(await collegeNames(pool)).toEqual([]);
});

it("exits 1 when --seed is not a whole number from 0 to 2^32 - 1", async () => {
  const { url, pool } = await freshDatabase();

  for (const value of ["abc", "-1", "1.5", "", "0x10", "1e3", "4294967296"]) {
    const result = await seedDemo([`--seed=${value}`], scriptEnv(url));
    expect(result.code, value).toBe(1);
    expect(result.stderr).toContain("--seed must be a whole number");
  }
  expect(await collegeNames(pool)).toEqual([]);
});

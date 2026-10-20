import type { Pool } from "pg";
import { afterAll, beforeAll, expect, it } from "vitest";
import journal from "../../db/migrations/meta/_journal.json" with {
  type: "json",
};
import {
  createBlankDatabase,
  runScript,
  scriptEnv,
} from "./support/database.ts";
import { nonSystem, tableRows } from "./support/rows.ts";

let database: Awaited<ReturnType<typeof createBlankDatabase>>;

beforeAll(async () => {
  database = await createBlankDatabase();
});

afterAll(() => database?.drop());

async function migrateAndSeed() {
  for (const file of ["db/migrate.ts", "db/seed/base.ts"]) {
    const result = await runScript(file, [], scriptEnv(database.url));
    expect(result.code, result.stderr).toBe(0);
  }
}

// Everything a re-run could change: the catalog of every non-system schema and every row in it,
// pg-boss's tables included.
async function snapshot(pool: Pool) {
  const rows = async (query: string) => (await pool.query(query)).rows;
  return {
    tables: await rows(`
      select table_schema, table_name, table_type from information_schema.tables
      where ${nonSystem("table_schema")} order by 1, 2`),
    columns: await rows(`
      select table_schema, table_name, column_name, data_type, is_nullable, column_default
      from information_schema.columns
      where ${nonSystem("table_schema")} order by 1, 2, column_name`),
    constraints: await rows(`
      select n.nspname, c.conrelid::regclass::text as table, c.conname, pg_get_constraintdef(c.oid)
      from pg_constraint c join pg_namespace n on n.oid = c.connamespace
      where ${nonSystem("n.nspname")} order by 1, 2, 3`),
    indexes: await rows(`
      select schemaname, tablename, indexname, indexdef from pg_indexes
      where ${nonSystem("schemaname")} order by 1, 2, 3`),
    rows: await tableRows(pool),
  };
}

it("running db:migrate and db:seed twice leaves the database unchanged", async () => {
  await migrateAndSeed();
  const first = await snapshot(database.pool);
  await migrateAndSeed();
  const second = await snapshot(database.pool);

  expect(second).toEqual(first);
  expect(first.rows).toMatchObject({
    "public.colleges": [expect.any(String)],
    // One row per migration in the journal.
    "drizzle.__drizzle_migrations": journal.entries.map(() =>
      expect.any(String),
    ),
    "pgboss.version": [expect.any(String)],
  });
});

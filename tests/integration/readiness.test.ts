import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import type { Pool } from "pg";
import { afterAll, beforeAll, expect, test } from "vitest";
import { migrateDatabase } from "../../db/migrate.ts";
import { createDb } from "../../src/platform/db/client.ts";
import { checkReadiness } from "../../src/platform/health/readiness.ts";
import { POSTGRES_IMAGE } from "../support/postgres.ts";

// A container of its own, because the last test stops it.
let container: StartedPostgreSqlContainer;
let pool: Pool;
let stopped = false;

beforeAll(async () => {
  container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  ({ pool } = createDb(container.getConnectionUri()));
});

afterAll(async () => {
  await pool?.end();
  if (!stopped) await container?.stop();
});

test("the queue is down until the migrations install pg-boss", async () => {
  expect(await checkReadiness(pool)).toEqual({
    ok: false,
    checks: { database: true, queue: false },
  });

  await migrateDatabase(container.getConnectionUri());

  expect(await checkReadiness(pool)).toEqual({
    ok: true,
    checks: { database: true, queue: true },
  });
});

test("the database is down within 5 s of PostgreSQL stopping", async () => {
  await container.stop();
  stopped = true;

  const started = performance.now();
  const result = await checkReadiness(pool);

  expect(performance.now() - started).toBeLessThan(5000);
  expect(result).toMatchObject({ ok: false, checks: { database: false } });
});

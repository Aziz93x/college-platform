import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createTestDatabase, scriptEnv } from "./support/database.ts";

let database: Awaited<ReturnType<typeof createTestDatabase>>;

beforeAll(async () => {
  database = await createTestDatabase();
});

afterAll(() => database?.drop());

it("lets a query wait for a free connection while every one is busy", async () => {
  const { pool } = database;
  const busy = await Promise.all(
    Array.from({ length: pool.options.max }, () => pool.connect()),
  );

  const query = pool.query("select 1 as answer");
  // Longer than the connect timeout the pool used to have, which also failed a query waiting here.
  await new Promise((resolve) => setTimeout(resolve, 2500));
  for (const client of busy) client.release();

  await expect(query).resolves.toMatchObject({ rows: [{ answer: 1 }] });
});

// A process of the platform, the app or the worker, whose transaction the server ends (a restart or
// a failover) fails that transaction and goes on (the platform-wide check).
it("goes on when the server ends a connection a transaction holds", async () => {
  const root = resolve(import.meta.dirname, "../..");
  const script = `
import { sql } from "drizzle-orm";
import { createDb } from "${root}/src/platform/db/client.ts";
const { db, pool } = createDb(process.env.DATABASE_URL);
try {
  await db.transaction((tx) => tx.execute(sql\`select pg_sleep(60)\`));
  console.log("done");
} catch {
  console.log("failed");
}
await pool.end();
console.log("running");
`;
  const child = spawn(process.execPath, ["--input-type=module", "-e", script], {
    cwd: root,
    env: scriptEnv(database.url),
  });
  let out = "";
  child.stdout.on("data", (chunk) => {
    out += chunk;
  });
  const exited = new Promise<number | null>((done) =>
    child.on("exit", (code) => done(code)),
  );
  const pid = await vi.waitFor(
    async () => {
      const { rows } = await database.pool.query<{ pid: number }>(
        "select pid from pg_stat_activity where query like 'select pg_sleep(60)%'",
      );
      expect(rows).toHaveLength(1);
      return rows[0].pid;
    },
    { timeout: 30_000, interval: 100 },
  );
  await database.pool.query("select pg_terminate_backend($1)", [pid]);
  expect({ code: await exited, out: out.trim().split("\n") }).toEqual({
    code: 0,
    out: ["failed", "running"],
  });
});

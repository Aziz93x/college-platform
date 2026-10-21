import { randomBytes } from "node:crypto";
import { Client, Pool } from "pg";
import { afterAll, beforeAll, expect, inject, it } from "vitest";
import { grantAppRole } from "../../db/migrate.ts";
import { createLogger } from "../../src/platform/logging/logger.ts";
import { startWorker } from "../../worker/start.ts";
import {
  createBlankDatabase,
  createTestDatabase,
  runScript,
  scriptEnv,
} from "./support/database.ts";

let database: Awaited<ReturnType<typeof createTestDatabase>>;
let app: Pool;
let appUrl: string;
const role = `app_${randomBytes(6).toString("hex")}`;
const cliRole = `cli_${randomBytes(6).toString("hex")}`;

// The URL the app would use: the same database, as the role db:migrate grants.
function urlFor(password: string) {
  const url = new URL(database.url);
  url.username = role;
  url.password = password;
  return url.toString();
}

beforeAll(async () => {
  database = await createTestDatabase();
  appUrl = urlFor(randomBytes(12).toString("hex"));
  await grantAppRole(database.url, appUrl);
  app = new Pool({ connectionString: appUrl });
  // The drop after the tests ends any connection the pool still closes; without a listener, as
  // createDb's pools have, that error would crash the whole run.
  app.on("error", () => {});
});

afterAll(async () => {
  await app?.end();
  await database?.drop();
  // Roles belong to the whole server; its rights went with the database.
  const admin = new Client({ connectionString: inject("adminUrl") });
  await admin.connect();
  await admin.query(`drop role if exists ${role}`);
  await admin.query(`drop role if exists ${cliRole}`);
  await admin.end();
});

it("reads and writes the platform's rows", async () => {
  await app.query(
    "insert into colleges (name, short_name) values ('Test College', 'TC')",
  );
  await app.query(
    `insert into audit_events (college_id, action, entity_type, entity_id)
     select id, 'college.create', 'college', id::text from colleges`,
  );
  const { rows } = await app.query("select action from audit_events");
  expect(rows).toEqual([{ action: "college.create" }]);
});

it("is bound by the audit log's triggers, which it cannot switch off", async () => {
  await expect(
    app.query("update audit_events set action = 'college.delete'"),
  ).rejects.toThrow("audit_events is append-only");
  await expect(
    app.query(
      "alter table audit_events disable trigger audit_events_no_update_or_delete",
    ),
  ).rejects.toThrow("must be owner of table audit_events");
  await expect(app.query("truncate audit_events")).rejects.toThrow(
    "permission denied",
  );
});

it("is no superuser and creates no table", async () => {
  const { rows } = await app.query(
    "select rolsuper, rolcreatedb, rolcreaterole from pg_roles where rolname = current_user",
  );
  expect(rows).toEqual([
    { rolsuper: false, rolcreatedb: false, rolcreaterole: false },
  ]);
  await expect(app.query("create table mine (id int)")).rejects.toThrow(
    "permission denied for schema public",
  );
});

it("gets the same rights on a table a later migration adds", async () => {
  await database.pool.query("create table later (id int)");
  await app.query("insert into later values (1)");
  expect((await app.query("select id from later")).rows).toEqual([{ id: 1 }]);
});

it("takes a new password on the next run and keeps its rights", async () => {
  const changed = urlFor(randomBytes(12).toString("hex"));
  await grantAppRole(database.url, changed);
  const client = new Client({ connectionString: changed });
  await client.connect();
  try {
    expect(
      (await client.query("select count(*)::int from colleges")).rows,
    ).toEqual([{ count: 1 }]);
  } finally {
    await client.end();
  }
  await expect(
    new Client({ connectionString: appUrl }).connect(),
  ).rejects.toThrow("password authentication failed");
  appUrl = changed;
});

it("runs the worker's heartbeat", async () => {
  let output = "";
  const logger = createLogger({ write: (line) => (output += line) });
  const { boss, stop } = await startWorker({ databaseUrl: appUrl, logger });
  try {
    const jobId = await boss.send("heartbeat");
    await expect
      .poll(() => output.includes(`"jobId":"${jobId}"`), { timeout: 10_000 })
      .toBe(true);
  } finally {
    await stop();
  }
});

it("db:migrate grants the role that APP_DATABASE_URL names", async () => {
  const blank = await createBlankDatabase();
  try {
    const url = new URL(blank.url);
    url.username = cliRole;
    url.password = randomBytes(12).toString("hex");
    const result = await runScript(
      "db/migrate.ts",
      [],
      scriptEnv(blank.url, { APP_DATABASE_URL: url.toString() }),
    );
    expect(result.code, result.stderr).toBe(0);
    const client = new Client({ connectionString: url.toString() });
    await client.connect();
    try {
      expect(
        (await client.query("select count(*)::int from colleges")).rows,
      ).toEqual([{ count: 0 }]);
    } finally {
      await client.end();
    }
  } finally {
    await blank.drop();
  }
});

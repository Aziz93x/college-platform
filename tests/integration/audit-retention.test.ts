import { randomBytes } from "node:crypto";
import { Client, Pool } from "pg";
import { afterAll, beforeAll, expect, inject, it, vi } from "vitest";
import { grantAppRole } from "../../db/migrate.ts";
import { purgeAuditEvents } from "../../src/modules/audit/index.ts";
import { createDb } from "../../src/platform/db/client.ts";
import { createLogger } from "../../src/platform/logging/logger.ts";
import { startWorker } from "../../worker/start.ts";
import { createTestDatabase } from "./support/database.ts";

// The retention purge as the app's role runs it: the only way old events leave the log (Step 11).
let database: Awaited<ReturnType<typeof createTestDatabase>>;
let app: Pool;
let appUrl: string;
const role = `app_${randomBytes(6).toString("hex")}`;

beforeAll(async () => {
  database = await createTestDatabase();
  const url = new URL(database.url);
  url.username = role;
  url.password = randomBytes(12).toString("hex");
  appUrl = url.toString();
  await grantAppRole(database.url, appUrl);
  app = new Pool({ connectionString: appUrl });
  app.on("error", () => {});
});

afterAll(async () => {
  await app?.end();
  await database?.drop();
  const admin = new Client({ connectionString: inject("adminUrl") });
  await admin.connect();
  await admin.query(`drop role if exists ${role}`);
  await admin.end();
});

async function college(name: string) {
  const { rows } = await database.pool.query(
    "insert into colleges (name, short_name) values ($1, $1) returning id",
    [name],
  );
  return rows[0].id as string;
}

// An event of the college, written the given time ago.
const event = (collegeId: string, age: string, action: string) =>
  database.pool.query(
    `insert into audit_events (college_id, action, entity_type, entity_id, created_at)
     values ($1, $2, 'college', $3, now() - $4::interval)`,
    [collegeId, action, collegeId, age],
  );

const actions = async (collegeId: string) =>
  (
    await database.pool.query(
      "select action, actor_id, diff from audit_events where college_id = $1 order by created_at, action",
      [collegeId],
    )
  ).rows;

it("removes old events through the purge alone, which keeps at least 12 months and one college's", async () => {
  const purged = await college("Purged");
  const other = await college("Other");
  await event(purged, "13 months", "college.old");
  await event(purged, "11 months", "college.recent");
  await event(other, "13 months", "college.elsewhere");

  await expect(
    app.query("select purge_audit_events($1, 11)", [purged]),
  ).rejects.toThrow("purge_audit_events keeps at least 12 months, not 11");
  const { rows } = await app.query(
    "select purge_audit_events($1, 12) as removed",
    [purged],
  );
  expect(rows).toEqual([{ removed: 1 }]);
  expect((await actions(purged)).map(({ action }) => action)).toEqual([
    "college.recent",
  ]);
  expect((await actions(other)).map(({ action }) => action)).toEqual([
    "college.elsewhere",
  ]);
});

it("records each purge that removed events, as the system, and nothing when none went", async () => {
  const collegeId = await college("Recorded");
  await event(collegeId, "40 months", "college.older");
  await event(collegeId, "38 months", "college.old");
  await event(collegeId, "2 months", "college.recent");
  const { db, pool } = createDb(appUrl);
  try {
    await expect(purgeAuditEvents(collegeId, 36, db)).resolves.toBe(2);
    await expect(purgeAuditEvents(collegeId, 36, db)).resolves.toBe(0);
  } finally {
    await pool.end();
  }
  expect(await actions(collegeId)).toEqual([
    { action: "college.recent", actor_id: null, diff: null },
    {
      action: "audit.purge",
      actor_id: null,
      diff: { months: 36, removed: 2 },
    },
  ]);
});

it("purges every college nightly by its own retention setting, as the app's role", async () => {
  const short = await college("Short memory");
  const long = await college("Default memory");
  await database.pool.query(
    "insert into settings (college_id, key, value) values ($1, 'audit.retentionMonths', '24')",
    [short],
  );
  for (const collegeId of [short, long]) {
    await event(collegeId, "30 months", "college.thirty");
    await event(collegeId, "70 months", "college.seventy");
  }
  let output = "";
  const logger = createLogger({
    write: (line) => {
      output += line;
    },
  });
  const { boss, stop } = await startWorker({ databaseUrl: appUrl, logger });
  try {
    expect((await boss.getSchedule("audit-retention"))?.cron).toBe(
      "17 0 * * *",
    );
    await boss.send("audit-retention");
    await vi.waitFor(() => expect(output).toContain(`"collegeId":"${long}"`), {
      timeout: 10_000,
      interval: 100,
    });
  } finally {
    await stop();
  }
  const kept = async (collegeId: string) =>
    (await actions(collegeId)).map(({ action }) => action);
  // 24 months for the first, the default 60 for the second.
  expect(await kept(short)).toEqual(["audit.purge"]);
  expect(await kept(long)).toEqual(["college.thirty", "audit.purge"]);
});

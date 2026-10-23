import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedBase } from "../../db/seed/base.ts";
import {
  countSessions,
  createAccount,
  listSessions,
  requirePasswordChange,
  revokeAllSessions,
  revokeEveryone,
  revokeSession,
} from "../../src/modules/identity/index.ts";
import { recordBeat, systemStatus } from "../../src/modules/system/index.ts";
import { listRuns, rerunPass } from "../../src/modules/tasks/index.ts";
import {
  collegeTexts,
  listTexts,
  resetText,
  setText,
} from "../../src/modules/texts/index.ts";
import { getDb } from "../../src/platform/db/client.ts";
import { createSharedTestDatabase } from "./support/database.ts";

// The admin's control panel on a real database (ADR-0029): someone's sessions and everyone's, the
// college's wording of the platform's texts, a failed pass of the generation engine run again,
// and the system's state.

let database: Awaited<ReturnType<typeof createSharedTestDatabase>>;
let collegeId: string;
let otherCollegeId: string;
let lastNumber = 7000;

const query = async (text: string, values: unknown[] = []) =>
  (await database.pool.query(text, values)).rows;

async function person(name: string, college = collegeId) {
  const employeeNumber = String(++lastNumber);
  const { userId } = await getDb().transaction((tx) =>
    createAccount(
      {
        collegeId: college,
        name,
        email: `p${employeeNumber}@college.example`,
        employeeNumber,
      },
      tx,
      "correct-horse-battery",
    ),
  );
  return userId;
}

// A session of someone's, signed in from a phone, alive or expired.
async function session(userId: string, expired = false) {
  const [row] = await query(
    `insert into sessions (token, user_id, expires_at, ip_address, user_agent)
     values (gen_random_uuid()::text, $1, now() + $2::interval, '10.0.30.9', 'iPhone Safari')
     returning id`,
    [userId, expired ? "-1 hour" : "1 day"],
  );
  return row.id as string;
}

// The events the log gained for an entity, oldest first.
const events = (entityId: string) =>
  query(
    "select action, actor_id as actor, diff from audit_events where entity_id = $1 order by created_at, id",
    [entityId],
  );

let admin: string;

beforeAll(async () => {
  database = await createSharedTestDatabase();
  collegeId = await seedBase(database.db, {
    name: "Test College",
    shortName: "TC",
  });
  [{ id: otherCollegeId }] = await query(
    "insert into colleges (name, short_name) values ('Other College', 'OC') returning id",
  );
  admin = await person("The Admin");
});

afterAll(() => database?.drop());

const change = () => ({
  collegeId,
  actorId: admin,
  ip: "10.0.30.7",
  userAgent: "integration-test",
});

describe("someone's sessions", () => {
  it("lists the live ones, last seen first, and counts the college's", async () => {
    const trainer = await person("A Trainer");
    const first = await session(trainer);
    await query(
      "update sessions set last_seen_at = now() - interval '1 hour' where id = $1",
      [first],
    );
    const second = await session(trainer);
    await session(trainer, true);
    expect((await listSessions(trainer)).map(({ id }) => id)).toEqual([
      second,
      first,
    ]);
    const counted = await countSessions(collegeId);
    await session(await person("Elsewhere", otherCollegeId));
    expect(await countSessions(collegeId)).toBe(counted);
  });

  it("ends one, only of the person's, and records where it was", async () => {
    const trainer = await person("Another Trainer");
    const someoneElse = await session(await person("Someone Else"));
    const own = await session(trainer);
    expect(await revokeSession(trainer, someoneElse, change())).toBe(
      "notFound",
    );
    expect(await revokeSession(trainer, own, change())).toBe("revoked");
    expect(await listSessions(trainer)).toEqual([]);
    expect(await events(trainer)).toEqual([
      {
        action: "session.revoke",
        actor: admin,
        diff: { address: "10.0.30.9", device: "iPhone Safari" },
      },
    ]);
  });

  it("ends all of them once, and refuses a person of another college", async () => {
    const trainer = await person("A Third Trainer");
    await session(trainer);
    await session(trainer);
    expect(await revokeAllSessions(trainer, change())).toBe("revoked");
    expect(await revokeAllSessions(trainer, change())).toBe("none");
    expect(await events(trainer)).toEqual([
      { action: "session.revokeAll", actor: admin, diff: { sessions: 2 } },
    ]);
    const outsider = await person("An Outsider", otherCollegeId);
    await session(outsider);
    expect(await revokeAllSessions(outsider, change())).toBe("notFound");
    expect(await listSessions(outsider)).toHaveLength(1);
  });

  it("requires a new password at the next request, once", async () => {
    const trainer = await person("A Fourth Trainer");
    await query("update users set must_change_password = false where id = $1", [
      trainer,
    ]);
    expect(await requirePasswordChange(trainer, change())).toBe("saved");
    expect(await requirePasswordChange(trainer, change())).toBe("unchanged");
    expect(
      await query(
        "select must_change_password as must from users where id = $1",
        [trainer],
      ),
    ).toEqual([{ must: true }]);
    expect((await events(trainer)).map(({ action }) => action)).toEqual([
      "account.requirePasswordChange",
    ]);
  });

  it("signs everyone of the college out but the admin's own session, and no one elsewhere", async () => {
    const kept = await session(admin);
    const trainer = await person("A Fifth Trainer");
    await session(trainer);
    const outsider = await person("Another Outsider", otherCollegeId);
    await session(outsider);
    const ended = await revokeEveryone(kept, change());
    expect(ended).toBeGreaterThan(0);
    expect((await listSessions(admin)).map(({ id }) => id)).toEqual([kept]);
    expect(await listSessions(trainer)).toEqual([]);
    expect(await listSessions(outsider)).toHaveLength(1);
    expect(await events(collegeId)).toContainEqual({
      action: "session.revokeEveryone",
      actor: admin,
      diff: { sessions: ended },
    });
  });
});

describe("the platform's texts", () => {
  const catalog = {
    nav: { today: "اليوم" },
    plan: { impact: "{tasks, plural, one {مهمة} other {# مهام}}" },
  };

  it("keeps the college's wording, with who changed it, and records it from and to", async () => {
    expect(await setText("nav.today", "يومي", catalog, change())).toEqual({
      status: "saved",
    });
    expect(await setText("nav.today", "يومي", catalog, change())).toEqual({
      status: "unchanged",
    });
    expect(await collegeTexts(collegeId)).toEqual([
      { key: "nav.today", value: "يومي" },
    ]);
    expect(await collegeTexts(otherCollegeId)).toEqual([]);
    expect(await listTexts(collegeId)).toMatchObject([
      { key: "nav.today", value: "يومي", updatedBy: "The Admin" },
    ]);
    await setText("nav.today", "مهام اليوم", catalog, change());
    expect(await events("nav.today")).toEqual([
      {
        action: "text.override",
        actor: admin,
        diff: { from: "اليوم", to: "يومي" },
      },
      {
        action: "text.override",
        actor: admin,
        diff: { from: "يومي", to: "مهام اليوم" },
      },
    ]);
  });

  it("refuses a key the catalog lacks and wording its code could not show, and changes nothing", async () => {
    expect(await setText("nav.gone", "شيء", catalog, change())).toEqual({
      status: "unknownKey",
    });
    expect(await setText("plan.impact", "مهام", catalog, change())).toEqual({
      status: "arguments",
    });
    expect(await setText("plan.impact", "{tasks", catalog, change())).toEqual({
      status: "syntax",
    });
    expect(await setText("plan.impact", "  ", catalog, change())).toEqual({
      status: "empty",
    });
    expect(await events("plan.impact")).toEqual([]);
  });

  it("puts the default back, by resetting or by its own words, and records the wording it removed", async () => {
    expect(await resetText("nav.today", change())).toEqual({ status: "saved" });
    expect(await resetText("nav.today", change())).toEqual({
      status: "unchanged",
    });
    await setText("nav.today", "يومي", catalog, change());
    expect(await setText("nav.today", "اليوم", catalog, change())).toEqual({
      status: "saved",
    });
    expect(await collegeTexts(collegeId)).toEqual([]);
    expect((await events("nav.today")).slice(-3)).toEqual([
      { action: "text.reset", actor: admin, diff: { from: "مهام اليوم" } },
      {
        action: "text.override",
        actor: admin,
        diff: { from: "اليوم", to: "يومي" },
      },
      { action: "text.reset", actor: admin, diff: { from: "يومي" } },
    ]);
  });
});

describe("a failed pass run again", () => {
  async function term(name: string, status = "draft") {
    const [row] = await query(
      `insert into terms (college_id, name, starts_on, weeks, status)
       values ($1, $2, '2027-01-03', 18, $3) returning id`,
      [collegeId, name, status],
    );
    return row.id as string;
  }
  async function pass(termId: string, status: string, minutesAgo = 10) {
    const [row] = await query(
      `insert into generation_runs (college_id, term_id, reason, status, error, queued_at)
       values ($1, $2, 'daily', $3, $4, now() - $5::interval) returning id`,
      [
        collegeId,
        termId,
        status,
        status === "failed" ? "connection reset" : null,
        `${minutesAgo} minutes`,
      ],
    );
    return row.id as string;
  }
  const meta = () => ({ actorId: admin, ip: "10.0.30.7", userAgent: "test" });

  it("queues a new pass the admin caused, over a term still open, and records it on the term", async () => {
    const termId = await term("Spring 2027");
    const failed = await pass(termId, "failed");
    expect(await rerunPass(collegeId, failed, meta())).toBe("queued");
    const [latest] = await listRuns(collegeId);
    expect(latest).toMatchObject({
      termId,
      termName: "Spring 2027",
      reason: "admin",
      status: "queued",
    });
    expect(await events(termId)).toEqual([
      { action: "generation.rerun", actor: admin, diff: null },
    ]);
    // The new pass comes after it, so the failed one is not run again twice.
    expect(await rerunPass(collegeId, failed, meta())).toBe("superseded");
  });

  it("refuses one that did not fail, one of a closed term, and one of another college", async () => {
    const open = await term("Summer 2027");
    expect(await rerunPass(collegeId, await pass(open, "done"), meta())).toBe(
      "notFailed",
    );
    const closed = await term("Fall 2026", "closed");
    expect(
      await rerunPass(collegeId, await pass(closed, "failed"), meta()),
    ).toBe("closed");
    expect(
      await rerunPass(otherCollegeId, await pass(open, "failed", 1), meta()),
    ).toBe("notFound");
    expect(await events(open)).toEqual([]);
  });
});

describe("the system's state", () => {
  it("reads the database, the queue and the database's size, and the worker from its beat", async () => {
    const now = new Date();
    const before = await systemStatus(now);
    expect(before).toMatchObject({
      database: true,
      queue: true,
      worker: "never",
    });
    expect(before.latencyMs).toBeGreaterThanOrEqual(0);
    expect(before.databaseBytes).toBeGreaterThan(0);
    await recordBeat();
    expect(await systemStatus(new Date())).toMatchObject({
      worker: "running",
    });
    expect(
      await systemStatus(new Date(Date.now() + 10 * 60_000)),
    ).toMatchObject({ worker: "late" });
  });
});

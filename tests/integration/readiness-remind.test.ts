import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { demoAccounts } from "../../db/seed/demo/accounts.ts";
import { demoDepartments } from "../../db/seed/demo/departments.ts";
import { holdersIn } from "../../src/modules/access/index.ts";
import { notificationPage } from "../../src/modules/notifications/index.ts";
import { listDepartments } from "../../src/modules/org/index.ts";
import {
  type ReadinessRow,
  type RowKey,
  remindOwners,
} from "../../src/modules/readiness/index.ts";
import { getSetting } from "../../src/modules/settings/index.ts";
import { activeTerm, createTerm } from "../../src/modules/terms/index.ts";
import { wallClock } from "../../src/platform/i18n/time-zone.ts";
import {
  createTestDatabase,
  runScript,
  scriptEnv,
} from "./support/database.ts";

// Reminding the owners of an open row of the readiness board (lead review D, proposal 5), on the
// demo database, whose term owes the matched row, which waits on the admin, and General Studies'
// plan, which waits on its head.
let database: Awaited<ReturnType<typeof createTestDatabase>>;
let collegeId: string;
let termId: string;
let termName: string;
let timeZone: string;
const department: Record<string, string> = {};
const DAY = 86_400_000;

const query = async (text: string, values: unknown[] = []) =>
  (await database.pool.query(text, values)).rows;

const person = async (email: string) =>
  (await query("select id, name from users where email = $1", [email]))[0] as {
    id: string;
    name: string;
  };

// The row's words as the board would give them, made plain to compare.
const words = (row: ReadinessRow) => ({
  title: `title of ${row.id}`,
  detail: `detail of ${row.id}`,
});

const remind = (
  sender: { id: string },
  row: RowKey,
  {
    reach = "college",
    at = new Date(),
    term = termId,
    drafts = true,
  }: {
    reach?: "college" | string[];
    at?: Date;
    term?: string;
    drafts?: boolean;
  } = {},
) =>
  remindOwners(
    { termId: term, row },
    { reach, drafts },
    { collegeId, actorId: sender.id },
    words,
    at,
    database.db,
  );

const remindersOf = (userId: string) =>
  query(
    `select params, once_key as "onceKey" from notifications
     where user_id = $1 and kind = 'readinessReminder' order by created_at`,
    [userId],
  );
// This file's reminders' events, by their words above: the log keeps the demo's own as well.
const events = () =>
  query(
    `select actor_id as "actorId", entity_type as "entityType", entity_id as "entityId", diff
     from audit_events where action = 'readiness.remind' and diff->>'title' like 'title of %'
     order by created_at`,
  );

beforeAll(async () => {
  database = await createTestDatabase();
  const seeded = await runScript(
    "db/seed/demo.ts",
    ["--seed", "42"],
    scriptEnv(database.url),
  );
  expect(seeded.code, seeded.stderr).toBe(0);
  // The demo's vice-dean reminded the admin of the matched row as it was seeded, today: the
  // reminders here start from none.
  await query("delete from notifications where kind = 'readinessReminder'");
  [{ id: collegeId }] = await query("select id from colleges");
  const term = await activeTerm(collegeId, database.db);
  if (!term) throw new Error("the demo term is missing");
  termId = term.id;
  termName = term.name;
  timeZone = await getSetting("locale.timeZone", { collegeId }, database.db);
  for (const each of await listDepartments(collegeId, database.db)) {
    department[each.name] = each.id;
  }
});

afterAll(() => database?.drop());

describe("reminding the owners of an open row of the board", () => {
  it("tells the row's owners, but the sender, once a day each, with a notice that opens its page, and records it", async () => {
    const [viceDean, dean, admin] = await Promise.all([
      person(demoAccounts.viceDean.email),
      person(demoAccounts.dean.email),
      person(demoAccounts.admin.email),
    ]);
    const now = new Date();
    const day = wallClock(now, timeZone).slice(0, 10);

    expect(await remind(viceDean, { id: "matched" }, { at: now })).toEqual({
      status: "reminded",
      count: 1,
    });
    expect(await remindersOf(admin.id)).toEqual([
      {
        params: {
          title: "title of matched",
          detail: "detail of matched",
          from: viceDean.name,
          href: "/rayat",
          termId,
          term: termName,
        },
        onceKey: `readiness:${termId}:matched:${day}`,
      },
    ]);
    expect(await events()).toEqual([
      {
        actorId: viceDean.id,
        entityType: "term",
        entityId: termId,
        diff: { title: "title of matched", reached: 1 },
      },
    ]);

    // Someone else the same day reaches no one, and records nothing; the next day reaches them again.
    expect(await remind(dean, { id: "matched" }, { at: now })).toEqual({
      status: "reminded",
      count: 0,
    });
    expect(await remindersOf(admin.id)).toHaveLength(1);
    expect(await events()).toHaveLength(1);
    expect(
      await remind(dean, { id: "matched" }, { at: new Date(+now + DAY) }),
    ).toEqual({ status: "reminded", count: 1 });
    expect(await remindersOf(admin.id)).toHaveLength(2);
    expect(await events()).toHaveLength(2);
  });

  it("reminds a department's plan's publishers, for a sender who sees it", async () => {
    const generalStudies = department[demoDepartments[0].name];
    const viceDean = await person(demoAccounts.viceDean.email);
    const publishers =
      (
        await holdersIn(
          collegeId,
          [generalStudies],
          "plan.publish",
          database.db,
        )
      ).get(generalStudies) ?? [];
    expect(publishers.length).toBeGreaterThan(0);
    expect(
      await remind(viceDean, { id: "plan", departmentId: generalStudies }),
    ).toEqual({ status: "reminded", count: publishers.length });
    for (const { userId } of publishers) {
      expect((await remindersOf(userId)).at(-1)?.params).toMatchObject({
        title: "title of plan",
        href: `/plan?department=${generalStudies}`,
      });
    }
  });

  it("refuses a row out of the sender's reach, a settled one, and one that only the sender owns", async () => {
    const generalStudies = department[demoDepartments[0].name];
    const electrical = department[demoDepartments[1].name];
    const [head, viceDean, admin] = await Promise.all([
      person(demoAccounts.head.email),
      person(demoAccounts.viceDean.email),
      person(demoAccounts.admin.email),
    ]);
    const before = (await events()).length;
    // Electrical's head sees their own department's plan alone.
    expect(
      await remind(
        head,
        { id: "plan", departmentId: generalStudies },
        { reach: [electrical] },
      ),
    ).toEqual({ status: "notFound" });
    // The term is active and its framework published.
    expect(await remind(viceDean, { id: "term" })).toEqual({
      status: "notOpen",
    });
    expect(await remind(viceDean, { id: "framework" })).toEqual({
      status: "notOpen",
    });
    // The admin is the matched row's one owner.
    expect(await remind(admin, { id: "matched" })).toEqual({
      status: "nobody",
    });
    expect(
      await remindOwners(
        { termId: crypto.randomUUID(), row: { id: "matched" } },
        { reach: "college", drafts: true },
        { collegeId, actorId: viceDean.id },
        words,
        new Date(),
        database.db,
      ),
    ).toEqual({ status: "notFound" });
    expect(await events()).toHaveLength(before);
  });

  it("finds no row of a term before it starts for a sender who does not prepare terms, whose board shows none (lead review D)", async () => {
    const viceDean = await person(demoAccounts.viceDean.email);
    const next = await createTerm(
      { name: "الفصل التدريبي الثاني 1448", startsOn: "2027-01-10", weeks: 18 },
      { collegeId, actorId: viceDean.id },
      database.db,
    );
    if (next.status !== "created") throw new Error(next.status);
    const plan: RowKey = {
      id: "plan",
      departmentId: department[demoDepartments[1].name],
    };
    const before = (await events()).length;
    expect(
      await remind(viceDean, plan, { term: next.id, drafts: false }),
    ).toEqual({ status: "notFound" });
    expect(await events()).toHaveLength(before);
    // The vice-dean prepares terms: the next term's plan, not published yet, reaches its head, in
    // words that name the term, with a link that opens the plan on it.
    expect(await remind(viceDean, plan, { term: next.id })).toEqual({
      status: "reminded",
      count: 1,
    });
    const [{ userId: head }] =
      (
        await holdersIn(
          collegeId,
          [plan.departmentId],
          "plan.publish",
          database.db,
        )
      ).get(plan.departmentId) ?? [];
    const [{ params }] = (await remindersOf(head)).slice(-1);
    expect(params).toMatchObject({
      href: `/plan?department=${plan.departmentId}`,
      termId: next.id,
      term: "الفصل التدريبي الثاني 1448",
    });
    expect(notificationPage("readinessReminder", params)).toBe(
      `/switch-term/${next.id}?next=${encodeURIComponent(`/plan?department=${plan.departmentId}`)}`,
    );
  });

  it("leaves out an owner who turned such reminders off", async () => {
    const [viceDean, admin] = await Promise.all([
      person(demoAccounts.viceDean.email),
      person(demoAccounts.admin.email),
    ]);
    await query(
      `insert into notification_prefs (college_id, user_id, kind, channel, enabled)
       values ($1, $2, 'readinessReminder', 'inApp', false)`,
      [collegeId, admin.id],
    );
    const held = (await remindersOf(admin.id)).length;
    expect(
      await remind(
        viceDean,
        { id: "matched" },
        { at: new Date(Date.now() + 5 * DAY) },
      ),
    ).toEqual({ status: "reminded", count: 0 });
    expect(await remindersOf(admin.id)).toHaveLength(held);
    await query("delete from notification_prefs where user_id = $1", [
      admin.id,
    ]);
  });

  it("reminds no one of a closed term's rows", async () => {
    const viceDean = await person(demoAccounts.viceDean.email);
    await query("update terms set status = 'closed' where id = $1", [termId]);
    try {
      expect(
        await remind(
          viceDean,
          { id: "matched" },
          { at: new Date(Date.now() + 9 * DAY) },
        ),
      ).toEqual({ status: "notOpen" });
    } finally {
      await query("update terms set status = 'active' where id = $1", [termId]);
    }
  });
});

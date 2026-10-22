import { createFormatter, createTranslator } from "next-intl";
import { pino } from "pino";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedBase } from "../../db/seed/base.ts";
import messages from "../../messages/ar.json" with { type: "json" };
import { createAccount } from "../../src/modules/identity/index.ts";
import {
  chooseNotification,
  describeNotification,
  markRead,
  type Words,
} from "../../src/modules/notifications/index.ts";
import { notificationDigest } from "../../worker/jobs/notification-digest.ts";
import { createTestDatabase } from "./support/database.ts";

// The weekly digest as the worker sends it, read in the catalog's words (docs/PLAN.md, Step 12):
// on the college's day and hour, of the week's unread notifications, once per person and week.
let database: Awaited<ReturnType<typeof createTestDatabase>>;
let collegeId: string;
const people: Record<string, string> = {};

// The default schedule: Sunday 25 October 2026 at 7:00 in Riyadh is 4:00 UTC.
const SUNDAY_7 = "2026-10-25T04:00:00Z";
const minutesAfter = (iso: string, minutes: number) =>
  new Date(new Date(iso).getTime() + minutes * 60_000);

const query = async (text: string, values: unknown[] = []) =>
  (await database.pool.query(text, values)).rows;

// A notification someone got at a time, read or not.
const received = (
  name: string,
  at: string,
  params: Record<string, unknown>,
  read = false,
) =>
  query(
    `insert into notifications (college_id, user_id, kind, params, created_at, read_at)
     values ($1, $2, 'membershipAdded', $3, $4, ${read ? "$4" : "null"})`,
    [collegeId, people[name], JSON.stringify(params), at],
  );

const job = (now: Date) =>
  notificationDigest(pino({ enabled: false }), database.db, () => now)();

// Each digest the job sent, by its person, as the person reads it.
const t = createTranslator({
  locale: "ar-u-nu-latn",
  messages,
  namespace: "notifications",
});
const words = Object.assign(
  (key: string, values?: Record<string, unknown>) =>
    t(key as never, values as never),
  { has: (key: string) => t.has(key as never) },
) satisfies Words;
const format = createFormatter({ locale: "ar-u-nu-latn" });
const list = (items: string[]) => format.list(items, { type: "unit" });

async function digests() {
  const rows = await query(
    `select p.name, n.params, n.once_key from notifications n join users p on p.id = n.user_id
     where n.kind = 'weeklyDigest' order by p.name`,
  );
  return rows.map((row) => ({
    to: row.name as string,
    key: row.once_key as string,
    ...describeNotification(
      { kind: "weeklyDigest", params: row.params },
      words,
      list,
    ),
  }));
}

beforeAll(async () => {
  database = await createTestDatabase();
  collegeId = await seedBase(database.db, {
    name: "Test College",
    shortName: "TC",
  });
  for (const [name, number] of [
    ["هند", "1001"],
    ["فهد", "1002"],
    ["سارة", "1003"],
    ["نوف", "1004"],
  ]) {
    people[name] = await database.db.transaction(
      async (tx) =>
        (
          await createAccount(
            {
              collegeId,
              name,
              email: `${number}@college.example`,
              employeeNumber: number,
            },
            tx,
            `password-${number}`,
          )
        ).userId,
    );
  }
  const head = {
    role: "رئيس القسم",
    scope: "department",
    department: "التقنية الكهربائية",
  };
  const trainer = {
    role: "المدرب",
    scope: "department",
    department: "التقنية الميكانيكية",
  };
  const admin = { role: "مدير النظام", scope: "college" };
  // Hind: four unread in the week, one read, one from the week before.
  await received("هند", "2026-10-19T08:00:00Z", head);
  await received("هند", "2026-10-20T08:00:00Z", trainer);
  await received("هند", "2026-10-21T08:00:00Z", admin);
  await received("هند", "2026-10-22T08:00:00Z", trainer);
  await received("هند", "2026-10-23T08:00:00Z", admin, true);
  await received("هند", "2026-10-17T08:00:00Z", head);
  // Fahad: one unread, and one sent after the digest fell due, which waits for the next week.
  await received("فهد", "2026-10-24T08:00:00Z", trainer);
  await received("فهد", "2026-10-25T04:01:00Z", head);
  // Sara turned the digest off; Nouf read everything.
  await received("سارة", "2026-10-24T08:00:00Z", trainer);
  await chooseNotification(
    { kind: "weeklyDigest", enabled: false },
    { collegeId, actorId: people.سارة },
    database.db,
  );
  await received("نوف", "2026-10-24T08:00:00Z", trainer, true);
});

afterAll(() => database?.drop());

describe("the weekly digest", () => {
  it("reaches each person with unread notifications of the week, on Sunday at 7:00 on the college's clock", async () => {
    await job(minutesAfter(SUNDAY_7, -1));
    expect(await digests()).toEqual([]);

    await job(minutesAfter(SUNDAY_7, 5));
    expect(await digests()).toMatchInlineSnapshot(`
      [
        {
          "description": "أُسند إليك دور «المدرب» في قسم التقنية الميكانيكية.",
          "key": "weeklyDigest:2026-10-25",
          "title": "ملخص الأسبوع: إشعار لم تقرأه",
          "to": "فهد",
        },
        {
          "description": "أُسند إليك دور «المدرب» في قسم التقنية الميكانيكية، وأُسند إليك دور «مدير النظام» على مستوى الكلية، وأُسند إليك دور «المدرب» في قسم التقنية الميكانيكية، وإشعار آخر.",
          "key": "weeklyDigest:2026-10-25",
          "title": "ملخص الأسبوع: 4 إشعارات لم تقرأها",
          "to": "هند",
        },
      ]
    `);
  });

  it("is sent once per person and week, however often the job runs", async () => {
    const before = await digests();
    await job(minutesAfter(SUNDAY_7, 20));
    await job(minutesAfter(SUNDAY_7, 23 * 60));
    expect(await digests()).toEqual(before);
  });

  it("goes out late, within the day, when the worker was off at its hour, and not after", async () => {
    await query("delete from notifications where kind = 'weeklyDigest'");
    await job(minutesAfter(SUNDAY_7, 24 * 60));
    expect(await digests()).toEqual([]);
    await job(minutesAfter(SUNDAY_7, 24 * 60 - 1));
    expect((await digests()).map(({ to }) => to)).toEqual(["فهد", "هند"]);
  });

  it("follows the college's day and hour when the settings change", async () => {
    await query("delete from notifications where kind = 'weeklyDigest'");
    await query(
      `insert into settings (college_id, key, value) values
       ($1, 'reminders.digestDay', '"monday"'), ($1, 'reminders.digestHour', '9')`,
      [collegeId],
    );
    // Sunday at 7:00 is no longer its time; Monday at 9:00 in Riyadh, 6:00 UTC, is.
    await job(minutesAfter(SUNDAY_7, 5));
    expect(await digests()).toEqual([]);
    await job(new Date("2026-10-26T06:05:00Z"));
    expect((await digests()).map(({ key }) => key)).toEqual([
      "weeklyDigest:2026-10-26",
      "weeklyDigest:2026-10-26",
    ]);
  });

  it("keeps which notifications it counts, and is read with the last of them, in the same reading (ADR-0015)", async () => {
    const hind = { collegeId, actorId: people.هند };
    const theirs = await query(
      `select id from notifications where user_id = $1 and kind <> 'weeklyDigest' and read_at is null
       and created_at >= '2026-10-19T06:00:00Z' order by created_at desc, id desc`,
      [people.هند],
    );
    const digest = async (name: string) =>
      (
        await query(
          "select params, read_at from notifications where user_id = $1 and kind = 'weeklyDigest' and params ? 'ids'",
          [people[name]],
        )
      )[0];
    expect((await digest("هند")).params.ids).toEqual(
      theirs.map(({ id }) => id),
    );
    // A digest sent before it, which keeps no ids, stays as it was.
    await query(
      `insert into notifications (college_id, user_id, kind, params, created_at)
       values ($1, $2, 'weeklyDigest', $3, '2026-10-18T04:00:00Z')`,
      [
        collegeId,
        people.هند,
        JSON.stringify({ count: 1, latest: [{ kind: "x", params: {} }] }),
      ],
    );

    const [readLast, ...readFirst] = theirs.map(({ id }) => id as string);
    expect(await markRead({ ids: readFirst }, hind, database.db)).toBe(3);
    expect((await digest("هند")).read_at).toBeNull();
    expect(await markRead({ ids: [readLast] }, hind, database.db)).toBe(2);
    expect((await digest("هند")).read_at).not.toBeNull();
    expect(
      await query(
        `select diff from audit_events where action = 'notification.read' and actor_id = $1
         order by created_at, id`,
        [people.هند],
      ),
    ).toEqual([{ diff: { count: 3 } }, { diff: { count: 2 } }]);
    // Fahad's is his own, and the older digest is still unread.
    expect((await digest("فهد")).read_at).toBeNull();
    expect(
      await query(
        "select count(*)::int as n from notifications where user_id = $1 and read_at is null",
        [people.هند],
      ),
    ).toEqual([{ n: 2 }]);
  });
});

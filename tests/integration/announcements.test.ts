import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedBase } from "../../db/seed/base.ts";
import { joinRole } from "../../src/modules/access/index.ts";
import {
  listAnnouncements,
  publishAnnouncement,
  withdrawAnnouncement,
} from "../../src/modules/announcements/index.ts";
import { createAccount } from "../../src/modules/identity/index.ts";
import {
  markRead,
  notifyAll,
  unreadAnnouncements,
} from "../../src/modules/notifications/index.ts";
import type { Db } from "../../src/platform/db/client.ts";
import { createTestDatabase } from "./support/database.ts";

// What a head, the dean or the vice-dean announces (ADR-0017): it reaches every enabled account in
// its scope but its author, at once, and withdrawing it takes it back from all of them.
let database: Awaited<ReturnType<typeof createTestDatabase>>;
let collegeId: string;
let electrical: string;
let mechanical: string;
let closed: string;
const people: Record<string, string> = {};

const query = async (text: string, values: unknown[] = []) =>
  (await database.pool.query(text, values)).rows;

const change = (name: string) => ({ collegeId, actorId: people[name] });

// Who has the announcement among their notifications, read or not, by name.
const told = async (announcementId: string) =>
  (
    await query(
      `select u.name from notifications n join users u on u.id = n.user_id
       where n.kind = 'announcement' and n.params->>'announcementId' = $1 order by u.name`,
      [announcementId],
    )
  ).map(({ name }) => name);

beforeAll(async () => {
  database = await createTestDatabase();
  collegeId = await seedBase(database.db, {
    name: "Test College",
    shortName: "TC",
  });
  [{ id: electrical }, { id: mechanical }, { id: closed }] = await query(
    `insert into departments (college_id, name, short_name, active) values
     ($1, 'Electrical', 'Elec', true), ($1, 'Mechanical', 'Mech', true), ($1, 'Closed', 'Old', false)
     returning id`,
    [collegeId],
  );
  const holders = [
    ["dean", "dean", null],
    ["head", "head", electrical],
    ["hind", "trainer", electrical],
    ["huda", "trainer", electrical],
    ["dalal", "trainer", electrical],
    ["maha", "trainer", mechanical],
    ["noura", null, null],
  ] as const;
  for (const [name, role, departmentId] of holders) {
    people[name] = await database.db.transaction(
      async (tx) =>
        (
          await createAccount(
            {
              collegeId,
              name,
              email: `${name}@college.example`,
              employeeNumber: `7${Object.keys(people).length}0001`,
            },
            tx,
            `password-${name}`,
          )
        ).userId,
    );
    if (role) {
      await joinRole(
        { userId: people[name], collegeId, role: { key: role }, departmentId },
        database.db,
      );
    }
  }
  // Dalal's account is disabled: she cannot sign in to see anything.
  await query("update users set disabled_at = now() where id = $1", [
    people.dalal,
  ]);
});

afterAll(() => database?.drop());

describe("publishing", () => {
  it("reaches every enabled account in the department but its author, at once, and records how many", async () => {
    const result = await publishAnnouncement(
      { departmentId: electrical, title: "اجتماع القسم", body: "غدًا" },
      change("head"),
      database.db,
    );
    if (result.status !== "published") throw new Error(result.status);
    expect(result.reached).toBe(2);
    expect(await told(result.id)).toEqual(["hind", "huda"]);
    const [notice] = await query(
      "select params, read_at from notifications where user_id = $1 and kind = 'announcement'",
      [people.hind],
    );
    expect(notice).toEqual({
      params: {
        announcementId: result.id,
        title: "اجتماع القسم",
        body: "غدًا",
        author: "head",
        scope: "department",
        department: "Electrical",
      },
      read_at: null,
    });
    expect(
      await query(
        "select actor_id, entity_type, entity_id, diff from audit_events where action = 'announcement.publish'",
      ),
    ).toEqual([
      {
        actor_id: people.head,
        entity_type: "announcement",
        entity_id: result.id,
        diff: {
          to: { title: "اجتماع القسم", departmentId: electrical, reached: 2 },
        },
      },
    ]);
  });

  it("to the college, reaches everyone enabled in it, with a role or none, but its author", async () => {
    const result = await publishAnnouncement(
      { departmentId: null, title: "إجازة", body: "يوم الأحد" },
      change("dean"),
      database.db,
    );
    if (result.status !== "published") throw new Error(result.status);
    expect(await told(result.id)).toEqual([
      "head",
      "hind",
      "huda",
      "maha",
      "noura",
    ]);
  });

  it("refuses an inactive or unknown department, and writes nothing", async () => {
    const before = await query("select count(*)::int as n from announcements");
    for (const [departmentId, status] of [
      [closed, "inactive"],
      ["0199b2a4-0000-7000-8000-0000000000ff", "notFound"],
    ] as const) {
      expect(
        await publishAnnouncement(
          { departmentId, title: "x", body: "y" },
          change("dean"),
          database.db,
        ),
      ).toEqual({ status });
    }
    expect(await query("select count(*)::int as n from announcements")).toEqual(
      before,
    );
  });

  it("tells only with a kind no one turns off", async () => {
    await expect(
      notifyAll(
        {
          collegeId,
          userIds: [people.hind],
          kind: "membershipAdded",
          params: { role: "x", scope: "college" },
        },
        {} as Db,
      ),
    ).rejects.toThrow(/may be turned off/);
  });
});

describe("reading and withdrawing", () => {
  it("lists a scope's live announcements newest first, and a person's unread ones", async () => {
    const titles = async (scope: "college" | string[]) =>
      (await listAnnouncements(collegeId, scope, database.db)).map(
        ({ title, department, author }) => [title, department, author],
      );
    expect(await titles("college")).toEqual([
      ["إجازة", null, "dean"],
      ["اجتماع القسم", "Electrical", "head"],
    ]);
    expect(await titles([electrical])).toEqual([
      ["اجتماع القسم", "Electrical", "head"],
    ]);
    expect(await titles([mechanical])).toEqual([]);
    const reader = { collegeId, userId: people.hind };
    expect(
      (await unreadAnnouncements(reader, 10, database.db)).map(
        ({ params }) => params.title,
      ),
    ).toEqual(["إجازة", "اجتماع القسم"]);
    // Closing one reads it, as opening a notification does.
    const [newest] = await unreadAnnouncements(reader, 1, database.db);
    expect(
      await markRead({ ids: [newest.id] }, change("hind"), database.db),
    ).toBe(1);
    expect(
      (await unreadAnnouncements(reader, 10, database.db)).map(
        ({ params }) => params.title,
      ),
    ).toEqual(["اجتماع القسم"]);
  });

  it("takes a withdrawn one from everyone it reached, read or not, once, and records it", async () => {
    const [{ id }] = await query(
      "select id from announcements where title = 'إجازة'",
    );
    expect(await withdrawAnnouncement(id, change("dean"), database.db)).toEqual(
      {
        status: "withdrawn",
        removed: 5,
      },
    );
    expect(await told(id)).toEqual([]);
    expect(
      (await listAnnouncements(collegeId, "college", database.db)).map(
        ({ title }) => title,
      ),
    ).toEqual(["اجتماع القسم"]);
    expect(await withdrawAnnouncement(id, change("dean"), database.db)).toEqual(
      {
        status: "notFound",
      },
    );
    expect(
      await query(
        "select diff from audit_events where action = 'announcement.withdraw'",
      ),
    ).toEqual([
      {
        diff: {
          from: { title: "إجازة", departmentId: null },
          to: { retracted: 5 },
        },
      },
    ]);
  });
});

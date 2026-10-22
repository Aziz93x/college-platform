import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedBase } from "../../db/seed/base.ts";
import {
  addMembership,
  findRole,
  listRoles,
  removeMembership,
} from "../../src/modules/access/index.ts";
import { createAccount } from "../../src/modules/identity/index.ts";
import {
  chooseNotification,
  latestUnread,
  listNotifications,
  markRead,
  notificationChoices,
  notify,
  unreadCount,
} from "../../src/modules/notifications/index.ts";
import { createTestDatabase } from "./support/database.ts";
import { recording } from "./support/plans.ts";

// What the platform tells a person in the platform: role changes as they happen, nothing of a kind
// they turned off, and their own notifications only (docs/PLAN.md, Step 12).
let database: Awaited<ReturnType<typeof createTestDatabase>>;
let collegeId: string;
let otherCollegeId: string;
let electrical: string;
let admin: string;
let trainer: string;
let head: string;
let stranger: string;
let trainerRole: string;
let headRole: string;

const query = async (text: string, values: unknown[] = []) =>
  (await database.pool.query(text, values)).rows;

const person = (name: string, employeeNumber: string, college = collegeId) =>
  database.db.transaction(
    async (tx) =>
      (
        await createAccount(
          {
            collegeId: college,
            name,
            email: `${employeeNumber}@college.example`,
            employeeNumber,
          },
          tx,
          `password-${employeeNumber}`,
        )
      ).userId,
  );

const reader = (userId: string) => ({ collegeId, userId });
const change = (actorId: string) => ({
  collegeId,
  actorId,
  ip: "10.0.30.7",
  userAgent: "integration-test",
});
const unread = async (userId: string) =>
  (await latestUnread(reader(userId), 10, database.db)).map(
    ({ kind, params }) => ({ kind, params }),
  );
const events = (action: string) =>
  query(
    "select actor_id, entity_type, entity_id, diff from audit_events where action = $1 order by created_at, id",
    [action],
  );

beforeAll(async () => {
  database = await createTestDatabase();
  collegeId = await seedBase(database.db, {
    name: "Test College",
    shortName: "TC",
  });
  [{ id: otherCollegeId }] = await query(
    "insert into colleges (name, short_name) values ('Other College', 'OC') returning id",
  );
  [{ id: electrical }] = await query(
    "insert into departments (college_id, name, short_name) values ($1, 'Electrical', 'Elec') returning id",
    [collegeId],
  );
  admin = await person("Admin", "1001");
  trainer = await person("Trainer", "2001");
  head = await person("Head", "2002");
  stranger = await person("Stranger", "3001", otherCollegeId);
  const roles = await listRoles(collegeId, database.db);
  const byKey = (key: string) => {
    const role = roles.find((candidate) => candidate.key === key);
    if (!role) throw new Error(`no role ${key}`);
    return role.id;
  };
  trainerRole = byKey("trainer");
  headRole = byKey("head");
});

afterAll(() => database?.drop());

describe("role changes", () => {
  it("giving a role tells its holder the role's name and the department's, and taking it tells them too", async () => {
    const added = await addMembership(
      { userId: trainer, roleId: trainerRole, departmentId: electrical },
      change(admin),
      database.db,
    );
    if (added.status !== "added") throw new Error(added.status);
    const trainerLabel = (await findRole(collegeId, trainerRole, database.db))
      ?.labels.ar;
    expect(await unread(trainer)).toEqual([
      {
        kind: "membershipAdded",
        params: {
          role: trainerLabel,
          scope: "department",
          department: "Electrical",
        },
      },
    ]);

    await removeMembership(added.id, change(admin), database.db);
    expect((await unread(trainer))[0]).toEqual({
      kind: "membershipRemoved",
      params: {
        role: trainerLabel,
        scope: "department",
        department: "Electrical",
      },
    });
    expect(await unreadCount(reader(trainer), database.db)).toBe(2);
  });

  it("a role across the college names no department", async () => {
    await addMembership(
      { userId: head, roleId: headRole, departmentId: null },
      change(admin),
      database.db,
    );
    expect((await unread(head))[0]).toMatchObject({
      kind: "membershipAdded",
      params: { scope: "college" },
    });
    expect((await unread(head))[0].params).not.toHaveProperty("department");
  });

  it("holding the role there already tells no one anything", async () => {
    const before = await unreadCount(reader(head), database.db);
    const again = await addMembership(
      { userId: head, roleId: headRole, departmentId: null },
      change(admin),
      database.db,
    );
    expect(again.status).toBe("exists");
    expect(await unreadCount(reader(head), database.db)).toBe(before);
  });
});

describe("a kind turned off", () => {
  it("is not delivered, while the other kinds still are", async () => {
    const person_ = await person("Muted", "2003");
    expect(
      await chooseNotification(
        { kind: "membershipAdded", enabled: false },
        { ...change(person_) },
        database.db,
      ),
    ).toEqual({ status: "saved" });

    const added = await addMembership(
      { userId: person_, roleId: trainerRole, departmentId: electrical },
      change(admin),
      database.db,
    );
    if (added.status !== "added") throw new Error(added.status);
    expect(await unread(person_)).toEqual([]);

    await removeMembership(added.id, change(admin), database.db);
    expect((await unread(person_)).map(({ kind }) => kind)).toEqual([
      "membershipRemoved",
    ]);

    // Turned back on, it reaches them again.
    await chooseNotification(
      { kind: "membershipAdded", enabled: true },
      change(person_),
      database.db,
    );
    await addMembership(
      { userId: person_, roleId: trainerRole, departmentId: electrical },
      change(admin),
      database.db,
    );
    expect((await unread(person_)).map(({ kind }) => kind)).toEqual([
      "membershipAdded",
      "membershipRemoved",
    ]);
  });

  it("each choice is recorded, a choice that changes nothing is not, and the choices read back", async () => {
    const person_ = await person("Chooser", "2004");
    const before = (await events("notification.mute")).length;
    await chooseNotification(
      { kind: "weeklyDigest", enabled: false },
      change(person_),
      database.db,
    );
    expect(
      await chooseNotification(
        { kind: "weeklyDigest", enabled: false },
        change(person_),
        database.db,
      ),
    ).toEqual({ status: "unchanged" });
    const muted = await events("notification.mute");
    expect(muted.length).toBe(before + 1);
    expect(muted.at(-1)).toEqual({
      actor_id: person_,
      entity_type: "user",
      entity_id: person_,
      diff: { kind: "weeklyDigest" },
    });
    expect(await notificationChoices(reader(person_), database.db)).toEqual({
      membershipAdded: true,
      membershipRemoved: true,
      weeklyDigest: false,
    });
    // Turning on what was never turned off changes nothing.
    expect(
      await chooseNotification(
        { kind: "membershipAdded", enabled: true },
        change(person_),
        database.db,
      ),
    ).toEqual({ status: "unchanged" });
  });
});

describe("reading", () => {
  it("marks the named notifications, or all, read for their own person only, and records how many", async () => {
    const reading = await person("Reader", "2005");
    const send = () =>
      notify(
        {
          collegeId,
          userId: reading,
          kind: "membershipRemoved",
          params: { role: "x", scope: "college" },
        },
        database.db,
      );
    await send();
    await send();
    await send();
    const [first] = await latestUnread(reader(reading), 1, database.db);

    // Someone else's notification is not theirs to mark.
    expect(
      await markRead({ ids: [first.id] }, change(trainer), database.db),
    ).toBe(0);
    expect(
      await markRead({ ids: [first.id] }, change(reading), database.db),
    ).toBe(1);
    expect(await unreadCount(reader(reading), database.db)).toBe(2);
    expect(await markRead("all", change(reading), database.db)).toBe(2);
    expect(await unreadCount(reader(reading), database.db)).toBe(0);
    // Nothing left unread: nothing changes and nothing is written.
    const before = (await events("notification.read")).length;
    expect(await markRead("all", change(reading), database.db)).toBe(0);
    const read = await events("notification.read");
    expect(read.length).toBe(before);
    expect(read.slice(-2)).toEqual([
      {
        actor_id: reading,
        entity_type: "user",
        entity_id: reading,
        diff: { count: 1 },
      },
      {
        actor_id: reading,
        entity_type: "user",
        entity_id: reading,
        diff: { count: 2 },
      },
    ]);
  });

  it("pages a person's notifications newest first, read or not, and never another college's", async () => {
    const paging = await person("Pager", "2006");
    for (const n of [1, 2, 3, 4, 5]) {
      await notify(
        {
          collegeId,
          userId: paging,
          kind: "membershipAdded",
          params: { role: `r${n}`, scope: "college" },
        },
        database.db,
      );
    }
    const first = await listNotifications(
      reader(paging),
      { limit: 3 },
      database.db,
    );
    expect(first.notifications.map(({ params }) => params.role)).toEqual([
      "r5",
      "r4",
      "r3",
    ]);
    const second = await listNotifications(
      reader(paging),
      { after: first.next, limit: 3 },
      database.db,
    );
    expect(second.notifications.map(({ params }) => params.role)).toEqual([
      "r2",
      "r1",
    ]);
    expect(second.next).toBeUndefined();

    expect(
      await listNotifications(
        { collegeId: otherCollegeId, userId: paging },
        {},
        database.db,
      ),
    ).toEqual({ notifications: [], next: undefined });
    expect(
      await unreadCount(
        { collegeId: otherCollegeId, userId: stranger },
        database.db,
      ),
    ).toBe(0);
  });

  it("a notification sent once is not sent again", async () => {
    const once = await person("Once", "2007");
    const send = () =>
      notify(
        {
          collegeId,
          userId: once,
          kind: "weeklyDigest",
          params: { count: 1, latest: [] },
          onceKey: "weeklyDigest:2026-10-25",
        },
        database.db,
      );
    expect(await send()).toBe("sent");
    expect(await send()).toBe("duplicate");
    expect(await unreadCount(reader(once), database.db)).toBe(1);
  });
});

it("reads a person's page and the bell's newest through their indexes, in their order, with nothing to sort (lead review B)", async () => {
  const many = await person("Many", "2099");
  await query(
    `insert into notifications (college_id, user_id, kind, params, created_at)
     select $1, $2, 'membershipAdded', '{}', timestamptz '2026-01-01' + n * interval '1 minute'
     from generate_series(1, 20000) n`,
    [collegeId, many],
  );
  await query("analyze notifications");
  const recorder = recording(database.pool);
  await listNotifications(reader(many), {}, recorder.db);
  await latestUnread(reader(many), 3, recorder.db);
  const [page, newest] = await recorder.plans();
  expect(page).toEqual(["Limit", "notifications_user_time_idx"]);
  expect(newest).toHaveLength(2);
  expect(newest[0]).toBe("Limit");
  expect(newest[1]).toMatch(/^notifications_(unread|user_time)_idx$/);
});

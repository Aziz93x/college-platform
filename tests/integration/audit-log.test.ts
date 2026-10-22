import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type AuditCursor,
  allAuditEvents,
  entityHistory,
  listAuditEvents,
} from "../../src/modules/audit/index.ts";
import { createTestDatabase } from "./support/database.ts";
import { recording } from "./support/plans.ts";

let database: Awaited<ReturnType<typeof createTestDatabase>>;

const query = async (text: string, values: unknown[] = []) =>
  (await database.pool.query(text, values)).rows;

async function college(name: string) {
  const [{ id }] = await query(
    "insert into colleges (name, short_name) values ($1, $1) returning id",
    [name],
  );
  return id as string;
}

// An event written at the given time, as the given person, about the given entity.
async function event(
  collegeId: string,
  at: string,
  action: string,
  entity: { type: string; id: string },
  actorId: string | null = null,
  diff: Record<string, unknown> | null = null,
) {
  const [{ id }] = await query(
    `insert into audit_events (college_id, actor_id, action, entity_type, entity_id, diff, created_at)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [collegeId, actorId, action, entity.type, entity.id, diff, at],
  );
  return id as string;
}

beforeAll(async () => {
  database = await createTestDatabase();
});

afterAll(() => database?.drop());

// Every page from the first, as [action, ...] lists.
async function pages(
  read: (after?: AuditCursor) => ReturnType<typeof listAuditEvents>,
) {
  const all: string[][] = [];
  let after: AuditCursor | undefined;
  do {
    const { events, next } = await read(after);
    all.push(events.map(({ action }) => action));
    after = next;
  } while (after);
  return all;
}

describe("listAuditEvents", () => {
  it("pages newest first without skipping events of the same millisecond, and reads no other college's", async () => {
    const collegeId = await college("Paged");
    const other = await college("Elsewhere");
    const at = (micro: string) => `2026-10-01 10:00:00.123${micro}+00`;
    await event(collegeId, at("100"), "role.create", { type: "role", id: "a" });
    await event(collegeId, at("300"), "role.update", { type: "role", id: "a" });
    await event(collegeId, at("200"), "role.update", { type: "role", id: "b" });
    await event(other, at("250"), "role.create", { type: "role", id: "c" });

    expect(
      await pages((after) =>
        listAuditEvents(collegeId, {}, { after, limit: 1 }, database.db),
      ),
    ).toEqual([["role.update"], ["role.update"], ["role.create"]]);
  });

  it("narrows to a period, an action, and the people who acted or whose account it was", async () => {
    const collegeId = await college("Filtered");
    const hind = "0199b2a4-0000-7000-8000-000000000001";
    const fahd = "0199b2a4-0000-7000-8000-000000000002";
    await event(
      collegeId,
      "2026-09-30 23:59:59+00",
      "session.signIn",
      { type: "user", id: hind },
      hind,
    );
    await event(
      collegeId,
      "2026-10-01 08:00:00+00",
      "account.resetPassword",
      { type: "user", id: fahd },
      hind,
    );
    await event(
      collegeId,
      "2026-10-02 09:00:00+00",
      "session.signIn",
      { type: "user", id: fahd },
      fahd,
    );
    await event(
      collegeId,
      "2026-10-03 00:00:00+00",
      "department.create",
      { type: "department", id: "d" },
      hind,
    );

    const actions = async (filters: Parameters<typeof listAuditEvents>[1]) =>
      (await listAuditEvents(collegeId, filters, {}, database.db)).events.map(
        ({ action }) => action,
      );
    expect(
      await actions({
        from: new Date("2026-10-01T00:00:00Z"),
        to: new Date("2026-10-03T00:00:00Z"),
      }),
    ).toEqual(["session.signIn", "account.resetPassword"]);
    expect(await actions({ action: "session.signIn" })).toEqual([
      "session.signIn",
      "session.signIn",
    ]);
    // Fahd's own sign-in, and the reset done to his account by someone else.
    expect(await actions({ people: [fahd] })).toEqual([
      "session.signIn",
      "account.resetPassword",
    ]);
    expect(await actions({ people: [] })).toEqual([]);
  });
});

describe("entityHistory", () => {
  it("gathers an entity's own events and the memberships that name it", async () => {
    const collegeId = await college("History");
    const person = "0199b2a4-0000-7000-8000-00000000000a";
    const department = "0199b2a4-0000-7000-8000-00000000000d";
    const role = { type: "role", id: "0199b2a4-0000-7000-8000-00000000000e" };
    await event(collegeId, "2026-10-01 08:00:00+00", "role.create", role);
    await event(
      collegeId,
      "2026-10-02 08:00:00+00",
      "membership.create",
      { type: "membership", id: "m1" },
      null,
      { to: { userId: person, role: "head", departmentId: department } },
    );
    await event(
      collegeId,
      "2026-10-03 08:00:00+00",
      "membership.delete",
      { type: "membership", id: "m1" },
      null,
      { from: { userId: person, role: "head", departmentId: department } },
    );
    await event(
      collegeId,
      "2026-10-04 08:00:00+00",
      "membership.create",
      { type: "membership", id: "m2" },
      null,
      { to: { userId: "someone-else", role: "trainer", departmentId: null } },
    );
    await event(collegeId, "2026-10-05 08:00:00+00", "account.resetPassword", {
      type: "user",
      id: person,
    });

    const history = async (subjects: Parameters<typeof entityHistory>[1]) =>
      (await entityHistory(collegeId, subjects, {}, database.db)).events.map(
        ({ action }) => action,
      );
    expect(
      await history([
        { entityType: "role", entityId: role.id },
        { membershipsOf: "role", value: "head" },
      ]),
    ).toEqual(["membership.delete", "membership.create", "role.create"]);
    expect(
      await history([
        { entityType: "user", entityId: person },
        { membershipsOf: "userId", value: person },
      ]),
    ).toEqual([
      "account.resetPassword",
      "membership.delete",
      "membership.create",
    ]);
    expect(
      await history([{ membershipsOf: "departmentId", value: department }]),
    ).toEqual(["membership.delete", "membership.create"]);

    // An account's sign-ins, left out of its history, which keeps to what changed.
    await event(collegeId, "2026-10-06 08:00:00+00", "session.signIn", {
      type: "user",
      id: person,
    });
    const { events } = await entityHistory(
      collegeId,
      [{ entityType: "user", entityId: person }],
      { except: ["session.signIn", "session.signOut"] },
      database.db,
    );
    expect(events.map(({ action }) => action)).toEqual([
      "account.resetPassword",
    ]);
  });
});

describe("allAuditEvents", () => {
  it("yields every matching event, a batch at a time", async () => {
    const collegeId = await college("Exported");
    await query(
      `insert into audit_events (college_id, action, entity_type, entity_id, created_at)
       select $1, 'setting.update', 'setting', n::text, timestamptz '2026-10-01' + n * interval '1 second'
       from generate_series(1, 2500) n`,
      [collegeId],
    );
    const ids: string[] = [];
    for await (const { entityId } of allAuditEvents(
      collegeId,
      {},
      database.db,
    )) {
      ids.push(entityId);
    }
    expect(ids).toHaveLength(2500);
    expect(ids[0]).toBe("2500");
    expect(ids.at(-1)).toBe("1");
  });
});

describe("paging through 100,000 events", () => {
  it("reads the first page and a page deep in the log in under 300 ms each", async () => {
    const collegeId = await college("Large");
    await query(
      `insert into audit_events (college_id, actor_id, action, entity_type, entity_id, created_at)
       select $1, null, 'session.signIn', 'user', (n % 500)::text,
         timestamptz '2026-01-01' + n * interval '1 minute'
       from generate_series(1, 100000) n`,
      [collegeId],
    );
    await query("analyze audit_events");
    const [deep] = await query(
      `select created_at::text as at, id from audit_events where college_id = $1
       order by created_at desc, id desc offset 90000 limit 1`,
      [collegeId],
    );
    for (const after of [undefined, deep as AuditCursor]) {
      // The first read warms the connection; the second is the one timed.
      await listAuditEvents(collegeId, {}, { after }, database.db);
      const started = performance.now();
      const { events, next } = await listAuditEvents(
        collegeId,
        {},
        { after },
        database.db,
      );
      const elapsed = performance.now() - started;
      expect(events).toHaveLength(50);
      expect(next).toBeDefined();
      expect(elapsed).toBeLessThan(300);
    }

    // Each page reads its index from the top, in the index's order: nothing is sorted, and the
    // page costs the same at any size of the log (lead review B).
    const recorder = recording(database.pool);
    await listAuditEvents(collegeId, {}, {}, recorder.db);
    await listAuditEvents(collegeId, {}, { after: deep }, recorder.db);
    await listAuditEvents(
      collegeId,
      { action: "department.create" },
      {},
      recorder.db,
    );
    expect(await recorder.plans()).toEqual([
      ["Limit", "audit_events_college_time_idx"],
      ["Limit", "audit_events_college_time_idx"],
      ["Limit", "audit_events_action_idx"],
    ]);
  });
});

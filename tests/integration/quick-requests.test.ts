import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedBase } from "../../db/seed/base.ts";
import { addMembership } from "../../src/modules/access/index.ts";
import { createAccount } from "../../src/modules/identity/index.ts";
import { createDepartment } from "../../src/modules/org/index.ts";
import {
  type QuickRequestInput,
  sendQuickRequest,
  termRequests,
} from "../../src/modules/requests/index.ts";
import {
  getSetting,
  settingsRegistry,
} from "../../src/modules/settings/index.ts";
import {
  generateTerm,
  itemAssignees,
  queueGeneration,
  runNow,
  runQueued,
} from "../../src/modules/tasks/index.ts";
import { activateTerm, createTerm } from "../../src/modules/terms/index.ts";
import type { Tx } from "../../src/platform/db/client.ts";
import { createTestDatabase } from "./support/database.ts";

// Quick requests (Step 22) on a real database: an 18-week term from Sunday 23 August 2026, with no
// holiday in it, on its second week (Tuesday 1 September); Electrical's head and its trainers Hind
// and Salem; Noura, who trains in Mechanical; and the vice-dean, who sends to the whole college.
let database: Awaited<ReturnType<typeof createTestDatabase>>;
let collegeId: string;
let termId: string;
let electrical: string;
let mechanical: string;
let trainerRole: string;
let axisId: string;
const people: Record<string, string> = {};

const AT = new Date("2026-09-01T09:00:00Z");
// Thursday of the term's third week.
const DUE = "2026-09-10";

const query = async (text: string, values: unknown[] = []) =>
  (await database.pool.query(text, values)).rows;
const change = (who: string) => ({ collegeId, actorId: people[who] });

const request = (
  input: Partial<QuickRequestInput> = {},
): QuickRequestInput => ({
  termId,
  departmentId: electrical,
  title: "تسليم كشوف الحضور",
  axisId,
  dueOn: DUE,
  targets: { type: "everyone" },
  evidence: true,
  ...input,
});

// A request kept with the pass it queues in its transaction, as the requests page sends it.
async function kept(input: QuickRequestInput, who = "head") {
  const result = await sendQuickRequest(
    input,
    change(who),
    (tx: Tx) => queueGeneration(collegeId, input.termId, "request", tx),
    AT,
    database.db,
  );
  if (result.status !== "sent") throw new Error(result.status);
  return result;
}
const sent = async (input: QuickRequestInput, who = "head") =>
  (await kept(input, who)).id;

const generate = () =>
  generateTerm(collegeId, termId, "request", { at: AT, db: database.db });
// The request's pass run at once, as the action runs it.
const runAtOnce = (runId: string, db = database.db) =>
  runNow(runId, { db, now: () => AT });
const runOf = async (id: string) =>
  (
    await query(
      "select reason, status, error from generation_runs where id = $1",
      [id],
    )
  )[0];
// The term's passes from a request's own on, in the order they were queued.
const passesFrom = (runId: string) =>
  query(
    `select reason, status, retry from generation_runs
     where term_id = $1
       and (queued_at, id) >= (select queued_at, id from generation_runs where id = $2)
     order by queued_at, id`,
    [termId, runId],
  );
// Whom a request has told, once each.
const toldOf = async (requestId: string) =>
  (
    await query(
      `select user_id as "userId" from notifications
       where kind = 'quickRequest' and once_key = $1`,
      [`quickRequest:${requestId}`],
    )
  )
    .map(({ userId }) => userId as string)
    .sort();
// A department of the college, and trainers who hold a role in it for every term.
async function departmentWith(name: string, trainers: number) {
  const made = await createDepartment(
    { name, shortName: name, rayatValues: [name], active: true },
    change("viceDean"),
    database.db,
  );
  if (made.status !== "created") throw new Error(made.status);
  const ids: string[] = [];
  for (let index = 0; index < trainers; index += 1) {
    ids.push(await trainerIn(made.id, `${name}-${index}`));
  }
  return { id: made.id, trainers: ids };
}
let numbered = 0;
async function trainerIn(departmentId: string, name: string) {
  numbered += 1;
  const userId = await database.db.transaction(
    async (tx) =>
      (
        await createAccount(
          {
            collegeId,
            name,
            email: `${name.toLowerCase()}@college.example`,
            employeeNumber: `9${String(numbered).padStart(5, "0")}`,
          },
          tx,
          `password-${name}`,
        )
      ).userId,
  );
  await addMembership(
    { userId, roleId: trainerRole, departmentId },
    change("viceDean"),
    database.db,
  );
  return userId;
}

// The tasks a request made, by whom they are for, as the engine left them.
const tasksOf = async (requestId: string) =>
  (
    await query(
      `select assignee_id as "assigneeId", department_id as "departmentId", title, week,
         due_on::text as "dueOn", kind, axis_id as "axisId", policy, source
       from tasks where source_item_id = $1 and cancelled_at is null`,
      [requestId],
    )
  ).sort((a, b) => a.assigneeId.localeCompare(b.assigneeId));

const named = (...who: string[]) => who.map((each) => people[each]).sort();

beforeAll(async () => {
  database = await createTestDatabase();
  collegeId = await seedBase(database.db, {
    name: "Test College",
    shortName: "TC",
  });
  for (const name of ["viceDean", "head", "hind", "salem", "noura"]) {
    people[name] = await database.db.transaction(
      async (tx) =>
        (
          await createAccount(
            {
              collegeId,
              name,
              email: `${name}@college.example`,
              employeeNumber: `8${Object.keys(people).length}0001`,
            },
            tx,
            `password-${name}`,
          )
        ).userId,
    );
  }
  const department = async (name: string) => {
    const made = await createDepartment(
      { name, shortName: name, rayatValues: [name], active: true },
      change("viceDean"),
      database.db,
    );
    if (made.status !== "created") throw new Error(made.status);
    return made.id;
  };
  electrical = await department("Electrical");
  mechanical = await department("Mechanical");
  const roleOf = async (key: string) =>
    (
      await query("select id from roles where college_id = $1 and key = $2", [
        collegeId,
        key,
      ])
    )[0].id as string;
  trainerRole = await roleOf("trainer");
  const headRole = await roleOf("head");
  for (const [who, roleId, departmentId] of [
    ["head", headRole, electrical],
    ["hind", trainerRole, electrical],
    ["salem", trainerRole, electrical],
    ["noura", trainerRole, mechanical],
  ]) {
    await addMembership(
      { userId: people[who], roleId, departmentId },
      change("viceDean"),
      database.db,
    );
  }
  [{ id: axisId }] = await query("select id from axes where code = '9'");
  const created = await createTerm(
    { name: "الفصل الأول 1448", startsOn: "2026-08-23", weeks: 18 },
    change("viceDean"),
    database.db,
  );
  if (created.status !== "created") throw new Error(created.status);
  termId = created.id;
  await activateTerm(termId, change("viceDean"), database.db);
});

afterAll(() => database?.drop());

describe("a quick request", () => {
  it("reaches everyone in the department but its sender, due on its own day, the moment its pass runs, and the next pass makes no more", async () => {
    const id = await sent(request());
    await generate();
    const made = await tasksOf(id);
    expect(made.map(({ assigneeId }) => assigneeId)).toEqual(
      named("hind", "salem"),
    );
    expect(made[0]).toMatchObject({
      departmentId: electrical,
      title: "تسليم كشوف الحضور",
      week: 3,
      dueOn: DUE,
      kind: "general",
      axisId,
      source: "request",
      policy: {
        required: true,
        types: settingsRegistry["files.acceptedTypes"].default,
        maxFiles: 1,
        requiresApproval: false,
      },
    });
    expect(
      (await itemAssignees(termId, "request", id, database.db))
        .map(({ userId }) => userId)
        .sort(),
    ).toEqual(named("hind", "salem"));

    await expect(generate()).resolves.toMatchObject({
      created: 0,
      updated: 0,
      cancelled: 0,
    });
    expect(
      await query(
        "select action, actor_id as actor, diff from audit_events where entity_id = $1",
        [id],
      ),
    ).toEqual([
      {
        action: "quickRequest.send",
        actor: people.head,
        diff: {
          to: {
            title: "تسليم كشوف الحضور",
            termId,
            departmentId: electrical,
            axisId,
            dueOn: DUE,
            targets: { type: "everyone" },
            evidence: true,
          },
        },
      },
    ]);
  });

  it("reaches a role's holders in the department, or the people chosen there", async () => {
    const trainers = await sent(
      request({ targets: { type: "role", roleId: trainerRole } }),
    );
    const one = await sent(
      request({
        targets: {
          type: "people",
          people: [{ userId: people.salem, departmentId: electrical }],
        },
        evidence: false,
      }),
    );
    await generate();
    expect(
      (await tasksOf(trainers)).map(({ assigneeId }) => assigneeId),
    ).toEqual(named("hind", "salem"));
    expect(await tasksOf(one)).toMatchObject([
      { assigneeId: people.salem, policy: { required: false } },
    ]);
  });

  it("from the vice-dean, reaches every department's people, each in their own", async () => {
    const id = await sent(request({ departmentId: null }), "viceDean");
    await generate();
    expect(
      (await tasksOf(id)).map(({ assigneeId, departmentId }) => [
        assigneeId,
        departmentId,
      ]),
    ).toEqual(
      [
        [people.head, electrical],
        [people.hind, electrical],
        [people.salem, electrical],
        [people.noura, mechanical],
      ].sort((a, b) => a[0].localeCompare(b[0])),
    );
  });

  it("is refused for a day outside the term's weeks or already past, for what is not the college's, and for people not in the department, and a refused request queues no pass", async () => {
    let queued = 0;
    const refused = async (input: QuickRequestInput) =>
      (
        await sendQuickRequest(
          input,
          change("head"),
          async (tx) => {
            queued += 1;
            return queueGeneration(collegeId, input.termId, "request", tx);
          },
          AT,
          database.db,
        )
      ).status;
    const nobody = "0199b2a4-6c1e-7d3a-9f00-0000000000ff";
    expect(await refused(request({ dueOn: "2026-08-22" }))).toBe("dueOutside");
    expect(await refused(request({ dueOn: "2027-01-01" }))).toBe("dueOutside");
    expect(await refused(request({ dueOn: "2026-08-31" }))).toBe("duePast");
    // The Friday of the third week, a day off (lead review D, proposal 6).
    expect(await refused(request({ dueOn: "2026-09-11" }))).toBe("dueOff");
    expect(await refused(request({ axisId: nobody }))).toBe("axisNotFound");
    expect(await refused(request({ departmentId: nobody }))).toBe(
      "departmentNotFound",
    );
    expect(
      await refused(request({ targets: { type: "role", roleId: nobody } })),
    ).toBe("roleNotFound");
    expect(
      await refused(
        request({
          targets: {
            type: "people",
            people: [{ userId: people.noura, departmentId: electrical }],
          },
        }),
      ),
    ).toBe("notInDepartment");
    expect(
      await refused(
        request({
          targets: {
            type: "people",
            people: [{ userId: people.noura, departmentId: mechanical }],
          },
        }),
      ),
    ).toBe("targetsMismatch");

    const closing = await createTerm(
      { name: "فصل مغلق", startsOn: "2026-01-04", weeks: 18 },
      change("viceDean"),
      database.db,
    );
    if (closing.status !== "created") throw new Error(closing.status);
    await query("update terms set status = 'closed' where id = $1", [
      closing.id,
    ]);
    expect(await refused(request({ termId: closing.id }))).toBe("termClosed");
    expect(
      await query(
        "select count(*)::int as count from quick_requests where term_id = $1",
        [closing.id],
      ),
    ).toEqual([{ count: 0 }]);
    expect(queued).toBe(0);
  });

  it("lists the term's requests a viewer reads: the whole college's and their departments', or all of them", async () => {
    const titles = async (reach: "college" | string[]) =>
      (await termRequests(collegeId, termId, reach, database.db)).map(
        ({ departmentId }) => departmentId,
      );
    expect(new Set(await titles([mechanical]))).toEqual(new Set([null]));
    expect(new Set(await titles([electrical]))).toEqual(
      new Set([null, electrical]),
    );
    expect(new Set(await titles("college"))).toEqual(
      new Set([null, electrical]),
    );
  });
});

// The pass a request queues in its own transaction and runs at once, as a run of the engine's
// (lead review D): it is recorded, it is never lost or doubled when it fails, it tells its people
// in the same transaction that makes their tasks, in as many statements for twelve as for one, and
// it tells whoever it reaches later (the owner's answer, 23 October 2026). No two passes of a term
// run at once.
describe("a quick request's pass", () => {
  it("is queued with the request and run at once: done, its tasks made, and each person told once", async () => {
    const result = await kept(request({ title: "كشوف الأسبوع الثاني" }));
    expect(await runOf(result.runId)).toEqual({
      reason: "request",
      status: "queued",
      error: null,
    });
    expect(await runAtOnce(result.runId)).toBe("done");
    expect(await runOf(result.runId)).toMatchObject({ status: "done" });
    expect(
      (await tasksOf(result.id)).map(({ assigneeId }) => assigneeId),
    ).toEqual(named("hind", "salem"));
    expect(await toldOf(result.id)).toEqual(named("hind", "salem"));
    // Another pass makes and tells nothing more.
    await generate();
    expect(await toldOf(result.id)).toEqual(named("hind", "salem"));
  });

  it("that fails keeps the request, is recorded failed and queued again, and the worker's pass then makes each task once and tells each person once (M2)", async () => {
    await query(
      "alter table tasks add constraint request_fails check (title <> 'طلب يتعثر')",
    );
    let result: Awaited<ReturnType<typeof kept>>;
    try {
      result = await kept(request({ title: "طلب يتعثر" }));
      expect(await runAtOnce(result.runId)).toBe("pending");
    } finally {
      await query("alter table tasks drop constraint request_fails");
    }
    // Recorded with the database's own words, not the statement and its values (lead review D).
    expect(await runOf(result.runId)).toEqual({
      reason: "request",
      status: "failed",
      error:
        'new row for relation "tasks" violates check constraint "request_fails"',
    });
    expect(await tasksOf(result.id)).toEqual([]);
    expect(await toldOf(result.id)).toEqual([]);
    const again = await query(
      `select id from generation_runs
       where term_id = $1 and reason = 'request' and status = 'queued'
         and (queued_at, id) > (select queued_at, id from generation_runs where id = $2)`,
      [termId, result.runId],
    );
    expect(again).toHaveLength(1);

    await runQueued(database.db, () => AT);
    expect(await runOf(again[0].id)).toMatchObject({ status: "done" });
    expect(
      (await tasksOf(result.id)).map(({ assigneeId }) => assigneeId),
    ).toEqual(named("hind", "salem"));
    expect(await toldOf(result.id)).toEqual(named("hind", "salem"));
  });

  it("tells its people in as many statements for twelve as for one (M3)", async () => {
    const twelve = await departmentWith("Twelve", 12);
    const chosen = (count: number) =>
      request({
        departmentId: twelve.id,
        targets: {
          type: "people",
          people: twelve.trainers
            .slice(0, count)
            .map((userId) => ({ userId, departmentId: twelve.id })),
        },
      });
    const counted = () => {
      const sent: string[] = [];
      return {
        sent,
        db: drizzle({
          client: database.pool,
          logger: { logQuery: (statement) => sent.push(statement) },
        }),
      };
    };
    // A pass first, which gives the new department's people what earlier requests owe them, so each
    // pass counted below makes its own request's tasks alone.
    await generate();
    const one = await kept(chosen(1));
    const forOne = counted();
    expect(await runAtOnce(one.runId, forOne.db)).toBe("done");
    const all = await kept(chosen(12));
    const forTwelve = counted();
    expect(await runAtOnce(all.runId, forTwelve.db)).toBe("done");

    expect(await toldOf(one.id)).toHaveLength(1);
    expect(await toldOf(all.id)).toHaveLength(12);
    expect(forTwelve.sent.length).toBe(forOne.sent.length);
  });

  it("reaches someone who joins its department later, even past its day, and the pass that gives them its task tells them, once", async () => {
    const late = await departmentWith("Late", 1);
    const result = await kept(
      request({ departmentId: late.id, title: "تحديث السيرة الذاتية" }),
    );
    expect(await runAtOnce(result.runId)).toBe("done");
    expect(await toldOf(result.id)).toEqual(late.trainers);

    const joiner = await trainerIn(late.id, "Joiner");
    // The night's pass, five days after the request's day.
    const nightly = () =>
      generateTerm(collegeId, termId, "daily", {
        at: new Date("2026-09-15T21:37:00Z"),
        db: database.db,
      });
    await nightly();
    expect(
      (await tasksOf(result.id)).find(
        ({ assigneeId }) => assigneeId === joiner,
      ),
    ).toMatchObject({ dueOn: DUE });
    expect(await toldOf(result.id)).toEqual([...late.trainers, joiner].sort());
    await nightly();
    expect(await toldOf(result.id)).toEqual([...late.trainers, joiner].sort());
  });

  it("gives its task to someone who turned such notices off, and tells them nothing", async () => {
    const quiet = await departmentWith("Quiet", 2);
    const [muted, told] = quiet.trainers;
    await query(
      `insert into notification_prefs (college_id, user_id, kind, channel, enabled)
       values ($1, $2, 'quickRequest', 'inApp', false)`,
      [collegeId, muted],
    );
    const result = await kept(request({ departmentId: quiet.id }));
    expect(await runAtOnce(result.runId)).toBe("done");
    expect(
      (await tasksOf(result.id)).map(({ assigneeId }) => assigneeId),
    ).toEqual([...quiet.trainers].sort());
    expect(await toldOf(result.id)).toEqual([told]);
  });

  it("keeps its tasks when someone deletes the account of a person it reached: the deletion is refused (lead review D)", async () => {
    const kept_ = await departmentWith("Kept", 1);
    const [held] = kept_.trainers;
    const result = await kept(request({ departmentId: kept_.id }));
    expect(await runAtOnce(result.runId)).toBe("done");
    await expect(
      query("delete from users where id = $1", [held]),
    ).rejects.toMatchObject({
      code: "23001",
      constraint: "tasks_holder_id_users_id_fk",
    });
    expect(
      (await tasksOf(result.id)).map(({ assigneeId }) => assigneeId),
    ).toEqual([held]);
  });

  it("waits while another pass of its term is running, for the worker to run it after, and not for one left running too long (proposal 7)", async () => {
    const result = await kept(request({ title: "جدول المراقبة" }));
    const [other] = await query(
      `insert into generation_runs (college_id, term_id, reason, status, started_at)
       values ($1, $2, 'daily', 'running', now()) returning id`,
      [collegeId, termId],
    );
    expect(await runAtOnce(result.runId)).toBe("pending");
    expect(await runOf(result.runId)).toMatchObject({ status: "queued" });
    // The worker passes over the term's waiting passes while another runs.
    expect(await runQueued(database.db, () => AT)).toBe(0);
    expect(await tasksOf(result.id)).toEqual([]);

    // A pass left running longer than fifteen minutes has stopped, and no longer holds the term.
    await query(
      "update generation_runs set started_at = now() - interval '16 minutes' where id = $1",
      [other.id],
    );
    expect(await runAtOnce(result.runId)).toBe("done");
    expect(
      (await tasksOf(result.id)).map(({ assigneeId }) => assigneeId),
    ).toEqual(named("hind", "salem"));
  });

  it("that the worker runs and that fails is queued again for its next round, which makes each task once and tells each person once (lead review D)", async () => {
    // What the cases before left waiting, run first.
    await runQueued(database.db, () => AT);
    const result = await kept(request({ title: "طلب يتعثر عند العامل" }));
    await query(
      "alter table tasks add constraint worker_fails check (title <> 'طلب يتعثر عند العامل')",
    );
    try {
      // The round runs the request's pass, which fails, and leaves it queued again for the next.
      expect(await runQueued(database.db, () => AT)).toBe(1);
    } finally {
      await query("alter table tasks drop constraint worker_fails");
    }
    expect(await passesFrom(result.runId)).toEqual([
      { reason: "request", status: "failed", retry: false },
      { reason: "request", status: "queued", retry: true },
    ]);
    expect(await tasksOf(result.id)).toEqual([]);

    expect(await runQueued(database.db, () => AT)).toBe(1);
    expect(await passesFrom(result.runId)).toEqual([
      { reason: "request", status: "failed", retry: false },
      { reason: "request", status: "done", retry: true },
    ]);
    expect(
      (await tasksOf(result.id)).map(({ assigneeId }) => assigneeId),
    ).toEqual(named("hind", "salem"));
    expect(await toldOf(result.id)).toEqual(named("hind", "salem"));
  });

  it("queued again that fails again is not queued once more, nor is a pass of another cause that fails: the next pass makes its tasks (lead review D)", async () => {
    await runQueued(database.db, () => AT);
    await query(
      "alter table tasks add constraint fails_twice check (title <> 'طلب يتعثر مرتين')",
    );
    let result: Awaited<ReturnType<typeof kept>>;
    try {
      result = await kept(request({ title: "طلب يتعثر مرتين" }));
      expect(await runAtOnce(result.runId)).toBe("pending");
      expect(await runQueued(database.db, () => AT)).toBe(1);
      expect(await runQueued(database.db, () => AT)).toBe(0);
      // A pass of another cause that fails waits for the next, or for an admin (ADR-0029).
      await queueGeneration(collegeId, termId, "daily", database.db);
      expect(await runQueued(database.db, () => AT)).toBe(1);
      expect(await runQueued(database.db, () => AT)).toBe(0);
    } finally {
      await query("alter table tasks drop constraint fails_twice");
    }
    expect(await passesFrom(result.runId)).toEqual([
      { reason: "request", status: "failed", retry: false },
      { reason: "request", status: "failed", retry: true },
      { reason: "daily", status: "failed", retry: false },
    ]);

    await generate();
    expect(
      (await tasksOf(result.id)).map(({ assigneeId }) => assigneeId),
    ).toEqual(named("hind", "salem"));
    expect(await toldOf(result.id)).toEqual(named("hind", "salem"));
  });

  it("that the database drops mid-way is left running, and the worker takes it over once left too long: each task made once, each person told once (lead review D)", async () => {
    await runQueued(database.db, () => AT);
    const result = await kept(request({ title: "طلب ينقطع" }));
    // A database that stops answering once the pass has begun to make the request's tasks, so that
    // not even its failure can be written. What the pass began is rolled back, as the server does
    // with a connection it loses.
    const pool = new Pool({ connectionString: database.url });
    let down = false;
    const dropping = drizzle({
      client: pool,
      logger: {
        logQuery: (statement) => {
          if (down && !/^(begin|rollback)/.test(statement)) {
            throw new Error("Connection terminated unexpectedly");
          }
          if (statement.startsWith('insert into "tasks"')) down = true;
        },
      },
    });
    try {
      await expect(runAtOnce(result.runId, dropping)).rejects.toThrow(
        "Connection terminated unexpectedly",
      );
    } finally {
      await pool.end();
    }
    expect(await runOf(result.runId)).toMatchObject({ status: "running" });
    expect(await tasksOf(result.id)).toEqual([]);
    // The pass holds its term while it may still be running; once left running longer than fifteen
    // minutes, it has stopped, and the worker takes it over.
    expect(await runQueued(database.db, () => AT)).toBe(0);
    await query(
      "update generation_runs set started_at = now() - interval '16 minutes' where id = $1",
      [result.runId],
    );
    expect(await runQueued(database.db, () => AT)).toBe(1);
    expect(await runOf(result.runId)).toMatchObject({ status: "done" });
    expect(
      (await tasksOf(result.id)).map(({ assigneeId }) => assigneeId),
    ).toEqual(named("hind", "salem"));
    expect(await toldOf(result.id)).toEqual(named("hind", "salem"));
  });
});

// Last, in departments of its own, so that no case before it counts the person it adds.
describe("a quick request to people chosen in two departments", () => {
  it("from the vice-dean, reaches someone chosen in each of the two once in each, and tells them once (lead review D)", async () => {
    const [first, second] = [
      await departmentWith("Civil", 0),
      await departmentWith("Chemical", 0),
    ];
    const both = await trainerIn(first.id, "Rakan");
    await addMembership(
      { userId: both, roleId: trainerRole, departmentId: second.id },
      change("viceDean"),
      database.db,
    );
    const id = await sent(
      request({
        departmentId: null,
        targets: {
          type: "people",
          people: [
            { userId: both, departmentId: first.id },
            { userId: both, departmentId: second.id },
          ],
        },
      }),
      "viceDean",
    );
    await generate();
    expect(
      (await tasksOf(id))
        .map(({ assigneeId, departmentId }) => [assigneeId, departmentId])
        .sort((a, b) => a[1].localeCompare(b[1])),
    ).toEqual(
      [
        [both, first.id],
        [both, second.id],
      ].sort((a, b) => a[1].localeCompare(b[1])),
    );
    expect(await toldOf(id)).toEqual([both]);
  });
});

// Last too: the holidays it adds move the weeks after them.
describe("a quick request whose day a holiday takes after it is sent", () => {
  it("is due on the last day worked before it in its week, which its notice names, and keeps its day when a break takes the whole week (lead review D)", async () => {
    const team = await departmentWith("Survey", 1);
    // Wednesday of week 5, and Tuesday of week 4.
    const wednesday = await sent(
      request({
        departmentId: team.id,
        title: "تقرير الزيارة",
        dueOn: "2026-09-23",
      }),
    );
    const tuesday = await sent(
      request({
        departmentId: team.id,
        title: "خطة الأسبوع",
        dueOn: "2026-09-15",
      }),
    );
    await generate();
    const days = async (id: string) =>
      (await tasksOf(id)).map(({ week, dueOn }) => ({ week, dueOn }));
    expect(await days(wednesday)).toEqual([{ week: 5, dueOn: "2026-09-23" }]);
    expect(await days(tuesday)).toEqual([{ week: 4, dueOn: "2026-09-15" }]);

    const added: string[] = [];
    const dayOff = async (startsOn: string, endsOn: string) => {
      const [{ id }] = await query(
        `insert into calendar_events (college_id, term_id, kind, title, starts_on, ends_on)
         values ($1, $2, 'holiday', 'إجازة', $3, $4) returning id`,
        [collegeId, termId, startsOn, endsOn],
      );
      added.push(id);
    };
    try {
      // A holiday on the Wednesday: the Tuesday before, in its week, for everyone, and for someone
      // who joins after, whose notice names that day.
      await dayOff("2026-09-23", "2026-09-23");
      const joiner = await trainerIn(team.id, "Faisal");
      await generate();
      expect(await days(wednesday)).toEqual([
        { week: 5, dueOn: "2026-09-22" },
        { week: 5, dueOn: "2026-09-22" },
      ]);
      const [language, digits] = await Promise.all([
        getSetting("locale.language", { collegeId }, database.db),
        getSetting("locale.digits", { collegeId }, database.db),
      ]);
      expect(
        await query(
          `select params->>'due' as due from notifications
           where user_id = $1 and once_key = $2`,
          [joiner, `quickRequest:${wednesday}`],
        ),
      ).toEqual([
        {
          due: new Intl.DateTimeFormat(`${language}-u-nu-${digits}`, {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: "UTC",
          }).format(new Date("2026-09-22T00:00:00Z")),
        },
      ]);

      // A break that takes week 4's every working day: its Tuesday keeps its day, never moved into
      // a week that may have passed, in the week the break's days reach, 3; the weeks after it
      // count on from 4.
      await dayOff("2026-09-13", "2026-09-17");
      await generate();
      expect(await days(tuesday)).toEqual([
        { week: 3, dueOn: "2026-09-15" },
        { week: 3, dueOn: "2026-09-15" },
      ]);
      expect(await days(wednesday)).toEqual([
        { week: 4, dueOn: "2026-09-22" },
        { week: 4, dueOn: "2026-09-22" },
      ]);
    } finally {
      await query("delete from calendar_events where id = any($1)", [added]);
    }
  });
});

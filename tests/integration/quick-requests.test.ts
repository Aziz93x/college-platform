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
import { settingsRegistry } from "../../src/modules/settings/index.ts";
import { generateTerm, itemAssignees } from "../../src/modules/tasks/index.ts";
import { activateTerm, createTerm } from "../../src/modules/terms/index.ts";
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

async function sent(input: QuickRequestInput, who = "head") {
  const result = await sendQuickRequest(input, change(who), AT, database.db);
  if (result.status !== "sent") throw new Error(result.status);
  return result.id;
}

const generate = () =>
  generateTerm(collegeId, termId, "request", { at: AT, db: database.db });

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

  it("is refused for a day outside the term's weeks or already past, for what is not the college's, and for people not in the department", async () => {
    const refused = async (input: QuickRequestInput) =>
      (await sendQuickRequest(input, change("head"), AT, database.db)).status;
    const nobody = "0199b2a4-6c1e-7d3a-9f00-0000000000ff";
    expect(await refused(request({ dueOn: "2026-08-22" }))).toBe("dueOutside");
    expect(await refused(request({ dueOn: "2027-01-01" }))).toBe("dueOutside");
    expect(await refused(request({ dueOn: "2026-08-31" }))).toBe("duePast");
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

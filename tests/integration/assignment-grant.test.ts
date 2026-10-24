import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assignmentCatalog, seedBase } from "../../db/seed/base.ts";
import {
  addMembership,
  authorize,
  createRole,
  holdersIn,
  loadAccess,
  type PermissionKey,
  permittedDepartments,
  setRolePermissions,
} from "../../src/modules/access/index.ts";
import {
  addTemplateItem,
  assign,
  createTemplate,
  revokeAssignment,
  termAssignments,
  updateTemplate,
} from "../../src/modules/assignments/index.ts";
import {
  assignmentTemplateInput,
  copyFrameworkInto,
} from "../../src/modules/framework/index.ts";
import { createAccount } from "../../src/modules/identity/index.ts";
import { createDepartment } from "../../src/modules/org/index.ts";
import { copyPlansInto } from "../../src/modules/planning/index.ts";
import { generateTerm } from "../../src/modules/tasks/index.ts";
import {
  activateTerm,
  calendarSettings,
  createTerm,
  openNextTerm,
} from "../../src/modules/terms/index.ts";
import { createTestDatabase } from "./support/database.ts";

// The grant ADR-0031 builds the head's delegations on (ADR-0028), on a real database: an assignment
// of a shared template without items, whose role holds a key in the department. review.decide and
// portfolio.approve arrive with Steps 29 and 30 (section 0), so two keys checked in a department,
// which the trainer's role does not hold, stand in for them: the review's role holds
// sections.transfer, the portfolios' plan.edit. Only the seed sets the role a template grants, so
// the two templates are written directly. Electrical's head, and its trainers Hind, Salem and Fahad;
// Noura, who trains in Mechanical; Yasser, who trains in Electrical this term alone; an 18-week term
// from Sunday 23 August 2026.
let database: Awaited<ReturnType<typeof createTestDatabase>>;
let collegeId: string;
let termId: string;
let nextTermId: string;
let electrical: string;
let mechanical: string;
let assignmentsAxis: string;
const people: Record<string, string> = {};
// Each delegation's role, the role's key, and its template, by the delegation's name.
const roles: Record<string, string> = {};
const roleKeys: Record<string, string> = {};
const delegations: Record<string, string> = {};

const REVIEW: PermissionKey = "sections.transfer";
const PORTFOLIO: PermissionKey = "plan.edit";
const labels = { review: "مفوض المراجعة", portfolio: "مفوض اعتماد الملفات" };
const titles = {
  review: "تفويض المراجعة",
  portfolio: "تفويض اعتماد ملفات الإنجاز",
};

const query = async (text: string, values: unknown[] = []) =>
  (await database.pool.query(text, values)).rows;
const change = (who = "head") => ({ collegeId, actorId: people[who] });

// The head gives a delegation to people of Electrical: for this term and the whole of it, unless
// told otherwise.
const delegate = (
  delegation: string,
  who: string[],
  more: Partial<Pick<Parameters<typeof assign>[0], "termId" | "weeks">> = {},
) =>
  assign(
    {
      templateId: delegations[delegation],
      termId,
      departmentId: electrical,
      userIds: who.map((name) => people[name]),
      ...more,
    },
    change(),
    database.db,
  );

// The person's assignment of a delegation in Electrical in a term.
async function delegationOf(who: string, delegation: string, term = termId) {
  const found = (
    await termAssignments(collegeId, term, electrical, database.db)
  ).find(
    ({ userId, templateId }) =>
      userId === people[who] && templateId === delegations[delegation],
  );
  if (!found) throw new Error(`${who} holds no ${delegation} delegation`);
  return found;
}

// The person's memberships of a delegation's role: where, and for which term.
const membershipsOf = (who: string, delegation: string) =>
  query(
    `select id, department_id as "departmentId", term_id as "termId" from memberships
     where user_id = $1 and role_id = $2 order by created_at, id`,
    [people[who], roles[delegation]],
  );

// The person's grants, as their next request reads them.
const actor = async (who: string) => ({
  userId: people[who],
  collegeId,
  grants: (await loadAccess(people[who], collegeId, database.db)).grants,
});

// Whether the person may use a key in a department, or across the college with none: the check an
// action's requirePermission() makes.
const may = async (who: string, key: PermissionKey, departmentId?: string) =>
  authorize(await actor(who), key, { collegeId, departmentId });

// Who holds a key in Electrical, by name, as holdersIn() names them.
const holders = async (key: PermissionKey) =>
  (
    (await holdersIn(collegeId, [electrical], key, database.db)).get(
      electrical,
    ) ?? []
  ).map(({ name }) => name);

// How many notifications the person has had.
const told = async (who: string) =>
  (
    await query(
      "select count(*)::int as count from notifications where user_id = $1",
      [people[who]],
    )
  )[0].count;

beforeAll(async () => {
  database = await createTestDatabase();
  collegeId = await seedBase(database.db, {
    name: "Test College",
    shortName: "TC",
  });
  for (const name of [
    "viceDean",
    "head",
    "hind",
    "salem",
    "fahad",
    "noura",
    "yasser",
  ]) {
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
  const created = await createTerm(
    { name: "الفصل الأول 1448", startsOn: "2026-08-23", weeks: 18 },
    change("viceDean"),
    database.db,
  );
  if (created.status !== "created") throw new Error(created.status);
  termId = created.id;
  await activateTerm(termId, change("viceDean"), database.db);

  const roleOf = async (key: string) =>
    (
      await query("select id from roles where college_id = $1 and key = $2", [
        collegeId,
        key,
      ])
    )[0].id as string;
  const head = await roleOf("head");
  const trainer = await roleOf("trainer");
  for (const [who, roleId, departmentId, forTerm] of [
    ["head", head, electrical],
    ["hind", trainer, electrical],
    ["salem", trainer, electrical],
    ["fahad", trainer, electrical],
    ["noura", trainer, mechanical],
    ["yasser", trainer, electrical, termId],
  ]) {
    await addMembership(
      {
        userId: people[who],
        roleId,
        departmentId,
        ...(forTerm && { termId: forTerm }),
      },
      change("viceDean"),
      database.db,
    );
  }

  // Each delegation's role, as the admin makes it on the roles grid, and its template, as the seed
  // would write it: shared, under axis 9, without items.
  [{ id: assignmentsAxis }] = await query(
    "select id from axes where code = '9'",
  );
  for (const [name, key] of [
    ["review", REVIEW],
    ["portfolio", PORTFOLIO],
  ] as const) {
    const role = await createRole(
      { label: labels[name] },
      "ar",
      change("viceDean"),
      database.db,
    );
    if (role.status !== "created") throw new Error(role.status);
    await setRolePermissions(
      role.id,
      { permissions: [key] },
      change("viceDean"),
      database.db,
    );
    roles[name] = role.id;
    [{ key: roleKeys[name] }] = await query(
      "select key from roles where id = $1",
      [role.id],
    );
    [{ id: delegations[name] }] = await query(
      `insert into assignment_templates (college_id, key, title, axis_id, grants_role_id)
       values ($1, $2, $3, $4, $5) returning id`,
      [collegeId, `${name}-delegation`, titles[name], assignmentsAxis, role.id],
    );
  }
});

afterAll(() => database?.drop());

describe("a delegation", () => {
  it("gives its role in the department for the term: the person holds its key there, beside the head, and nowhere else", async () => {
    expect(await may("hind", REVIEW, electrical)).toBe(false);
    await expect(delegate("review", ["hind"])).resolves.toEqual({
      status: "assigned",
      added: 1,
      held: 0,
    });

    const granted = await membershipsOf("hind", "review");
    expect(granted).toEqual([
      { id: expect.any(String), departmentId: electrical, termId },
    ]);
    const assignment = await delegationOf("hind", "review");
    expect(assignment).toMatchObject({
      fromWeek: null,
      toWeek: null,
      granted: true,
    });
    expect(
      await query("select membership_id as id from assignments where id = $1", [
        assignment.id,
      ]),
    ).toEqual([{ id: granted[0].id }]);

    // In Electrical, not in Mechanical and not across the college; and only the role's key.
    expect([
      await may("hind", REVIEW, electrical),
      await may("hind", REVIEW, mechanical),
      await may("hind", REVIEW),
      await may("hind", PORTFOLIO, electrical),
    ]).toEqual([true, false, false, false]);
    expect(permittedDepartments(await actor("hind"), REVIEW)).toEqual([
      electrical,
    ]);
    expect(await holders(REVIEW)).toEqual(["head", "hind"]);
    expect(
      (await holdersIn(collegeId, [mechanical], REVIEW, database.db)).get(
        mechanical,
      ),
    ).toEqual([]);
  });

  it("given for some weeks still gives its role for the whole term: its membership holds no weeks, which is why Step 29 refuses weeks for a delegation (ADR-0031)", async () => {
    await expect(
      delegate("review", ["salem"], { weeks: { from: 1, to: 4 } }),
    ).resolves.toEqual({ status: "assigned", added: 1, held: 0 });
    expect(await delegationOf("salem", "review")).toMatchObject({
      fromWeek: 1,
      toWeek: 4,
      granted: true,
    });
    // The membership is a whole term's, as Hind's is: a role in a department for a term. Its table
    // has no column for weeks, and access reads no clock.
    expect(await membershipsOf("salem", "review")).toEqual([
      { id: expect.any(String), departmentId: electrical, termId },
    ]);
    expect(
      (
        await query(
          `select column_name as name from information_schema.columns
           where table_schema = 'public' and table_name = 'memberships'
           order by column_name`,
        )
      ).map(({ name }) => name),
    ).toEqual([
      "college_id",
      "created_at",
      "department_id",
      "id",
      "role_id",
      "term_id",
      "user_id",
    ]);
    expect(await may("salem", REVIEW, electrical)).toBe(true);
  });

  it("is held by more than one person, one person holds both delegations at once, and given again in the term it adds nothing", async () => {
    await expect(delegate("portfolio", ["hind"])).resolves.toEqual({
      status: "assigned",
      added: 1,
      held: 0,
    });
    expect([
      await may("hind", REVIEW, electrical),
      await may("hind", PORTFOLIO, electrical),
      await may("salem", REVIEW, electrical),
      await may("salem", PORTFOLIO, electrical),
    ]).toEqual([true, true, true, false]);
    expect(await holders(REVIEW)).toEqual(["head", "hind", "salem"]);
    expect(await holders(PORTFOLIO)).toEqual(["head", "hind"]);

    // Given again, even for other weeks, it keeps what each holds and records nothing.
    const state = () =>
      Promise.all([
        query(
          `select id, from_week, to_week, membership_id from assignments
           where template_id = $1 order by id`,
          [delegations.review],
        ),
        query("select id from memberships where role_id = $1 order by id", [
          roles.review,
        ]),
        query("select count(*)::int as count from audit_events"),
        told("hind"),
        told("salem"),
      ]);
    const before = await state();
    await expect(
      delegate("review", ["hind", "salem"], { weeks: { from: 5, to: 8 } }),
    ).resolves.toEqual({ status: "assigned", added: 0, held: 2 });
    expect(await state()).toEqual(before);
  });

  it("makes no task: the term's pass gives its holders none, and gives a template with items its tasks", async () => {
    // Salem also supervises safety, whose items are the only tasks the term's assignments call for.
    await assign(
      {
        templateId: (
          await query(
            "select id from assignment_templates where key = 'safety-supervisor'",
          )
        )[0].id,
        termId,
        departmentId: electrical,
        userIds: [people.salem],
      },
      change(),
      database.db,
    );
    const items =
      assignmentCatalog.find(({ key }) => key === "safety-supervisor")?.items
        .length ?? 0;
    await expect(
      generateTerm(collegeId, termId, "assignment", {
        at: new Date("2026-09-01T09:00:00Z"),
        db: database.db,
      }),
    ).resolves.toMatchObject({ total: items, created: items });
    expect(
      await query(
        `select assignee_id as "assigneeId", count(*)::int as count from tasks
         where term_id = $1 and source = 'assignment' group by assignee_id`,
        [termId],
      ),
    ).toEqual([{ assigneeId: people.salem, count: items }]);
    // A task names the template item it comes from, and the delegations' templates have none.
    expect(
      await query(
        `select count(*)::int as count from tasks
         join assignment_template_items i on i.id = tasks.source_item_id
         where i.template_id = any($1)`,
        [[delegations.review, delegations.portfolio]],
      ),
    ).toEqual([{ count: 0 }]);
  });

  it("is withdrawn by revoking it: its role and key go, the other delegation stays, the log keeps each step, and the person hears of the grant and of the withdrawal", async () => {
    const assignment = await delegationOf("hind", "review");
    const [membership] = await membershipsOf("hind", "review");
    await expect(
      revokeAssignment(assignment.id, change(), database.db),
    ).resolves.toEqual({ status: "revoked", termId });

    expect(await membershipsOf("hind", "review")).toEqual([]);
    expect([
      await may("hind", REVIEW, electrical),
      await may("hind", PORTFOLIO, electrical),
    ]).toEqual([false, true]);
    expect(await holders(REVIEW)).toEqual(["head", "salem"]);

    // The log names the head for all four: the assignment's two events, each with its membership's.
    const by = people.head;
    const given = {
      termId,
      departmentId: electrical,
      title: titles.review,
      userId: people.hind,
    };
    const held = {
      userId: people.hind,
      role: roleKeys.review,
      departmentId: electrical,
      termId,
    };
    expect(
      await query(
        `select action, actor_id as "actorId", diff from audit_events
         where entity_id = any($1) order by created_at, id`,
        [[assignment.id, membership.id]],
      ),
    ).toEqual([
      { action: "assignment.create", actorId: by, diff: { to: given } },
      { action: "membership.create", actorId: by, diff: { to: held } },
      { action: "membership.delete", actorId: by, diff: { from: held } },
      { action: "assignment.revoke", actorId: by, diff: { from: given } },
    ]);

    // The grant tells her, and so does its withdrawal.
    const where = {
      role: labels.review,
      scope: "department",
      department: "Electrical",
    };
    expect(
      await query(
        `select kind, params from notifications
         where user_id = $1 and params->>'role' = $2 order by created_at, id`,
        [people.hind, labels.review],
      ),
    ).toEqual([
      { kind: "membershipAdded", params: where },
      { kind: "membershipRemoved", params: where },
    ]);
  });

  it("leaves its role to someone who already held it for every term: giving it adds nothing, revoking it removes nothing, and neither tells them (ADR-0028)", async () => {
    await addMembership(
      { userId: people.fahad, roleId: roles.review, departmentId: electrical },
      change("viceDean"),
      database.db,
    );
    const before = await membershipsOf("fahad", "review");
    expect(before).toEqual([
      { id: expect.any(String), departmentId: electrical, termId: null },
    ]);
    const notices = await told("fahad");

    await expect(delegate("review", ["fahad"])).resolves.toEqual({
      status: "assigned",
      added: 1,
      held: 0,
    });
    const assignment = await delegationOf("fahad", "review");
    expect(assignment.granted).toBe(false);
    await expect(
      revokeAssignment(assignment.id, change(), database.db),
    ).resolves.toEqual({ status: "revoked", termId });

    expect(await membershipsOf("fahad", "review")).toEqual(before);
    expect(await may("fahad", REVIEW, electrical)).toBe(true);
    expect(await told("fahad")).toBe(notices);
    await query("delete from memberships where id = $1", [before[0].id]);
  });
});

describe("a department's own template", () => {
  it("cannot grant a role: its input has no field for one, so creating or editing it leaves it granting nothing; and the delegations' shared templates change for no head", async () => {
    expect(Object.keys(assignmentTemplateInput.shape)).toEqual([
      "title",
      "axisId",
    ]);
    const asked = {
      title: "مسؤول المختبرات",
      axisId: assignmentsAxis,
      grantsRoleId: roles.review,
    };
    const input = assignmentTemplateInput.parse(asked);
    expect(input).toEqual({ title: asked.title, axisId: assignmentsAxis });
    const own = await createTemplate(electrical, input, change(), database.db);
    if (own.status !== "created") throw new Error(own.status);
    await expect(
      updateTemplate(
        own.id,
        assignmentTemplateInput.parse({
          ...asked,
          title: "مسؤول المختبرات والورش",
        }),
        change(),
        database.db,
      ),
    ).resolves.toEqual({ status: "saved" });
    expect(
      await query(
        "select grants_role_id as role from assignment_templates where id = $1",
        [own.id],
      ),
    ).toEqual([{ role: null }]);

    // Given to Fahad, it gives him no role.
    const memberships = await query(
      "select id from memberships where user_id = $1 order by id",
      [people.fahad],
    );
    await assign(
      {
        templateId: own.id,
        termId,
        departmentId: electrical,
        userIds: [people.fahad],
      },
      change(),
      database.db,
    );
    expect(
      (await termAssignments(collegeId, termId, electrical, database.db)).find(
        ({ templateId }) => templateId === own.id,
      ),
    ).toMatchObject({ userId: people.fahad, granted: false });
    expect(
      await query("select id from memberships where user_id = $1 order by id", [
        people.fahad,
      ]),
    ).toEqual(memberships);

    // A delegation's template is shared: no head renames it, moves it, or gives it items.
    await expect(
      updateTemplate(
        delegations.review,
        { title: "تفويض", axisId: assignmentsAxis },
        change(),
        database.db,
      ),
    ).resolves.toEqual({ status: "shared" });
    await expect(
      addTemplateItem(
        delegations.review,
        {
          title: "مراجعة العينة",
          kind: "general",
          evidence: {
            required: false,
            types: ["pdf"],
            maxFiles: 1,
            requiresApproval: false,
          },
        },
        change(),
        ["pdf"],
        database.db,
      ),
    ).resolves.toEqual({ status: "shared" });
  });
});

// Last: the first of these closes the term above, and the second needs it closed.
describe("the term a delegation is given for", () => {
  it("gives its key only while it is the active one: given for the next term, a draft, it holds once that term is activated, and given for this one, it lapses when this one closes; the next term starts with none", async () => {
    const next = await openNextTerm(
      termId,
      { name: "الفصل الثاني 1448", startsOn: "2027-01-10", weeks: 18 },
      change("viceDean"),
      await calendarSettings(collegeId, database.db),
      database.db,
      async (tx, from, to) => {
        await copyFrameworkInto(tx, from, to, change("viceDean"));
        await copyPlansInto(tx, from, to, change("viceDean"));
      },
    );
    if (next.status !== "created") throw new Error(next.status);
    nextTermId = next.id;
    expect(
      await termAssignments(collegeId, nextTermId, electrical, database.db),
    ).toEqual([]);
    expect(
      await query("select id from memberships where term_id = $1", [
        nextTermId,
      ]),
    ).toEqual([]);

    // Hind, who trains in Electrical in every term, takes the review's for the next term, while
    // Salem holds it for this one.
    await expect(
      delegate("review", ["hind"], { termId: nextTermId }),
    ).resolves.toEqual({ status: "assigned", added: 1, held: 0 });
    expect(await membershipsOf("hind", "review")).toEqual([
      { id: expect.any(String), departmentId: electrical, termId: nextTermId },
    ]);
    expect([
      await may("hind", REVIEW, electrical),
      await may("salem", REVIEW, electrical),
    ]).toEqual([false, true]);
    expect(await holders(REVIEW)).toEqual(["head", "salem"]);

    await expect(
      activateTerm(nextTermId, change("viceDean"), database.db),
    ).resolves.toEqual({ status: "activated", closed: "الفصل الأول 1448" });
    expect([
      await may("hind", REVIEW, electrical),
      await may("salem", REVIEW, electrical),
      await may("hind", PORTFOLIO, electrical),
    ]).toEqual([true, false, false]);
    expect(await holders(REVIEW)).toEqual(["head", "hind"]);
    expect(await holders(PORTFOLIO)).toEqual(["head"]);
    // Salem's grant stays with its closed term, as the term keeps its assignments.
    expect(await membershipsOf("salem", "review")).toEqual([
      { id: expect.any(String), departmentId: electrical, termId },
    ]);
  });
});

describe("giving a delegation", () => {
  it("refuses someone who holds no role in the department in the term, with everyone chosen beside them, and a closed term", async () => {
    // Noura trains in Mechanical; Yasser trained in Electrical in the closed term alone.
    for (const who of [["salem", "noura"], ["yasser"]]) {
      await expect(
        delegate("review", who, { termId: nextTermId }),
      ).resolves.toEqual({ status: "notMember" });
    }
    expect(
      (
        await termAssignments(collegeId, nextTermId, electrical, database.db)
      ).map(({ name }) => name),
    ).toEqual(["hind"]);
    expect(await membershipsOf("salem", "review")).toEqual([
      { id: expect.any(String), departmentId: electrical, termId },
    ]);

    await expect(delegate("portfolio", ["salem"])).resolves.toEqual({
      status: "closed",
    });
    await expect(
      revokeAssignment(
        (await delegationOf("salem", "review")).id,
        change(),
        database.db,
      ),
    ).resolves.toEqual({ status: "closed" });
  });
});

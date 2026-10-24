import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assignmentCatalog, seedBase } from "../../db/seed/base.ts";
import {
  addMembership,
  loadAccess,
  roleHolders,
} from "../../src/modules/access/index.ts";
import {
  addTemplateItem,
  assign,
  assignedTerms,
  createTemplate,
  deleteTemplate,
  departmentTemplates,
  removeTemplateItem,
  revokeAssignment,
  termAssignments,
  updateTemplate,
  updateTemplateItem,
} from "../../src/modules/assignments/index.ts";
import type { AssignmentItemInput } from "../../src/modules/framework/index.ts";
import { createAccount } from "../../src/modules/identity/index.ts";
import { createDepartment } from "../../src/modules/org/index.ts";
import { generateTerm } from "../../src/modules/tasks/index.ts";
import {
  activateTerm,
  closeTerm,
  createTerm,
} from "../../src/modules/terms/index.ts";
import { createTestDatabase } from "./support/database.ts";

// Assignments (Step 21) on a real database: an 18-week term from Sunday 23 August 2026, with no
// holiday in it; Electrical's head and its trainers Hind and Salem; Noura, who trains in Mechanical;
// the six templates every department shares, from the base seed; and the secretary's role holding
// one key, so that its grant shows in what a person may do.
let database: Awaited<ReturnType<typeof createTestDatabase>>;
let collegeId: string;
let termId: string;
let electrical: string;
let mechanical: string;
let assignmentsAxis: string;
let secretaryRole: string;
const people: Record<string, string> = {};
const templates: Record<string, string> = {};

const query = async (text: string, values: unknown[] = []) =>
  (await database.pool.query(text, values)).rows;
const change = (who = "head") => ({ collegeId, actorId: people[who] });

// The file types the college accepts, as the actions read them from files.acceptedTypes.
const accepted = ["pdf", "docx"];
const item = (title: string): AssignmentItemInput => ({
  title,
  kind: "general",
  evidence: {
    required: false,
    types: ["pdf"],
    maxFiles: 3,
    requiresApproval: false,
  },
});

const assigned = async (
  input: Omit<Parameters<typeof assign>[0], "termId" | "departmentId"> & {
    departmentId?: string;
  },
) =>
  assign({ termId, departmentId: electrical, ...input }, change(), database.db);

// The person's assignment of a template in Electrical this term.
async function assignmentOf(who: string, template: string) {
  const found = (
    await termAssignments(collegeId, termId, electrical, database.db)
  ).find(
    ({ userId, templateId }) =>
      userId === people[who] && templateId === templates[template],
  );
  if (!found) throw new Error(`${who} holds no ${template}`);
  return found;
}

// The keys the person holds in Electrical.
const keysIn = async (who: string) =>
  (await loadAccess(people[who], collegeId, database.db)).grants
    .filter(({ departmentId }) => departmentId === electrical)
    .map(({ permission }) => permission);

// The person's tasks of the term from assignments, by title, as the engine left them.
const tasksOf = (who: string) =>
  query(
    `select title, week, due_on::text as "dueOn", axis_id as "axisId", source,
       holder_id as "holderId", assignee_id as "assigneeId", status,
       cancelled_at is not null as cancelled
     from tasks where term_id = $1 and source = 'assignment' and assignee_id = $2
     order by title`,
    [termId, people[who]],
  );

const generate = () =>
  generateTerm(collegeId, termId, "assignment", {
    at: new Date("2026-09-01T09:00:00Z"),
    db: database.db,
  });

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
  const roleOf = async (key: string) =>
    (
      await query("select id from roles where college_id = $1 and key = $2", [
        collegeId,
        key,
      ])
    )[0].id as string;
  const trainer = await roleOf("trainer");
  secretaryRole = await roleOf("secretary");
  for (const [who, departmentId] of [
    ["hind", electrical],
    ["salem", electrical],
    ["noura", mechanical],
  ]) {
    await addMembership(
      { userId: people[who], roleId: trainer, departmentId },
      change("viceDean"),
      database.db,
    );
  }
  await query(
    "insert into role_permissions (role_id, permission) values ($1, 'announcements.publish')",
    [secretaryRole],
  );
  [{ id: assignmentsAxis }] = await query(
    "select id from axes where code = '9'",
  );
  for (const { id, key } of await query(
    "select id, key from assignment_templates where key is not null",
  )) {
    templates[key] = id;
  }
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

describe("the secretary's template", () => {
  it("gives the secretary's role and its keys in the department for the term when assigned, and takes them back when revoked", async () => {
    expect(await keysIn("hind")).not.toContain("announcements.publish");
    await expect(
      assigned({ templateId: templates.secretary, userIds: [people.hind] }),
    ).resolves.toEqual({ status: "assigned", added: 1, held: 0 });

    expect(await keysIn("hind")).toContain("announcements.publish");
    expect(
      await query(
        `select term_id as "termId" from memberships
         where user_id = $1 and role_id = $2 and department_id = $3`,
        [people.hind, secretaryRole, electrical],
      ),
    ).toEqual([{ termId }]);
    const assignment = await assignmentOf("hind", "secretary");
    expect(assignment).toMatchObject({
      name: "hind",
      fromWeek: null,
      toWeek: null,
      granted: true,
    });

    await expect(
      revokeAssignment(assignment.id, change(), database.db),
    ).resolves.toEqual({ status: "revoked", termId });
    expect(await keysIn("hind")).not.toContain("announcements.publish");
    expect(
      await query("select 1 from memberships where role_id = $1", [
        secretaryRole,
      ]),
    ).toEqual([]);

    // Each change is in the log, with the role's own events, and Hind heard of both.
    expect(
      await query(
        `select action, diff from audit_events
         where action in ('assignment.create', 'assignment.revoke', 'membership.create', 'membership.delete')
           and (diff->'to'->>'userId' = $1 or diff->'from'->>'userId' = $1)
           and (entity_type = 'assignment' or coalesce(diff->'to'->>'role', diff->'from'->>'role') = 'secretary')
         order by created_at, id`,
        [people.hind],
      ),
    ).toEqual([
      {
        action: "assignment.create",
        diff: {
          to: {
            termId,
            departmentId: electrical,
            title: "أمين القسم",
            userId: people.hind,
          },
        },
      },
      {
        action: "membership.create",
        diff: {
          to: {
            userId: people.hind,
            role: "secretary",
            departmentId: electrical,
            termId,
          },
        },
      },
      {
        action: "membership.delete",
        diff: {
          from: {
            userId: people.hind,
            role: "secretary",
            departmentId: electrical,
            termId,
          },
        },
      },
      {
        action: "assignment.revoke",
        diff: {
          from: {
            termId,
            departmentId: electrical,
            title: "أمين القسم",
            userId: people.hind,
          },
        },
      },
    ]);
    expect(
      await query(
        "select kind from notifications where user_id = $1 order by created_at, id",
        [people.hind],
      ),
    ).toEqual(
      expect.arrayContaining([
        { kind: "membershipAdded" },
        { kind: "membershipRemoved" },
      ]),
    );
  });

  it("leaves the role to someone who already held it, for the term or for every term, and tells them nothing (Audit 7)", async () => {
    for (const forTerm of [termId, undefined]) {
      await addMembership(
        {
          userId: people.salem,
          roleId: secretaryRole,
          departmentId: electrical,
          ...(forTerm && { termId: forTerm }),
        },
        change("viceDean"),
        database.db,
      );
      const before = await query(
        "select id from memberships where user_id = $1 and role_id = $2",
        [people.salem, secretaryRole],
      );
      const told = async () =>
        (
          await query(
            "select count(*)::int as count from notifications where user_id = $1",
            [people.salem],
          )
        )[0].count;
      const notices = await told();
      await assigned({
        templateId: templates.secretary,
        userIds: [people.salem],
      });
      const assignment = await assignmentOf("salem", "secretary");
      expect(assignment.granted).toBe(false);
      await revokeAssignment(assignment.id, change(), database.db);
      expect(await keysIn("salem")).toContain("announcements.publish");
      expect(
        await query(
          "select id from memberships where user_id = $1 and role_id = $2",
          [people.salem, secretaryRole],
        ),
      ).toEqual(before);
      expect(await told()).toBe(notices);
      await query("delete from memberships where role_id = $1", [
        secretaryRole,
      ]);
    }
  });
});

describe("an assignment's tasks", () => {
  it("are the template's items for each assignee, under its axis, due once in the term's last week or the range's", async () => {
    await assigned({
      templateId: templates["safety-supervisor"],
      userIds: [people.hind],
    });
    await assigned({
      templateId: templates["workshops-supervisor"],
      userIds: [people.salem],
      weeks: { from: 3, to: 9 },
    });
    await generate();

    const titles = (key: string) =>
      (assignmentCatalog.find((each) => each.key === key)?.items ?? [])
        .map(({ title }) => title)
        .sort();
    const hind = await tasksOf("hind");
    expect(hind.map(({ title }) => title)).toEqual(titles("safety-supervisor"));
    expect(hind).toHaveLength(11);
    for (const task of hind) {
      expect(task).toMatchObject({
        week: 18,
        dueOn: "2026-12-24",
        axisId: assignmentsAxis,
        source: "assignment",
        holderId: people.hind,
        status: "notStarted",
        cancelled: false,
      });
    }
    const salem = await tasksOf("salem");
    expect(salem.map(({ title }) => title)).toEqual(
      titles("workshops-supervisor"),
    );
    for (const task of salem) {
      expect(task).toMatchObject({ week: 9, dueOn: "2026-10-22" });
    }
    // A second pass finds nothing to do.
    await expect(generate()).resolves.toMatchObject({
      created: 0,
      updated: 0,
      cancelled: 0,
    });
  });

  it("are cancelled by the pass after a revocation while not started, and found again by the same assignment", async () => {
    const started = "متابعة جاهزية الورش.";
    await query(
      "update tasks set status = 'inProgress' where assignee_id = $1 and title = $2",
      [people.salem, started],
    );
    const assignment = await assignmentOf("salem", "workshops-supervisor");
    await revokeAssignment(assignment.id, change(), database.db);
    await generate();
    const after = await tasksOf("salem");
    expect(
      after.filter(({ cancelled }) => !cancelled).map(({ title }) => title),
    ).toEqual([started]);
    expect(after.filter(({ cancelled }) => cancelled)).toHaveLength(3);

    await assigned({
      templateId: templates["workshops-supervisor"],
      userIds: [people.salem],
      weeks: { from: 3, to: 9 },
    });
    await generate();
    expect(
      (await tasksOf("salem")).filter(({ cancelled }) => cancelled),
    ).toEqual([]);
    expect(await tasksOf("salem")).toHaveLength(4);
  });
});

describe("assigning", () => {
  it("refuses another department's template, weeks past the term's end, and someone who holds no role in the department, and keeps an assignment already made", async () => {
    const theirs = await createTemplate(
      mechanical,
      { title: "مسؤول المخزن", axisId: assignmentsAxis },
      change(),
      database.db,
    );
    if (theirs.status !== "created") throw new Error(theirs.status);
    await expect(
      assigned({ templateId: theirs.id, userIds: [people.hind] }),
    ).resolves.toEqual({ status: "notFound" });
    await expect(
      assigned({
        templateId: templates["schedule-coordinator"],
        userIds: [people.hind],
        weeks: { from: 10, to: 19 },
      }),
    ).resolves.toEqual({ status: "outsideTerm" });
    await expect(
      assigned({
        templateId: templates["schedule-coordinator"],
        userIds: [people.hind, people.noura],
      }),
    ).resolves.toEqual({ status: "notMember" });
    await expect(
      assigned({
        templateId: templates["safety-supervisor"],
        userIds: [people.hind, people.salem],
      }),
    ).resolves.toEqual({ status: "assigned", added: 1, held: 1 });
    await expect(
      assignedTerms(collegeId, templates["safety-supervisor"], database.db),
    ).resolves.toEqual([termId]);
  });
});

describe("a department's own templates", () => {
  it("are added, renamed and given items by their head, and taken out while not assigned; the shared six change for no one", async () => {
    const own = await createTemplate(
      electrical,
      { title: "مسؤول العهد", axisId: assignmentsAxis },
      change(),
      database.db,
    );
    if (own.status !== "created") throw new Error(own.status);
    // A title the department already assigns, shared or its own, is taken.
    await expect(
      createTemplate(
        electrical,
        { title: "أمين القسم", axisId: assignmentsAxis },
        change(),
        database.db,
      ),
    ).resolves.toEqual({ status: "taken" });
    await expect(
      updateTemplate(
        own.id,
        { title: "مسؤول العهد والمخزون", axisId: assignmentsAxis },
        change(),
        database.db,
      ),
    ).resolves.toEqual({ status: "saved" });
    await expect(
      updateTemplate(
        templates.secretary,
        { title: "أمين", axisId: assignmentsAxis },
        change(),
        database.db,
      ),
    ).resolves.toEqual({ status: "shared" });

    const first = await addTemplateItem(
      own.id,
      item("جرد العهد"),
      change(),
      accepted,
      database.db,
    );
    if (first.status !== "saved") throw new Error(first.status);
    await addTemplateItem(
      own.id,
      item("تسليم العهد"),
      change(),
      accepted,
      database.db,
    );
    await expect(
      addTemplateItem(
        own.id,
        {
          ...item("صور العهد"),
          evidence: { ...item("").evidence, types: ["exe"] },
        },
        change(),
        accepted,
        database.db,
      ),
    ).resolves.toEqual({ status: "notOffered" });
    await expect(
      addTemplateItem(
        templates.secretary,
        item("أرشفة البريد"),
        change(),
        accepted,
        database.db,
      ),
    ).resolves.toEqual({ status: "shared" });
    await expect(
      updateTemplateItem(
        first.id,
        item("جرد العهد"),
        change(),
        accepted,
        database.db,
      ),
    ).resolves.toEqual({ status: "unchanged" });
    await expect(
      updateTemplateItem(
        first.id,
        item("جرد العهد في نهاية الفصل"),
        change(),
        accepted,
        database.db,
      ),
    ).resolves.toEqual({ status: "saved" });

    const listed = await departmentTemplates(
      collegeId,
      electrical,
      database.db,
    );
    expect(listed.map(({ title }) => title)).toEqual([
      ...assignmentCatalog.map(({ title }) => title),
      "مسؤول العهد والمخزون",
    ]);
    expect(listed.at(-1)?.items.map(({ title }) => title)).toEqual([
      "جرد العهد في نهاية الفصل",
      "تسليم العهد",
    ]);

    // Assigned, it stays, and the page reads it as assigned, so it offers no delete (lead review D,
    // M1); revoked, it goes with its items.
    const assignedOf = async (id: string) =>
      (await departmentTemplates(collegeId, electrical, database.db)).find(
        (template) => template.id === id,
      )?.assigned;
    expect(await assignedOf(own.id)).toBe(false);
    await assigned({ templateId: own.id, userIds: [people.salem] });
    expect(await assignedOf(own.id)).toBe(true);
    await expect(
      deleteTemplate(own.id, change(), database.db),
    ).resolves.toEqual({ status: "assigned" });
    const assignment = (
      await termAssignments(collegeId, termId, electrical, database.db)
    ).find(({ templateId }) => templateId === own.id);
    await revokeAssignment(assignment?.id ?? "", change(), database.db);
    expect(await assignedOf(own.id)).toBe(false);
    await expect(
      removeTemplateItem(first.id, change(), database.db),
    ).resolves.toEqual({ status: "removed" });
    await expect(
      deleteTemplate(own.id, change(), database.db),
    ).resolves.toEqual({ status: "deleted" });
    expect(
      await query(
        "select 1 from assignment_template_items where template_id = $1",
        [own.id],
      ),
    ).toEqual([]);
    expect(
      (
        await query(
          `select action, diff from audit_events where entity_type = 'assignmentTemplate'
           and entity_id = $1 order by created_at, id`,
          [own.id],
        )
      ).map(({ action }) => action),
    ).toEqual([
      "assignmentTemplate.create",
      "assignmentTemplate.update",
      "assignmentTemplateItem.create",
      "assignmentTemplateItem.create",
      "assignmentTemplateItem.update",
      "assignmentTemplateItem.delete",
      "assignmentTemplate.delete",
    ]);
  });
});

describe("a draft next term", () => {
  it("reaches its own role holders, not the active term's: someone who holds a role there for that term alone is assigned and gets the tasks, and someone who holds one for the active term alone is not (Audit 7)", async () => {
    const next = await createTerm(
      { name: "الفصل الثاني 1448", startsOn: "2027-01-10", weeks: 18 },
      change("viceDean"),
      database.db,
    );
    if (next.status !== "created") throw new Error(next.status);
    const [{ id: trainer }] = await query(
      "select id from roles where college_id = $1 and key = 'trainer'",
      [collegeId],
    );
    // Rana trains in Electrical from the next term on; Yasser is its secretary this term alone.
    for (const name of ["rana", "yasser"]) {
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
    for (const [who, roleId, forTerm] of [
      ["rana", trainer, next.id],
      ["yasser", secretaryRole, termId],
    ]) {
      await addMembership(
        {
          userId: people[who],
          roleId,
          departmentId: electrical,
          termId: forTerm,
        },
        change("viceDean"),
        database.db,
      );
    }
    const holders = async (term: string) =>
      new Set(
        (await roleHolders(collegeId, term, database.db))
          .filter(({ departmentId }) => departmentId === electrical)
          .map(({ userId }) => userId),
      );
    const inNext = await holders(next.id);
    expect([inNext.has(people.rana), inNext.has(people.yasser)]).toEqual([
      true,
      false,
    ]);
    const inThis = await holders(termId);
    expect([inThis.has(people.rana), inThis.has(people.yasser)]).toEqual([
      false,
      true,
    ]);

    const supervisor = {
      templateId: templates["safety-supervisor"],
      departmentId: electrical,
    };
    await expect(
      assign(
        { ...supervisor, termId: next.id, userIds: [people.rana] },
        change(),
        database.db,
      ),
    ).resolves.toMatchObject({ status: "assigned" });
    await expect(
      assign(
        { ...supervisor, termId: next.id, userIds: [people.yasser] },
        change(),
        database.db,
      ),
    ).resolves.toEqual({ status: "notMember" });
    await generateTerm(collegeId, next.id, "assignment", {
      at: new Date("2026-09-01T09:00:00Z"),
      db: database.db,
    });
    const items =
      assignmentCatalog.find(({ key }) => key === "safety-supervisor")?.items
        .length ?? 0;
    expect(
      await query(
        `select count(*)::int as count from tasks
         where term_id = $1 and source = 'assignment' and assignee_id = $2`,
        [next.id, people.rana],
      ),
    ).toEqual([{ count: items }]);
  });
});

// Last: it closes the term.
describe("a closed term", () => {
  it("takes no assignment and gives none back", async () => {
    const assignment = await assignmentOf("hind", "safety-supervisor");
    await closeTerm(termId, change("viceDean"), database.db);
    await expect(
      assigned({
        templateId: templates["schedule-coordinator"],
        userIds: [people.hind],
      }),
    ).resolves.toEqual({ status: "closed" });
    await expect(
      revokeAssignment(assignment.id, change(), database.db),
    ).resolves.toEqual({ status: "closed" });
  });
});

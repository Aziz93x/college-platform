import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedBase } from "../../db/seed/base.ts";
import { addMembership } from "../../src/modules/access/index.ts";
import {
  copyFrameworkInto,
  type PlanItemInput,
} from "../../src/modules/framework/index.ts";
import { createAccount } from "../../src/modules/identity/index.ts";
import { createDepartment } from "../../src/modules/org/index.ts";
import {
  addPlanItem,
  copyPlansInto,
  departmentPlan,
  findPlan,
  findPlanItem,
  movePlanItems,
  publishedPlanItems,
  publishPlan,
  removePlanItems,
  startPlanDraft,
  updatePlanItem,
} from "../../src/modules/planning/index.ts";
import {
  activateTerm,
  calendarSettings,
  closeTerm,
  createTerm,
  openNextTerm,
} from "../../src/modules/terms/index.ts";
import { createTestDatabase } from "./support/database.ts";

// A department's plan for a term (Step 19): drafts its head fills with the department's own items,
// for one person of it, a role's holders, or each trainer of its sections or courses; published
// versions that never change, each next one started from the last; the first started from another
// term's; the Step 13 wizard's copy into the next term; and the items the generation engine reads.
let database: Awaited<ReturnType<typeof createTestDatabase>>;
let collegeId: string;
let termId: string;
let axisId: string;
let trainerRole: string;
let electrical: string;
let mechanical: string;
const people: Record<string, string> = {};

const query = async (text: string, values: unknown[] = []) =>
  (await database.pool.query(text, values)).rows;
const change = (who = "head") => ({ collegeId, actorId: people[who] });

// The file types the college accepts, as the plan's actions read them from files.acceptedTypes.
const accepted = ["pdf", "docx", "xlsx"];

const item = (
  title: string,
  appliesTo: PlanItemInput["appliesTo"] = { type: "eachCourse" },
  week = 7,
): PlanItemInput => ({
  title,
  axisId,
  kind: "general",
  appliesTo,
  due: { type: "week", week },
  evidence: {
    required: true,
    types: ["pdf", "docx"],
    maxFiles: 2,
    requiresApproval: true,
  },
  notes: "",
});

// A plan's draft, started if the department has none.
async function draftOf(term: string, department: string) {
  const started = await startPlanDraft(
    term,
    department,
    change(),
    undefined,
    database.db,
  );
  if (started.status !== "created" && started.status !== "exists") {
    throw new Error(started.status);
  }
  return started.id;
}

async function add(planId: string, input: PlanItemInput) {
  const added = await addPlanItem(
    planId,
    input,
    change(),
    accepted,
    database.db,
  );
  if (added.status !== "saved") throw new Error(added.status);
  return added.id;
}

beforeAll(async () => {
  database = await createTestDatabase();
  collegeId = await seedBase(database.db, {
    name: "Test College",
    shortName: "TC",
  });
  for (const name of ["viceDean", "head", "hind", "noura"]) {
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
  [{ id: axisId }] = await query("select id from axes where code = '4'");
  [{ id: trainerRole }] = await query(
    "select id from roles where college_id = $1 and key = 'trainer'",
    [collegeId],
  );
  // Hind trains in Electrical, Noura in Mechanical.
  for (const [who, departmentId] of [
    ["hind", electrical],
    ["noura", mechanical],
  ]) {
    await addMembership(
      { userId: people[who], roleId: trainerRole, departmentId },
      change("viceDean"),
      database.db,
    );
  }
  const created = await createTerm(
    { name: "الفصل الأول 1448", startsOn: "2026-08-23", weeks: 18 },
    change("viceDean"),
    database.db,
  );
  if (created.status !== "created") throw new Error(created.status);
  termId = created.id;
});

afterAll(() => database?.drop());

describe("a department's plan", () => {
  it("starts as an empty draft, takes the department's items in order, and publishes a version that changes no more", async () => {
    const started = await startPlanDraft(
      termId,
      electrical,
      change(),
      undefined,
      database.db,
    );
    if (started.status !== "created") throw new Error(started.status);
    expect(started.items).toBe(0);
    await expect(
      startPlanDraft(termId, electrical, change(), undefined, database.db),
    ).resolves.toEqual({ status: "exists", id: started.id });
    await expect(
      publishPlan(started.id, change(), database.db),
    ).resolves.toEqual({ status: "empty" });

    const forHind = await add(
      started.id,
      item("محضر اجتماع القسم", { type: "person", userId: people.hind }),
    );
    await add(
      started.id,
      item("خطة الإرشاد", { type: "role", roleId: trainerRole }),
    );
    await add(started.id, item("نسخة الاختبار الفصلي"));
    await expect(
      updatePlanItem(
        forHind,
        item("محضر اجتماع القسم", { type: "person", userId: people.hind }),
        change(),
        accepted,
        database.db,
      ),
    ).resolves.toEqual({ status: "unchanged" });
    await expect(
      updatePlanItem(
        forHind,
        {
          ...item("محضر اجتماع القسم", {
            type: "person",
            userId: people.hind,
          }),
          notes: "بعد كل اجتماع",
        },
        change(),
        accepted,
        database.db,
      ),
    ).resolves.toEqual({ status: "saved" });
    await expect(findPlan(collegeId, started.id, database.db)).resolves.toEqual(
      { id: started.id, termId, departmentId: electrical },
    );
    await expect(
      findPlanItem(collegeId, forHind, database.db),
    ).resolves.toEqual({ id: forHind, termId, departmentId: electrical });
    await expect(
      findPlanItem(randomUUID(), forHind, database.db),
    ).resolves.toBeUndefined();

    await expect(
      publishPlan(started.id, change(), database.db),
    ).resolves.toEqual({ status: "published", termId });
    // Published: its items stay as they were.
    await expect(
      addPlanItem(
        started.id,
        item("بند متأخر"),
        change(),
        accepted,
        database.db,
      ),
    ).resolves.toEqual({ status: "notDraft" });
    await expect(
      updatePlanItem(forHind, item("تغيير"), change(), accepted, database.db),
    ).resolves.toEqual({ status: "notDraft" });
    await expect(
      movePlanItems([{ itemId: forHind, week: 9 }], change(), database.db),
    ).resolves.toEqual({ status: "notDraft" });
    await expect(
      removePlanItems([forHind], change(), database.db),
    ).resolves.toEqual({ status: "notDraft" });
    await expect(
      publishPlan(started.id, change(), database.db),
    ).resolves.toEqual({ status: "notDraft" });

    const plan = await departmentPlan(
      collegeId,
      termId,
      electrical,
      database.db,
    );
    expect(plan.draft).toBeUndefined();
    expect(
      plan.published?.items.map(({ title, notes }) => [title, notes]),
    ).toEqual([
      ["محضر اجتماع القسم", "بعد كل اجتماع"],
      ["خطة الإرشاد", ""],
      ["نسخة الاختبار الفصلي", ""],
    ]);
    expect(
      plan.versions.map(({ version, status, items }) => ({
        version,
        status,
        items,
      })),
    ).toEqual([{ version: 1, status: "published", items: 3 }]);
    expect(
      await query(
        `select action, actor_id from audit_events
         where entity_type = 'plan' and entity_id = $1 order by created_at, id`,
        [started.id],
      ),
    ).toEqual(
      [
        "plan.create",
        "planItem.create",
        "planItem.create",
        "planItem.create",
        "planItem.update",
        "plan.publish",
      ].map((action) => ({ action, actor_id: people.head })),
    );
  });

  it("starts the next version from the published one, each item still the one first entered, and leaves the published one as it was", async () => {
    const published = await publishedPlanItems(collegeId, termId, database.db);
    expect(published.map(({ origin, id }) => origin === id)).toEqual([
      true,
      true,
      true,
    ]);
    expect(new Set(published.map(({ departmentId }) => departmentId))).toEqual(
      new Set([electrical]),
    );

    const next = await startPlanDraft(
      termId,
      electrical,
      change(),
      undefined,
      database.db,
    );
    expect(next).toMatchObject({ status: "created", items: 3 });
    const { draft } = await departmentPlan(
      collegeId,
      termId,
      electrical,
      database.db,
    );
    expect(draft).toMatchObject({ version: 2, status: "draft" });
    const [first, , last] = draft?.items ?? [];
    await removePlanItems([first.id], change(), database.db);
    await movePlanItems([{ itemId: last.id, week: 9 }], change(), database.db);
    const after = await departmentPlan(
      collegeId,
      termId,
      electrical,
      database.db,
    );
    expect(after.draft?.items).toHaveLength(2);
    expect(after.published?.items).toHaveLength(3);
    expect(after.published?.items.at(-1)?.due).toEqual({
      type: "week",
      week: 7,
    });

    // Published, its items are the ones the engine reads, known by the items first entered.
    if (!draft) throw new Error("no draft");
    await publishPlan(draft.id, change(), database.db);
    const now = await publishedPlanItems(collegeId, termId, database.db);
    expect(
      now.map(({ title, origin, due }) => ({ title, origin, due })),
    ).toEqual([
      {
        title: "خطة الإرشاد",
        origin: published[1].id,
        due: { type: "week", week: 7 },
      },
      {
        title: "نسخة الاختبار الفصلي",
        origin: published[2].id,
        due: { type: "week", week: 9 },
      },
    ]);
  });

  it("reaches whom the department has, a role of the college's or a person who holds a role in it, and takes only what the college offers", async () => {
    const planId = await draftOf(termId, electrical);
    const [{ id: system }] = await query(
      "select id from roles where college_id = $1 and system",
      [collegeId],
    );
    const base = item("ملف المقرر");
    // Noura, who trains in Mechanical only; the system role; a role of no college's; a file type the
    // college does not accept; and a type of exam period it does not have.
    for (const refused of [
      item("لمدربة من قسم آخر", { type: "person", userId: people.noura }),
      item("لشخص غير موجود", { type: "person", userId: randomUUID() }),
      item("لدور النظام", { type: "role", roleId: system }),
      item("لدور غير موجود", { type: "role", roleId: randomUUID() }),
      { ...base, evidence: { ...base.evidence, types: ["mp4"] } },
      {
        ...base,
        due: {
          type: "examPeriods" as const,
          periodTypes: ["first-periodic", "midterm"],
          side: "before" as const,
          weeks: 1,
        },
      },
    ]) {
      await expect(
        addPlanItem(planId, refused, change(), accepted, database.db),
      ).resolves.toEqual({ status: "notOffered" });
    }
    await expect(
      addPlanItem(
        planId,
        { ...base, axisId: randomUUID() },
        change(),
        accepted,
        database.db,
      ),
    ).rejects.toMatchObject({ cause: { constraint: "plan_items_axis_fk" } });
    await expect(
      addPlanItem(randomUUID(), base, change(), accepted, database.db),
    ).resolves.toEqual({ status: "notFound" });
    await expect(
      startPlanDraft(termId, randomUUID(), change(), undefined, database.db),
    ).resolves.toEqual({ status: "notFound" });
  });

  it("moves items due in one week, one or several together, and takes several out at once", async () => {
    const planId = await draftOf(termId, electrical);
    const third = await add(planId, item("تقرير الأسبوع الثالث", undefined, 3));
    const fifth = await add(planId, item("تقرير الأسبوع الخامس", undefined, 5));
    const weekly = await add(planId, {
      ...item("متابعة أسبوعية"),
      due: { type: "weekly" },
    });
    const elsewhere = await add(
      await draftOf(termId, mechanical),
      item("بند قسم آخر"),
    );

    await expect(
      movePlanItems(
        [
          { itemId: third, week: 4 },
          { itemId: fifth, week: 6 },
        ],
        change(),
        database.db,
      ),
    ).resolves.toEqual({ status: "saved" });
    await expect(
      movePlanItems([{ itemId: weekly, week: 2 }], change(), database.db),
    ).resolves.toEqual({ status: "notMovable" });
    await expect(
      movePlanItems(
        [
          { itemId: third, week: 5 },
          { itemId: elsewhere, week: 5 },
        ],
        change(),
        database.db,
      ),
    ).resolves.toEqual({ status: "notFound" });
    const moved = (
      await departmentPlan(collegeId, termId, electrical, database.db)
    ).draft?.items;
    expect(
      moved
        ?.filter(({ id }) => id === third || id === fifth)
        .map(({ due }) => due),
    ).toEqual([
      { type: "week", week: 4 },
      { type: "week", week: 6 },
    ]);

    await expect(
      removePlanItems([third, fifth], change(), database.db),
    ).resolves.toEqual({ status: "saved" });
    const left = (
      await departmentPlan(collegeId, termId, electrical, database.db)
    ).draft?.items;
    expect(left?.map(({ id }) => id)).not.toContain(third);
    expect(left?.map(({ id }) => id)).toContain(weekly);
    expect(
      await query(
        `select count(*)::int from audit_events
         where action = 'planItem.delete' and entity_id = $1`,
        [planId],
      ),
    ).toEqual([{ count: 2 }]);
  });

  it("starts its first version in a term from the department's plan of another, which the page offers as the previous term's", async () => {
    const summer = await createTerm(
      { name: "الفصل الصيفي 1448", startsOn: "2027-06-13", weeks: 8 },
      change("viceDean"),
      database.db,
    );
    if (summer.status !== "created") throw new Error(summer.status);
    // Electrical's latest published version, its second, holds two items.
    const started = await startPlanDraft(
      summer.id,
      electrical,
      change(),
      termId,
      database.db,
    );
    expect(started).toMatchObject({ status: "created", items: 2 });
    if (started.status !== "created") throw new Error(started.status);
    expect(
      await query(
        "select diff from audit_events where action = 'plan.create' and entity_id = $1",
        [started.id],
      ),
    ).toEqual([
      {
        diff: {
          to: {
            termId: summer.id,
            departmentId: electrical,
            version: 1,
            items: 2,
            fromTermId: termId,
          },
        },
      },
    ]);
  });
});

describe("the next term", () => {
  it("starts with a draft of each department's plan, its latest published version or else its draft", async () => {
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
    const titles = async (term: string, department: string) => {
      const plan = await departmentPlan(
        collegeId,
        term,
        department,
        database.db,
      );
      return {
        draft: plan.draft?.items.map(({ title }) => title),
        published: plan.published?.items.map(({ title }) => title),
      };
    };
    // Electrical's second version, not the draft of its third; Mechanical's draft, its only one.
    expect(await titles(next.id, electrical)).toEqual({
      draft: (await titles(termId, electrical)).published,
      published: undefined,
    });
    expect(await titles(next.id, mechanical)).toEqual({
      draft: ["بند قسم آخر"],
      published: undefined,
    });
    expect(
      (
        await query(
          `select diff from audit_events where action = 'plan.create'
           and diff->'to'->>'termId' = $1`,
          [next.id],
        )
      ).map(({ diff }) => diff.to.fromTermId),
    ).toEqual([termId, termId]);
  });

  it("changes no plan once its term has closed", async () => {
    const planId = await draftOf(termId, electrical);
    const [kept] =
      (await departmentPlan(collegeId, termId, electrical, database.db)).draft
        ?.items ?? [];
    await activateTerm(termId, change("viceDean"), database.db);
    const closed = await closeTerm(termId, change("viceDean"), database.db);
    expect(closed.status).toBe("closed");
    await expect(
      addPlanItem(planId, item("بعد الإغلاق"), change(), accepted, database.db),
    ).resolves.toEqual({ status: "closed" });
    await expect(
      updatePlanItem(
        kept.id,
        item("بعد الإغلاق"),
        change(),
        accepted,
        database.db,
      ),
    ).resolves.toEqual({ status: "closed" });
    await expect(
      removePlanItems([kept.id], change(), database.db),
    ).resolves.toEqual({ status: "closed" });
    await expect(publishPlan(planId, change(), database.db)).resolves.toEqual({
      status: "closed",
    });
    await expect(
      startPlanDraft(termId, mechanical, change(), undefined, database.db),
    ).resolves.toEqual({ status: "closed" });
  });
});

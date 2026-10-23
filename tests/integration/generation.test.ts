import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedBase } from "../../db/seed/base.ts";
import {
  cancelTransfer,
  transferSection,
} from "../../src/modules/academics/index.ts";
import { joinRole, removeMembership } from "../../src/modules/access/index.ts";
import { listAxes } from "../../src/modules/axes/index.ts";
import {
  addItem,
  type FrameworkItemInput,
  publishDraft,
  removeItem,
  startDraft,
  termFramework,
  updateItem,
} from "../../src/modules/framework/index.ts";
import { createAccount } from "../../src/modules/identity/index.ts";
import { createDepartment } from "../../src/modules/org/index.ts";
import {
  addPlanItem,
  departmentPlan,
  publishPlan,
  removePlanItems,
  startPlanDraft,
} from "../../src/modules/planning/index.ts";
import { applyRayat, uploadRayat } from "../../src/modules/rayat/index.ts";
import {
  generateTerm,
  latestRun,
  queueGeneration,
  runQueued,
} from "../../src/modules/tasks/index.ts";
import {
  activateTerm,
  closeTerm,
  createTerm,
  saveExamPeriods,
} from "../../src/modules/terms/index.ts";
import { createLogger } from "../../src/platform/logging/logger.ts";
import { startWorker } from "../../worker/start.ts";
import { createSharedTestDatabase } from "./support/database.ts";
import { planPreview, publishedPreview } from "./support/preview.ts";
import { rayatTable } from "./support/rayat-table.ts";

// The generation engine on a real database (Step 20): an 18-week term from Sunday 23 August 2026
// with its first periodic exams in week 8 and its theoretical finals in weeks 17 and 18; Electrical's
// head and three trainers; SS01 with 30101 taught by the first trainer, 30102 by the second and
// 200109, who is not on the platform, and 30103 by no one yet; and a framework of a course plan from
// every trainer in week 2, an exam copy from each section's trainer in the last week of each of those
// exam periods, and the head's report every four weeks.
let database: Awaited<ReturnType<typeof createSharedTestDatabase>>;
let collegeId: string;
let termId: string;
let electrical: string;
const people: Record<string, string> = {};
const memberships: Record<string, string> = {};
const items: Record<string, FrameworkItemInput & { id: string }> = {};
const TERM = "الفصل التدريبي الأول 1448";
const ELECTRICAL = "قسم التقنية الكهربائية";
const PERIODS = [
  { type: "first-periodic", from: 8, to: 8 },
  { type: "theoretical-final", from: 17, to: 18 },
];
// Tuesdays of week 3 and week 8, at noon in Riyadh.
const WEEK_3 = new Date("2026-09-08T09:00:00Z");
const WEEK_8 = new Date("2026-10-13T09:00:00Z");

const query = async (text: string, values: unknown[] = []) =>
  (await database.pool.query(text, values)).rows;
const by = (name: string) => ({ collegeId, actorId: people[name] });
const generate = (at: Date) =>
  generateTerm(collegeId, termId, "framework", { at, db: database.db });

// The term's tasks, readably: the item's words, where they reach, whom they are for and when.
async function tasksOf(title?: string) {
  return query(
    `select t.title, t.section_ref as "sectionRef", t.place,
            (select name from users where id = t.holder_id) as holder,
            (select name from users where id = t.assignee_id) as assignee,
            t.assignee_number as "assigneeNumber", t.week, t.due_on::text as "dueOn",
            t.status, t.cancelled_at is not null as cancelled
       from tasks t
      where t.term_id = $1 and ($2::text is null or t.title = $2)
      order by t.title, t.section_ref, t.place, t.week, holder`,
    [termId, title ?? null],
  );
}

const preview = () => publishedPreview(collegeId, termId, database.db);

const meeting = (sectionRef: string, trainerNumber: string, day = "الأحد") => ({
  term: TERM,
  department: ELECTRICAL,
  courseCode: `كهر ${sectionRef.slice(-3)}`,
  courseName: "الدوائر الكهربائية",
  creditHours: "3",
  sectionRef,
  deliveryMode: "حضوري",
  day,
  time: "08:00 - 09:40",
  building: "المبنى 1",
  room: "101",
  capacity: "30",
  enrolled: "28",
  remaining: "2",
  trainerNumber,
});

// Publishes the term's draft as the vice-dean.
async function publish() {
  const { draft } = await termFramework(collegeId, termId, database.db);
  if (!draft) throw new Error("no draft");
  const result = await publishDraft(
    draft.id,
    by("viceDean"),
    false,
    database.db,
  );
  if (result.status !== "published") throw new Error(result.status);
}

beforeAll(async () => {
  database = await createSharedTestDatabase();
  collegeId = await seedBase(database.db, {
    name: "Test College",
    shortName: "TC",
  });
  for (const [name, number] of [
    ["viceDean", "600001"],
    ["head", "300001"],
    ["first", "200101"],
    ["second", "200102"],
    ["third", "200103"],
  ]) {
    people[name] = await database.db.transaction(
      async (tx) =>
        (
          await createAccount(
            {
              collegeId,
              name,
              email: `${name}@college.example`,
              employeeNumber: number,
            },
            tx,
            `password-${name}`,
          )
        ).userId,
    );
  }
  const made = await createDepartment(
    {
      name: "Electrical",
      shortName: "Electrical",
      rayatValues: [ELECTRICAL],
      active: true,
    },
    by("viceDean"),
    database.db,
  );
  if (made.status !== "created") throw new Error(made.status);
  electrical = made.id;
  for (const [name, role] of [
    ["head", "head"],
    ["first", "trainer"],
    ["second", "trainer"],
    ["third", "trainer"],
  ]) {
    await joinRole(
      {
        userId: people[name],
        collegeId,
        role: { key: role },
        departmentId: electrical,
      },
      database.db,
    );
  }
  for (const { id, userId } of await query(
    `select id, user_id as "userId" from memberships where college_id = $1`,
    [collegeId],
  )) {
    const name = Object.keys(people).find((each) => people[each] === userId);
    if (name) memberships[name] = id;
  }

  const created = await createTerm(
    { name: TERM, startsOn: "2026-08-23", weeks: 18 },
    by("viceDean"),
    database.db,
  );
  if (created.status !== "created") throw new Error(created.status);
  termId = created.id;
  await activateTerm(termId, by("viceDean"), database.db);
  await saveExamPeriods(termId, PERIODS, by("viceDean"), database.db);

  const upload = await uploadRayat(
    "ss01",
    termId,
    rayatTable("ss01", [
      meeting("30101", "200101"),
      meeting("30102", "200102"),
      meeting("30102", "200109", "الثلاثاء"),
      meeting("30103", ""),
    ]),
    by("viceDean"),
    database.db,
  );
  if (upload.status !== "pending") throw new Error(upload.status);
  await applyRayat(upload.importId, by("viceDean"), database.db);

  const [axis] = (await listAxes(collegeId, database.db)).flatMap(
    (group) => group.axes,
  );
  const [trainer, head] = await Promise.all(
    ["trainer", "head"].map(
      async (key) =>
        (
          await query(
            "select id from roles where college_id = $1 and key = $2",
            [collegeId, key],
          )
        )[0].id as string,
    ),
  );
  const evidence = {
    required: true,
    types: ["pdf"],
    maxFiles: 2,
    requiresApproval: false,
  };
  const draft = await startDraft(termId, by("viceDean"), database.db);
  if (draft.status !== "created") throw new Error(draft.status);
  for (const [key, input] of Object.entries({
    plan: {
      title: "توصيف المقرر",
      axisId: axis.id,
      kind: "general",
      appliesTo: { type: "role", roleId: trainer },
      due: { type: "week", week: 2 },
      evidence,
      notes: "",
    },
    examCopy: {
      title: "نسخة الاختبار",
      axisId: axis.id,
      kind: "exam_copy",
      appliesTo: { type: "eachSection" },
      due: {
        type: "examPeriods",
        periodTypes: PERIODS.map(({ type }) => type),
        side: "after",
        weeks: 0,
      },
      evidence: { ...evidence, requiresApproval: true },
      notes: "",
    },
    report: {
      title: "تقرير القسم",
      axisId: axis.id,
      kind: "general",
      appliesTo: { type: "role", roleId: head },
      due: { type: "everyWeeks", every: 4 },
      evidence,
      notes: "",
    },
  } satisfies Record<string, FrameworkItemInput>)) {
    const added = await addItem(
      draft.id,
      input,
      by("viceDean"),
      ["pdf"],
      database.db,
    );
    if (added.status !== "saved") throw new Error(added.status);
    items[key] = { ...input, id: added.id };
  }
  await publish();
});

afterAll(() => database?.drop());

describe("generating a term's tasks", () => {
  it("makes a task for each one the preview counts, each place of each section its own, and finds nothing to do the second time", async () => {
    // 3 trainers' plans, 3 places' 2 exam copies (30103 has no trainer yet), and 4 reports.
    expect(await preview()).toBe(13);
    expect(await generate(WEEK_3)).toEqual({
      total: 13,
      created: 13,
      updated: 0,
      reassigned: 0,
      cancelled: 0,
    });
    expect(await generate(WEEK_3)).toEqual({
      total: 13,
      created: 0,
      updated: 0,
      reassigned: 0,
      cancelled: 0,
    });

    expect(await tasksOf("نسخة الاختبار")).toEqual(
      [
        ["30101", "200101", "first", "200101", 8, "2026-10-15"],
        ["30101", "200101", "first", "200101", 18, "2026-12-24"],
        ["30102", "200102", "second", "200102", 8, "2026-10-15"],
        ["30102", "200102", "second", "200102", 18, "2026-12-24"],
        // 200109 is not on the platform: their tasks wait for them.
        ["30102", "200109", null, "200109", 8, "2026-10-15"],
        ["30102", "200109", null, "200109", 18, "2026-12-24"],
      ].map(([sectionRef, place, assignee, assigneeNumber, week, dueOn]) => ({
        title: "نسخة الاختبار",
        sectionRef,
        place,
        holder: null,
        assignee,
        assigneeNumber,
        week,
        dueOn,
        status: "notStarted",
        cancelled: false,
      })),
    );
    expect(
      (await tasksOf("توصيف المقرر")).map(({ holder, dueOn }) => [
        holder,
        dueOn,
      ]),
    ).toEqual([
      ["first", "2026-09-03"],
      ["second", "2026-09-03"],
      ["third", "2026-09-03"],
    ]);
    expect(
      (await tasksOf("تقرير القسم")).map(({ assignee, week }) => [
        assignee,
        week,
      ]),
    ).toEqual([
      ["head", 4],
      ["head", 8],
      ["head", 12],
      ["head", 16],
    ]);
    // The first pass is in the log, as the system's; the second changed nothing.
    expect(
      await query(
        "select actor_id as actor, entity_id as term, diff from audit_events where action = 'task.generate'",
      ),
    ).toEqual([
      {
        actor: null,
        term: termId,
        diff: {
          to: {
            cause: "framework",
            version: 1,
            created: 13,
            updated: 0,
            reassigned: 0,
            cancelled: 0,
          },
        },
      },
    ]);
  });

  it("gives a waiting trainer their tasks once they join", async () => {
    people.visitor = await database.db.transaction(
      async (tx) =>
        (
          await createAccount(
            {
              collegeId,
              name: "visitor",
              email: "visitor@college.example",
              employeeNumber: "200109",
            },
            tx,
            "password-visitor",
          )
        ).userId,
    );
    expect(await generate(WEEK_3)).toMatchObject({ updated: 2 });
    expect(
      (await tasksOf("نسخة الاختبار"))
        .filter(({ place }) => place === "200109")
        .map(({ assignee }) => assignee),
    ).toEqual(["visitor", "visitor"]);
  });

  it("hands a transferred section's work to the new trainer from the transfer's week, the work still to do once it is in effect, and back when it is cancelled", async () => {
    const transferred = await transferSection(
      {
        termId,
        sectionRef: "30101",
        fromNumber: "200101",
        toUserId: people.third,
        week: 6,
        reason: "إعادة توزيع الأنصبة",
      },
      by("head"),
      database.db,
    );
    if (transferred.status !== "transferred")
      throw new Error(transferred.status);
    const of30101 = async () =>
      (await tasksOf("نسخة الاختبار"))
        .filter(({ sectionRef }) => sectionRef === "30101")
        .map(({ week, assignee, status }) => [week, assignee, status]);

    // In week 3 both exams are after the transfer's week 6.
    expect(await generate(WEEK_3)).toMatchObject({ updated: 2 });
    expect(await of30101()).toEqual([
      [8, "third", "notStarted"],
      [18, "third", "notStarted"],
    ]);

    // The trainer replaced finished the midterm's copy; it stays theirs. Work they started and
    // left goes to the new trainer once the transfer is in effect.
    await database.db.transaction(async () => {
      await query(
        "update tasks set assignee_id = $1, assignee_number = '200101', status = 'done' where section_ref = '30101' and week = 8",
        [people.first],
      );
      await query(
        "update tasks set assignee_id = $1, assignee_number = '200101', status = 'inProgress' where section_ref = '30101' and week = 18",
        [people.first],
      );
    });
    expect(await generate(WEEK_8)).toMatchObject({ reassigned: 1 });
    expect(await of30101()).toEqual([
      [8, "first", "done"],
      [18, "third", "inProgress"],
    ]);

    // Cancelled: the work still to do goes back; the finished work never moved.
    const cancelled = await cancelTransfer(
      transferred.id,
      by("head"),
      database.db,
    );
    expect(cancelled).toEqual({ status: "cancelled", termId });
    expect(await generate(WEEK_8)).toMatchObject({ reassigned: 1 });
    expect(await of30101()).toEqual([
      [8, "first", "done"],
      [18, "first", "inProgress"],
    ]);
  });

  it("moves a new version's tasks not started, cancels what it drops, and never touches started or finished work", async () => {
    await query(
      "update tasks set status = 'inProgress' where title = 'تقرير القسم' and week = 4",
    );
    await query(
      "update tasks set status = 'submitted' where title = 'تقرير القسم' and week = 8",
    );
    const { status } = await startDraft(termId, by("viceDean"), database.db);
    expect(status).toBe("created");
    const { draft } = await termFramework(collegeId, termId, database.db);
    const copied = (key: string) =>
      draft?.items.find((item) => item.title === items[key].title)?.id ?? "";
    const { id: _, ...plan } = items.plan;
    await updateItem(
      copied("plan"),
      { ...plan, title: "توصيف المقرر والخطة", due: { type: "week", week: 3 } },
      by("viceDean"),
      ["pdf"],
      database.db,
    );
    await removeItem(copied("report"), by("viceDean"), database.db);
    await publish();

    expect(await generate(WEEK_8)).toEqual({
      total: 9,
      created: 0,
      updated: 3,
      reassigned: 0,
      cancelled: 2,
    });
    expect(
      (await tasksOf("توصيف المقرر والخطة")).map(({ week, dueOn }) => [
        week,
        dueOn,
      ]),
    ).toEqual([
      [3, "2026-09-10"],
      [3, "2026-09-10"],
      [3, "2026-09-10"],
    ]);
    expect(
      (await tasksOf("تقرير القسم")).map(({ week, status, cancelled }) => [
        week,
        status,
        cancelled,
      ]),
    ).toEqual([
      [4, "inProgress", false],
      [8, "submitted", false],
      [12, "notStarted", true],
      [16, "notStarted", true],
    ]);
  });

  it("moves the tasks not started of a rule anchored to exam periods with the period the vice-dean moves, and never their work (the owner's notes, 21 October 2026)", async () => {
    const copies = async () =>
      (
        await query(
          `select id, section_ref as "sectionRef", place, week, due_on::text as "dueOn", status
             from tasks where term_id = $1 and title = 'نسخة الاختبار' and occurrence = 1
            order by section_ref, place`,
          [termId],
        )
      ).map(({ id, sectionRef, place, week, dueOn, status }) => ({
        id,
        at: [sectionRef, place, week, dueOn, status].join(" "),
      }));
    const before = await copies();
    // The first periodic a week later.
    await expect(
      saveExamPeriods(
        termId,
        [{ ...PERIODS[0], from: 9, to: 9 }, PERIODS[1]],
        by("viceDean"),
        database.db,
      ),
    ).resolves.toEqual({ status: "saved" });
    expect(
      await generateTerm(collegeId, termId, "periods", {
        at: WEEK_8,
        db: database.db,
      }),
    ).toEqual({
      total: 9,
      created: 0,
      updated: 2,
      reassigned: 0,
      cancelled: 0,
    });
    // The same tasks, those not started a week later; the copy finished stays where it was.
    expect(await copies()).toEqual([
      { id: before[0].id, at: "30101 200101 8 2026-10-15 done" },
      { id: before[1].id, at: "30102 200102 9 2026-10-22 notStarted" },
      { id: before[2].id, at: "30102 200109 9 2026-10-22 notStarted" },
    ]);
    expect(
      (
        await query(
          "select diff from audit_events where action = 'task.generate' order by created_at desc limit 1",
        )
      )[0].diff.to,
    ).toMatchObject({ cause: "periods", updated: 2 });
  });

  it("cancels the tasks not started of someone who no longer holds the role, and keeps their started work", async () => {
    await query(
      "update tasks set status = 'inProgress' where holder_id = $1 and title = 'توصيف المقرر والخطة'",
      [people.second],
    );
    await removeMembership(memberships.third, by("viceDean"), database.db);
    expect(await generate(WEEK_8)).toMatchObject({ cancelled: 1 });
    expect(
      (await tasksOf("توصيف المقرر والخطة")).map(
        ({ holder, status, cancelled }) => [holder, status, cancelled],
      ),
    ).toEqual([
      ["first", "notStarted", false],
      ["second", "inProgress", false],
      ["third", "notStarted", true],
    ]);
  });
});

describe("a department's plan", () => {
  it("makes its tasks beside the framework's, in its department, as its preview counts, and a new version cancels what it drops (Step 19)", async () => {
    const started = await startPlanDraft(
      termId,
      electrical,
      by("head"),
      undefined,
      database.db,
    );
    if (started.status !== "created") throw new Error(started.status);
    const [axis] = (await listAxes(collegeId, database.db)).flatMap(
      (group) => group.axes,
    );
    const evidence = {
      required: true,
      types: ["pdf"],
      maxFiles: 1,
      requiresApproval: true,
    };
    // The minutes of the department's meeting from the second trainer in week 10, and each
    // section's attendance report in week 12.
    for (const input of [
      {
        title: "محضر اجتماع القسم",
        axisId: axis.id,
        kind: "meeting_minutes" as const,
        appliesTo: { type: "person" as const, userId: people.second },
        due: { type: "week" as const, week: 10 },
        evidence,
        notes: "",
      },
      {
        title: "تقرير الحضور",
        axisId: axis.id,
        kind: "general" as const,
        appliesTo: { type: "eachSection" as const },
        due: { type: "week" as const, week: 12 },
        evidence,
        notes: "",
      },
    ]) {
      const added = await addPlanItem(
        started.id,
        input,
        by("head"),
        ["pdf"],
        database.db,
      );
      if (added.status !== "saved") throw new Error(added.status);
    }
    await publishPlan(started.id, by("head"), database.db);

    // The second trainer's minutes, and a report from each of the three places of the sections
    // that have a trainer.
    expect(await planPreview(collegeId, termId, electrical, database.db)).toBe(
      4,
    );
    expect(
      await generateTerm(collegeId, termId, "plan", {
        at: WEEK_8,
        db: database.db,
      }),
    ).toEqual({
      total: 12,
      created: 4,
      updated: 0,
      reassigned: 0,
      cancelled: 0,
    });
    expect(
      await query(
        `select department_id as "departmentId", count(*)::int from tasks
          where term_id = $1 and source = 'plan' group by department_id`,
        [termId],
      ),
    ).toEqual([{ departmentId: electrical, count: 4 }]);
    expect(
      (await tasksOf("محضر اجتماع القسم")).map(({ holder, week }) => [
        holder,
        week,
      ]),
    ).toEqual([["second", 10]]);

    // The next version without the minutes: their task, not started, is cancelled, and the
    // reports, the same items, stay as they were.
    const next = await startPlanDraft(
      termId,
      electrical,
      by("head"),
      undefined,
      database.db,
    );
    if (next.status !== "created") throw new Error(next.status);
    const { draft } = await departmentPlan(
      collegeId,
      termId,
      electrical,
      database.db,
    );
    const minutes = draft?.items.find(
      ({ title }) => title === "محضر اجتماع القسم",
    );
    await removePlanItems([minutes?.id ?? ""], by("head"), database.db);
    await publishPlan(next.id, by("head"), database.db);
    expect(
      await generateTerm(collegeId, termId, "plan", {
        at: WEEK_8,
        db: database.db,
      }),
    ).toEqual({
      total: 11,
      created: 0,
      updated: 0,
      reassigned: 0,
      cancelled: 1,
    });
  });
});

describe("generation runs", () => {
  it("runs each queued pass once, writing what it went through and what it did", async () => {
    await joinRole(
      {
        userId: people.third,
        collegeId,
        role: { key: "trainer" },
        departmentId: electrical,
      },
      database.db,
    );
    await queueGeneration(collegeId, termId, "daily", database.db);
    expect(await latestRun(collegeId, termId, database.db)).toMatchObject({
      status: "queued",
      reason: "daily",
    });
    expect(await runQueued(database.db, () => WEEK_8)).toBe(1);
    // The framework's nine, the third trainer's plan back among them, and the plan's three reports.
    expect(await latestRun(collegeId, termId, database.db)).toMatchObject({
      status: "done",
      reason: "daily",
      total: 12,
      done: 12,
      created: 1,
      updated: 0,
      reassigned: 0,
      cancelled: 0,
    });
    expect(await runQueued(database.db, () => WEEK_8)).toBe(0);
  });

  it("queues a pass over each open term each night, and the worker runs it within the minute", async () => {
    let output = "";
    const logger = createLogger({ write: (line) => (output += line) });
    const { boss, stop } = await startWorker({
      databaseUrl: database.url,
      logger,
    });
    try {
      expect((await boss.getSchedule("task-generation"))?.cron).toBe(
        "* * * * *",
      );
      expect((await boss.getSchedule("task-generation-nightly"))?.cron).toBe(
        "37 0 * * *",
      );
      await boss.send("task-generation-nightly");
      await expect
        .poll(() => output.includes('"terms":1'), { timeout: 10_000 })
        .toBe(true);
      await boss.send("task-generation");
      await expect
        .poll(
          async () => (await latestRun(collegeId, termId, database.db))?.status,
          { timeout: 10_000 },
        )
        .toBe("done");
    } finally {
      await stop();
    }
    expect(await latestRun(collegeId, termId, database.db)).toMatchObject({
      reason: "daily",
      total: 12,
      created: 0,
    });
  });

  it("changes no task of a closed term", async () => {
    await closeTerm(termId, by("viceDean"), database.db);
    await removeMembership(memberships.first, by("viceDean"), database.db);
    expect(await generate(WEEK_8)).toEqual({
      total: 0,
      created: 0,
      updated: 0,
      reassigned: 0,
      cancelled: 0,
    });
  });
});

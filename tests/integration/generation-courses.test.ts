import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedBase } from "../../db/seed/base.ts";
import { transferSection } from "../../src/modules/academics/index.ts";
import { joinRole } from "../../src/modules/access/index.ts";
import { listAxes } from "../../src/modules/axes/index.ts";
import {
  addItem,
  publishDraft,
  startDraft,
} from "../../src/modules/framework/index.ts";
import { createAccount } from "../../src/modules/identity/index.ts";
import { createDepartment } from "../../src/modules/org/index.ts";
import { applyRayat, uploadRayat } from "../../src/modules/rayat/index.ts";
import { generateTerm } from "../../src/modules/tasks/index.ts";
import {
  activateTerm,
  addCalendarEvent,
  calendarSettings,
  createTerm,
} from "../../src/modules/terms/index.ts";
import { createSharedTestDatabase } from "./support/database.ts";
import { publishedPreview } from "./support/preview.ts";
import { rayatTable } from "./support/rayat-table.ts";

// The generation engine's tasks for each course's trainer (Steps 18 and 20), on a real database: an
// 18-week term from Sunday 23 August 2026 with its midterms in week 8 and its finals in week 18;
// one course, كهر 111, whose sections 30111 and 30112 the first trainer teaches and 30113 the
// second; and a framework of an exam copy from each course's trainer after each exam.
let database: Awaited<ReturnType<typeof createSharedTestDatabase>>;
let collegeId: string;
let termId: string;
const people: Record<string, string> = {};
const TERM = "الفصل التدريبي الأول 1448";
const ELECTRICAL = "قسم التقنية الكهربائية";
// A Tuesday of week 3, at noon in Riyadh.
const WEEK_3 = new Date("2026-09-08T09:00:00Z");

const by = (name: string) => ({ collegeId, actorId: people[name] });
const generate = (reason: "framework" | "transfer" | "ss01") =>
  generateTerm(collegeId, termId, reason, { at: WEEK_3, db: database.db });
const preview = () => publishedPreview(collegeId, termId, database.db);

// The term's exam copies: the course's place each is for, its week and whom it is for.
async function copies() {
  return (
    await database.pool.query(
      `select t.course_code as course, t.place, t.week, t.assignee_number as assignee
         from tasks t where t.term_id = $1 and t.cancelled_at is null
        order by t.place, t.week`,
      [termId],
    )
  ).rows;
}

// SS01, each section of كهر 111 with its trainer.
const ss01 = (trainers: Record<string, string>) =>
  rayatTable(
    "ss01",
    Object.entries(trainers).map(([sectionRef, trainerNumber]) => ({
      term: TERM,
      department: ELECTRICAL,
      courseCode: "كهر 111",
      courseName: "الدوائر الكهربائية",
      creditHours: "3",
      sectionRef,
      deliveryMode: "حضوري",
      day: "الأحد",
      time: "08:00 - 09:40",
      building: "المبنى 1",
      room: "101",
      capacity: "30",
      enrolled: "28",
      remaining: "2",
      trainerNumber,
    })),
  );

async function apply(table: ReturnType<typeof ss01>) {
  const upload = await uploadRayat(
    "ss01",
    termId,
    table,
    by("viceDean"),
    database.db,
  );
  if (upload.status !== "pending") throw new Error(upload.status);
  await applyRayat(upload.importId, by("viceDean"), database.db);
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
  for (const [name, role] of [
    ["head", "head"],
    ["first", "trainer"],
    ["second", "trainer"],
  ]) {
    await joinRole(
      {
        userId: people[name],
        collegeId,
        role: { key: role },
        departmentId: made.id,
      },
      database.db,
    );
  }

  const created = await createTerm(
    { name: TERM, startsOn: "2026-08-23", weeks: 18 },
    by("viceDean"),
    database.db,
  );
  if (created.status !== "created") throw new Error(created.status);
  termId = created.id;
  await activateTerm(termId, by("viceDean"), database.db);
  const settings = await calendarSettings(collegeId, database.db);
  for (const [title, startsOn, endsOn] of [
    ["اختبارات منتصف الفصل", "2026-10-11", "2026-10-15"],
    ["الاختبارات النهائية", "2026-12-20", "2026-12-24"],
  ]) {
    await addCalendarEvent(
      termId,
      { kind: "exam", title, startsOn, endsOn },
      by("viceDean"),
      settings,
      database.db,
    );
  }
  await apply(
    ss01({ "30111": "200101", "30112": "200101", "30113": "200102" }),
  );

  const [axis] = (await listAxes(collegeId, database.db)).flatMap(
    (group) => group.axes,
  );
  const draft = await startDraft(termId, by("viceDean"), database.db);
  if (draft.status !== "created") throw new Error(draft.status);
  const added = await addItem(
    draft.id,
    {
      title: "نسخة الاختبار",
      axisId: axis.id,
      kind: "exam_copy",
      appliesTo: { type: "eachCourse" },
      due: { type: "afterEvent", eventKind: "exam", weeks: 0 },
      evidence: {
        required: true,
        types: ["pdf"],
        maxFiles: 2,
        requiresApproval: true,
      },
      notes: "",
    },
    by("viceDean"),
    ["pdf"],
    database.db,
  );
  if (added.status !== "saved") throw new Error(added.status);
  const published = await publishDraft(
    draft.id,
    by("viceDean"),
    false,
    database.db,
  );
  if (published.status !== "published") throw new Error(published.status);
});

afterAll(() => database?.drop());

describe("a course's tasks", () => {
  it("are one for each trainer of the course after each exam, however many of its sections they teach, as many as the preview counts", async () => {
    expect(await preview()).toBe(4);
    expect(await generate("framework")).toMatchObject({
      total: 4,
      created: 4,
    });
    expect(await copies()).toEqual([
      { course: "كهر 111", place: "200101", week: 8, assignee: "200101" },
      { course: "كهر 111", place: "200101", week: 18, assignee: "200101" },
      { course: "كهر 111", place: "200102", week: 8, assignee: "200102" },
      { course: "كهر 111", place: "200102", week: 18, assignee: "200102" },
    ]);
  });

  it("go with a trainer's last section of the course to whoever takes it, and keep the preview's count once Rayat confirms the transfer (the owner's rule, 23 October 2026)", async () => {
    // The second trainer's only section of the course goes to the first from week 6.
    const transferred = await transferSection(
      {
        termId,
        sectionRef: "30113",
        fromNumber: "200102",
        toUserId: people.first,
        week: 6,
        reason: "إعادة توزيع الأنصبة",
      },
      by("head"),
      database.db,
    );
    expect(transferred.status).toBe("transferred");
    expect(await generate("transfer")).toMatchObject({ total: 4, updated: 2 });
    const handed = [
      { course: "كهر 111", place: "200101", week: 8, assignee: "200101" },
      { course: "كهر 111", place: "200101", week: 18, assignee: "200101" },
      { course: "كهر 111", place: "200102", week: 8, assignee: "200101" },
      { course: "كهر 111", place: "200102", week: 18, assignee: "200101" },
    ];
    expect(await copies()).toEqual(handed);

    // Rayat confirms it: the course's places are still the trainers its sections started with.
    await apply(
      ss01({ "30111": "200101", "30112": "200101", "30113": "200101" }),
    );
    expect(await preview()).toBe(4);
    expect(await generate("ss01")).toEqual({
      total: 4,
      created: 0,
      updated: 0,
      reassigned: 0,
      cancelled: 0,
    });
    expect(await copies()).toEqual(handed);
  });
});

import { readdirSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createBlankDatabase } from "./support/database.ts";

// Migration 0022 (the owner's notes, 21 October 2026; ADR-0026) on a database that migration 0021
// left with an exam week on a term's calendar, and a framework item and a section template due after
// each exam, or after another kind of day: the exam becomes an event of the college's own, and each
// rule the rule after each exam period by the same weeks.
let database: Awaited<ReturnType<typeof createBlankDatabase>>;
const MIGRATIONS = new URL("../../db/migrations/", import.meta.url);

const query = async (text: string, values: unknown[] = []) =>
  (await database.pool.query(text, values)).rows;

async function apply(file: string) {
  for (const statement of readFileSync(new URL(file, MIGRATIONS), "utf8").split(
    "--> statement-breakpoint",
  )) {
    await database.pool.query(statement);
  }
}

const EVIDENCE = {
  required: true,
  types: ["pdf"],
  maxFiles: 1,
  requiresApproval: false,
};
const EVERY_PERIOD = [
  "first-periodic",
  "second-periodic",
  "practical-final",
  "theoretical-final",
];

beforeAll(async () => {
  database = await createBlankDatabase();
  const files = readdirSync(MIGRATIONS)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files.filter((file) => file < "0022")) await apply(file);

  const [{ id: college }] = await query(
    "insert into colleges (name, short_name) values ('College', 'C') returning id",
  );
  const [{ id: term }] = await query(
    "insert into terms (college_id, name, starts_on, weeks) values ($1, 'Term', '2026-08-23', 18) returning id",
    [college],
  );
  await query(
    `insert into calendar_events (college_id, term_id, kind, title, starts_on, ends_on) values
       ($1, $2, 'exam', 'اختبارات منتصف الفصل', '2026-10-11', '2026-10-15'),
       ($1, $2, 'holiday', 'اليوم الوطني', '2026-09-23', '2026-09-23')`,
    [college, term],
  );
  const [{ id: group }] = await query(
    "insert into axis_groups (college_id, code, title, position) values ($1, '1', 'G', 0) returning id",
    [college],
  );
  const [{ id: axis }] = await query(
    "insert into axes (college_id, group_id, code, title, position) values ($1, $2, '2', 'A', 0) returning id",
    [college, group],
  );
  const [{ id: framework }] = await query(
    "insert into frameworks (college_id, term_id, version, status) values ($1, $2, 1, 'published') returning id",
    [college, term],
  );
  const item = (position: number, title: string, due: object) =>
    query(
      `insert into framework_items (college_id, framework_id, position, title, axis_id, kind, applies_to, due, evidence)
       values ($1, $2, $3, $4, $5, 'exam_copy', '{"type":"eachCourse"}', $6, $7)`,
      [college, framework, position, title, axis, due, EVIDENCE],
    );
  await item(0, "after each exam", {
    type: "afterEvent",
    eventKind: "exam",
    weeks: 0,
  });
  await item(1, "after each deadline", {
    type: "afterEvent",
    eventKind: "gradeDeadline",
    weeks: 2,
  });
  await item(2, "in week 3", { type: "week", week: 3 });
  const [{ id: department }] = await query(
    "insert into departments (college_id, name, short_name) values ($1, 'Electrical', 'E') returning id",
    [college],
  );
  await query(
    `insert into section_templates (college_id, term_id, department_id, position, title, axis_id, kind, applies_to, due, evidence)
     values ($1, $2, $3, 0, 'analysis', $4, 'grade_analysis', '{"type":"eachSection"}', $5, $6)`,
    [
      college,
      term,
      department,
      axis,
      { type: "afterEvent", eventKind: "exam", weeks: 1 },
      EVIDENCE,
    ],
  );
  await apply("0022_exam_periods.sql");
});

afterAll(() => database?.drop());

it("makes each exam week an event of the college's own with its title and days, and leaves the other days as they were", async () => {
  expect(
    await query(
      "select kind, title, starts_on::text, ends_on::text from calendar_events order by starts_on",
    ),
  ).toEqual([
    {
      kind: "holiday",
      title: "اليوم الوطني",
      starts_on: "2026-09-23",
      ends_on: "2026-09-23",
    },
    {
      kind: "custom",
      title: "اختبارات منتصف الفصل",
      starts_on: "2026-10-11",
      ends_on: "2026-10-15",
    },
  ]);
  await expect(
    query("update calendar_events set kind = 'exam' where kind = 'custom'"),
  ).rejects.toMatchObject({ code: "23514" });
});

it("makes each rule after a kind of day the rule after each exam period by the same weeks, and leaves the others as they were", async () => {
  expect(
    await query("select title, due from framework_items order by position"),
  ).toEqual([
    {
      title: "after each exam",
      due: {
        type: "examPeriods",
        periodTypes: EVERY_PERIOD,
        side: "after",
        weeks: 0,
      },
    },
    {
      title: "after each deadline",
      due: {
        type: "examPeriods",
        periodTypes: EVERY_PERIOD,
        side: "after",
        weeks: 2,
      },
    },
    { title: "in week 3", due: { type: "week", week: 3 } },
  ]);
  expect(await query("select due from section_templates")).toEqual([
    {
      due: {
        type: "examPeriods",
        periodTypes: EVERY_PERIOD,
        side: "after",
        weeks: 1,
      },
    },
  ]);
});

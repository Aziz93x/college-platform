import { readdirSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createBlankDatabase } from "./support/database.ts";

// Migrations 0023 and 0024 (Step 19) on a database that migration 0022 left with section templates
// of two departments in two terms: each department's templates for a term become the items of a
// first draft of its plan, in their order, each with its id and fields, and their table goes.
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
  requiresApproval: true,
};
let college: string;
const terms: string[] = [];
const departments: string[] = [];
const templates: string[] = [];

beforeAll(async () => {
  database = await createBlankDatabase();
  const files = readdirSync(MIGRATIONS)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files.filter((file) => file < "0023")) await apply(file);

  [{ id: college }] = await query(
    "insert into colleges (name, short_name) values ('College', 'C') returning id",
  );
  for (const [name, startsOn] of [
    ["First", "2026-08-23"],
    ["Second", "2027-01-10"],
  ]) {
    const [{ id }] = await query(
      "insert into terms (college_id, name, starts_on, weeks) values ($1, $2, $3, 18) returning id",
      [college, name, startsOn],
    );
    terms.push(id);
  }
  for (const name of ["Electrical", "Mechanical"]) {
    const [{ id }] = await query(
      "insert into departments (college_id, name, short_name) values ($1, $2, $2) returning id",
      [college, name],
    );
    departments.push(id);
  }
  const [{ id: group }] = await query(
    "insert into axis_groups (college_id, code, title, position) values ($1, '1', 'G', 0) returning id",
    [college],
  );
  const [{ id: axis }] = await query(
    "insert into axes (college_id, group_id, code, title, position) values ($1, $2, '4', 'A', 0) returning id",
    [college, group],
  );
  // Electrical's two templates for the first term, given in the other order, Mechanical's one, and
  // Electrical's one for the second term.
  for (const [term, department, position, title, applies] of [
    [terms[0], departments[0], 1, "exam copy", { type: "eachCourse" }],
    [terms[0], departments[0], 0, "analysis", { type: "eachSection" }],
    [terms[0], departments[1], 0, "workshop copy", { type: "eachCourse" }],
    [terms[1], departments[0], 0, "next analysis", { type: "eachSection" }],
  ] as const) {
    const [{ id }] = await query(
      `insert into section_templates (college_id, term_id, department_id, position, title, axis_id, kind, applies_to, due, evidence, notes)
       values ($1, $2, $3, $4, $5, $6, 'exam_copy', $7, '{"type":"week","week":7}', $8, 'kept') returning id`,
      [college, term, department, position, title, axis, applies, EVIDENCE],
    );
    templates.push(id);
  }
  await apply("0023_department_plans.sql");
  await apply("0024_drop_section_templates.sql");
});

afterAll(() => database?.drop());

it("makes each department's templates for a term the items of a first draft of its plan, in their order, each with its id and fields", async () => {
  const plans = await query(
    `select p.term_id, p.department_id, p.version, p.status, array_agg(i.id order by i.position) as items
     from plans p join plan_items i on i.plan_id = p.id
     group by p.id order by p.term_id, p.department_id`,
  );
  expect(plans).toEqual(
    [
      [terms[0], departments[0], [templates[1], templates[0]]],
      [terms[0], departments[1], [templates[2]]],
      [terms[1], departments[0], [templates[3]]],
    ]
      .sort(([a, b], [c, d]) => `${a} ${b}`.localeCompare(`${c} ${d}`, "en"))
      .map(([term_id, department_id, items]) => ({
        term_id,
        department_id,
        version: 1,
        status: "draft",
        items,
      })),
  );
  expect(
    await query(
      `select title, kind, applies_to, due, evidence, notes, origin_id from plan_items where id = $1`,
      [templates[0]],
    ),
  ).toEqual([
    {
      title: "exam copy",
      kind: "exam_copy",
      applies_to: { type: "eachCourse" },
      due: { type: "week", week: 7 },
      evidence: EVIDENCE,
      notes: "kept",
      origin_id: null,
    },
  ]);
});

it("drops the templates' table, and takes tasks and passes of the plans", async () => {
  await expect(query("select 1 from section_templates")).rejects.toMatchObject({
    code: "42P01",
  });
  expect(
    await query(
      `select pg_get_constraintdef(oid) as definition from pg_constraint
       where conname in ('tasks_source', 'generation_runs_reason') order by conname`,
    ),
  ).toEqual([
    {
      definition: expect.stringContaining("'plan'::text"),
    },
    {
      definition: expect.stringContaining("'plan'::text"),
    },
  ]);
});

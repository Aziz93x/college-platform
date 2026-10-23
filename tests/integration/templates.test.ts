import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedBase } from "../../db/seed/base.ts";
import {
  copyFrameworkInto,
  type SectionTemplateInput,
} from "../../src/modules/framework/index.ts";
import { createAccount } from "../../src/modules/identity/index.ts";
import { createDepartment } from "../../src/modules/org/index.ts";
import {
  addTemplate,
  copyTemplatesInto,
  findTemplate,
  listTemplates,
  removeTemplate,
  updateTemplate,
} from "../../src/modules/planning/index.ts";
import {
  activateTerm,
  calendarSettings,
  closeTerm,
  createTerm,
  openNextTerm,
} from "../../src/modules/terms/index.ts";
import { createTestDatabase } from "./support/database.ts";

// A head's section templates (Step 18): the department's items for each trainer of each of its
// sections, or of each of its courses, in a term, kept in order, each on an axis of the college,
// refused once the term has closed, and copied by the Step 13 wizard into the next term.
let database: Awaited<ReturnType<typeof createTestDatabase>>;
let collegeId: string;
let termId: string;
let axisId: string;
let electrical: string;
let mechanical: string;
const people: Record<string, string> = {};

const query = async (text: string, values: unknown[] = []) =>
  (await database.pool.query(text, values)).rows;
const change = (who = "head") => ({ collegeId, actorId: people[who] });

// The file types the college accepts, as the template actions read them from files.acceptedTypes.
const accepted = ["pdf", "docx", "xlsx"];

// An exam copy, the work of each course once for all its trainer's sections of it.
const template = (title: string): SectionTemplateInput => ({
  title,
  axisId,
  kind: "exam_copy",
  appliesTo: { type: "eachCourse" },
  due: { type: "week", week: 7 },
  evidence: {
    required: true,
    types: ["pdf", "docx"],
    maxFiles: 2,
    requiresApproval: true,
  },
  notes: "",
});
const titles = async (term: string, department: string) =>
  (await listTemplates(collegeId, term, department, database.db)).map(
    ({ title }) => title,
  );

beforeAll(async () => {
  database = await createTestDatabase();
  collegeId = await seedBase(database.db, {
    name: "Test College",
    shortName: "TC",
  });
  for (const name of ["viceDean", "head"]) {
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
  [{ id: axisId }] = await query("select id from axes where code = '4'");
  const created = await createTerm(
    { name: "الفصل الأول 1448", startsOn: "2026-08-23", weeks: 18 },
    change("viceDean"),
    database.db,
  );
  if (created.status !== "created") throw new Error(created.status);
  termId = created.id;
});

afterAll(() => database?.drop());

describe("a department's section templates", () => {
  it("are kept in the order the head adds them, each department's its own", async () => {
    for (const title of ["نسخة الاختبار الفصلي", "نسخة الاختبار النهائي"]) {
      const added = await addTemplate(
        termId,
        electrical,
        template(title),
        change(),
        accepted,
        database.db,
      );
      expect(added.status).toBe("saved");
    }
    await addTemplate(
      termId,
      mechanical,
      template("نسخة اختبار الورشة"),
      change(),
      accepted,
      database.db,
    );
    expect(await titles(termId, electrical)).toEqual([
      "نسخة الاختبار الفصلي",
      "نسخة الاختبار النهائي",
    ]);
    expect(await titles(termId, mechanical)).toEqual(["نسخة اختبار الورشة"]);
    const [first] = await listTemplates(
      collegeId,
      termId,
      electrical,
      database.db,
    );
    await expect(
      findTemplate(collegeId, first.id, database.db),
    ).resolves.toEqual({ id: first.id, termId, departmentId: electrical });
    await expect(
      findTemplate(randomUUID(), first.id, database.db),
    ).resolves.toBeUndefined();
  });

  it("each points to one of the college's axes", async () => {
    await expect(
      query(
        `insert into section_templates
           (college_id, term_id, department_id, position, title, kind, due, evidence)
         values ($1, $2, $3, 9, 'بلا محور', 'general', '{}', '{}')`,
        [collegeId, termId, electrical],
      ),
    ).rejects.toThrow(/axis_id/);
    await expect(
      addTemplate(
        termId,
        electrical,
        { ...template("محور غير موجود"), axisId: randomUUID() },
        change(),
        accepted,
        database.db,
      ),
    ).rejects.toMatchObject({
      cause: { constraint: "section_templates_axis_fk" },
    });
  });

  it("changes, whom it reaches too, says when nothing changed, and is taken out, each change on the log", async () => {
    const added = await addTemplate(
      termId,
      electrical,
      template("تحليل النتائج"),
      change(),
      accepted,
      database.db,
    );
    if (added.status !== "saved") throw new Error(added.status);
    await expect(
      updateTemplate(
        added.id,
        template("تحليل النتائج"),
        change(),
        accepted,
        database.db,
      ),
    ).resolves.toEqual({ status: "unchanged" });
    // A section's own analysis: each section's trainer, section by section.
    const analysis: SectionTemplateInput = {
      ...template("تحليل نتائج كل اختبار"),
      kind: "grade_analysis",
      appliesTo: { type: "eachSection" },
      due: {
        type: "examPeriods",
        periodTypes: ["first-periodic", "second-periodic", "theoretical-final"],
        side: "after",
        weeks: 1,
      },
    };
    await expect(
      updateTemplate(added.id, analysis, change(), accepted, database.db),
    ).resolves.toEqual({ status: "saved" });
    expect(
      (await listTemplates(collegeId, termId, electrical, database.db)).at(-1),
    ).toMatchObject({ ...analysis, id: added.id });
    await expect(
      removeTemplate(added.id, change(), database.db),
    ).resolves.toEqual({ status: "saved" });
    await expect(
      removeTemplate(added.id, change(), database.db),
    ).resolves.toEqual({ status: "notFound" });
    expect(
      await query(
        `select action, actor_id from audit_events
         where entity_type = 'sectionTemplate' and entity_id = $1 order by created_at`,
        [added.id],
      ),
    ).toEqual(
      ["create", "update", "delete"].map((verb) => ({
        action: `sectionTemplate.${verb}`,
        actor_id: people.head,
      })),
    );
  });

  it("takes only file types the college accepts and types of exam period it has", async () => {
    for (const offered of [
      {
        ...template("ملف بامتداد آخر"),
        evidence: { ...template("").evidence, types: ["zip"] },
      },
      {
        ...template("بعد فترة لا تعرفها الكلية"),
        due: {
          type: "examPeriods" as const,
          periodTypes: ["midterm"],
          side: "after" as const,
          weeks: 1,
        },
      },
    ]) {
      await expect(
        addTemplate(
          termId,
          electrical,
          offered,
          change(),
          accepted,
          database.db,
        ),
      ).resolves.toEqual({ status: "notOffered" });
    }
    await expect(
      addTemplate(
        randomUUID(),
        electrical,
        template("فصل غير موجود"),
        change(),
        accepted,
        database.db,
      ),
    ).resolves.toEqual({ status: "notFound" });
  });
});

describe("the next term", () => {
  it("starts with a copy of each department's templates, in order, recorded on each department's history", async () => {
    const before = {
      [electrical]: await listTemplates(
        collegeId,
        termId,
        electrical,
        database.db,
      ),
      [mechanical]: await listTemplates(
        collegeId,
        termId,
        mechanical,
        database.db,
      ),
    };
    const next = await openNextTerm(
      termId,
      { name: "الفصل الثاني 1448", startsOn: "2027-01-10", weeks: 18 },
      change("viceDean"),
      await calendarSettings(collegeId, database.db),
      database.db,
      async (tx, from, to) => {
        await copyFrameworkInto(tx, from, to, change("viceDean"));
        await copyTemplatesInto(tx, from, to, change("viceDean"));
      },
    );
    if (next.status !== "created") throw new Error(next.status);
    for (const department of [electrical, mechanical]) {
      const copied = await listTemplates(
        collegeId,
        next.id,
        department,
        database.db,
      );
      const words = (list: typeof copied) =>
        list.map(({ id: _, ...words }) => words);
      expect(words(copied)).toEqual(words(before[department]));
      expect(copied.map(({ id }) => id)).not.toContain(
        before[department][0].id,
      );
    }
    expect(
      await query(
        `select entity_id, diff from audit_events
         where action = 'sectionTemplate.copy' order by entity_id`,
      ),
    ).toEqual(
      [electrical, mechanical].sort().map((department) => ({
        entity_id: department,
        diff: {
          to: {
            termId: next.id,
            from: termId,
            templates: before[department].length,
          },
        },
      })),
    );
  });

  it("changes no template once its term has closed", async () => {
    const [first] = await listTemplates(
      collegeId,
      termId,
      electrical,
      database.db,
    );
    await activateTerm(termId, change("viceDean"), database.db);
    const closed = await closeTerm(termId, change("viceDean"), database.db);
    expect(closed.status).toBe("closed");
    await expect(
      addTemplate(
        termId,
        electrical,
        template("بعد الإغلاق"),
        change(),
        accepted,
        database.db,
      ),
    ).resolves.toEqual({ status: "closed" });
    await expect(
      updateTemplate(
        first.id,
        template("بعد الإغلاق"),
        change(),
        accepted,
        database.db,
      ),
    ).resolves.toEqual({ status: "closed" });
    await expect(
      removeTemplate(first.id, change(), database.db),
    ).resolves.toEqual({ status: "closed" });
  });
});

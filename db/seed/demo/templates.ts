import { holdersIn } from "../../../src/modules/access/index.ts";
import { listAxes } from "../../../src/modules/axes/index.ts";
import type { SectionTemplateInput } from "../../../src/modules/framework/index.ts";
import { listDepartments } from "../../../src/modules/org/index.ts";
import {
  addTemplate,
  listTemplates,
} from "../../../src/modules/planning/index.ts";
import { getSetting } from "../../../src/modules/settings/index.ts";
import { activeTerm } from "../../../src/modules/terms/index.ts";
import type { Db } from "../../../src/platform/db/client.ts";
import { demoDepartments } from "./departments.ts";
import { deviceOf } from "./device.ts";

type Template = Omit<SectionTemplateInput, "axisId"> & { axis: string };

const evidence = (
  types: string[],
  maxFiles: number,
  requiresApproval = false,
) => ({ required: true, types, maxFiles, requiresApproval });

// Electrical's section templates for the demo term (Step 18), as the plan's examples list them: the
// midterm and final exam copies, each with the head's approval, quizzes, three homework samples, a
// grade analysis a week after each exam, the course on the e-learning platform and the training
// practices. Each names its axis by code. A course's work reaches each of its trainers once for all
// their sections of it, and the grade analysis each section's trainer, section by section (the
// owner's answers, 22 October 2026).
const ELECTRICAL: Template[] = [
  {
    axis: "2",
    title: "نسخة الاختبار الفصلي ونموذج إجابته",
    kind: "exam_copy",
    appliesTo: { type: "eachCourse" },
    due: { type: "week", week: 7 },
    evidence: evidence(["pdf", "docx"], 2, true),
    notes: "تُسلّم قبل أسبوع الاختبار الفصلي.",
  },
  {
    axis: "2",
    title: "نسخة الاختبار النهائي ونموذج إجابته",
    kind: "exam_copy",
    appliesTo: { type: "eachCourse" },
    due: { type: "week", week: 16 },
    evidence: evidence(["pdf", "docx"], 2, true),
    notes: "",
  },
  {
    axis: "2",
    title: "الاختبارات القصيرة",
    kind: "exam_copy",
    appliesTo: { type: "eachCourse" },
    due: { type: "everyWeeks", every: 4 },
    evidence: evidence(["pdf", "jpg", "jpeg", "png", "heic"], 2),
    notes: "",
  },
  {
    axis: "5",
    title: "ثلاث عينات من الواجبات",
    kind: "homework",
    appliesTo: { type: "eachCourse" },
    due: { type: "week", week: 10 },
    evidence: evidence(["pdf", "jpg", "jpeg", "png", "heic"], 3),
    notes: "عينة مرتفعة وعينة متوسطة وعينة منخفضة.",
  },
  {
    axis: "3",
    title: "تحليل نتائج الشعبة",
    kind: "grade_analysis",
    appliesTo: { type: "eachSection" },
    due: { type: "afterEvent", eventKind: "exam", weeks: 1 },
    evidence: evidence(["xlsx", "pdf"], 2),
    notes: "دون أسماء المتدربين.",
  },
  {
    axis: "7",
    title: "تجهيز المقرر على منصة التدريب الإلكتروني",
    kind: "e_learning",
    appliesTo: { type: "eachCourse" },
    due: { type: "week", week: 2 },
    evidence: evidence(["jpg", "jpeg", "png", "heic", "pdf"], 3),
    notes: "",
  },
  {
    axis: "6",
    title: "الممارسات التدريبية في الشعبة",
    kind: "training_practice",
    appliesTo: { type: "eachCourse" },
    due: { type: "week", week: 9 },
    evidence: evidence(["pdf", "jpg", "jpeg", "png", "heic", "docx"], 5),
    notes: "",
  },
];

// Mechanical's: its exam copies and the analysis of each exam. General Studies has none yet.
const MECHANICAL: Template[] = [ELECTRICAL[0], ELECTRICAL[1], ELECTRICAL[4]];

// Each department's templates, added by its head. Written once, while the department has none for
// the active term.
export async function seedDemoTemplates({ db }: { db: Db }, collegeId: string) {
  const term = await activeTerm(collegeId, db);
  if (!term) return;
  const departments = await listDepartments(collegeId, db);
  const heads = await holdersIn(
    collegeId,
    departments.map(({ id }) => id),
    "plan.edit",
    db,
  );
  const axes = new Map(
    (await listAxes(collegeId, db))
      .flatMap((group) => group.axes)
      .map((axis) => [axis.code, axis.id]),
  );
  const accepted = await getSetting("files.acceptedTypes", { collegeId }, db);
  for (const [name, templates] of [
    [demoDepartments[1].name, ELECTRICAL],
    [demoDepartments[2].name, MECHANICAL],
  ] as const) {
    const department = departments.find((each) => each.name === name);
    const head = department && heads.get(department.id)?.[0];
    if (!department || !head) {
      throw new Error(`seed:demo: ${name} or its head is missing`);
    }
    if (
      (await listTemplates(collegeId, term.id, department.id, db)).length > 0
    ) {
      continue;
    }
    const change = {
      collegeId,
      actorId: head.userId,
      ...(await deviceOf(db, collegeId, head.userId)),
    };
    for (const { axis, ...template } of templates) {
      const axisId = axes.get(axis);
      if (!axisId) throw new Error(`seed:demo: no axis ${axis}`);
      const added = await addTemplate(
        term.id,
        department.id,
        { ...template, axisId },
        change,
        accepted,
        db,
      );
      if (added.status !== "saved") {
        throw new Error(
          `seed:demo: «${template.title}» was not added (${added.status})`,
        );
      }
    }
  }
}

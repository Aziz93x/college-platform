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

// Electrical's own section templates for the demo term (Step 18): work the department asks of its
// trainers that the college's framework does not (Audit 6). A course's work reaches each of its
// trainers once for all their sections of it: the practical exam's copy, with the head's approval,
// and the quizzes. The workshop's safety checklist and samples of the lab reports reach each
// section's trainer, section by section (the owner's answers, 22 October 2026). Each names its axis
// by code.
const ELECTRICAL: Template[] = [
  {
    axis: "2",
    title: "نسخة الاختبار العملي ونموذج تقييمه",
    kind: "exam_copy",
    appliesTo: { type: "eachCourse" },
    due: { type: "week", week: 15 },
    evidence: evidence(["pdf", "docx"], 2, true),
    notes: "تُسلّم قبل أسبوع الاختبار العملي.",
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
    axis: "6",
    title: "قائمة التحقق من السلامة في الورشة",
    kind: "general",
    appliesTo: { type: "eachSection" },
    due: { type: "week", week: 1 },
    evidence: evidence(["pdf", "jpg", "jpeg", "png", "heic"], 2),
    notes: "يوقّعها متدربو الشعبة قبل أول تدريب عملي.",
  },
  {
    axis: "5",
    title: "عينات من تقارير التجارب العملية",
    kind: "homework",
    appliesTo: { type: "eachSection" },
    due: { type: "week", week: 12 },
    evidence: evidence(["pdf", "jpg", "jpeg", "png", "heic"], 3),
    notes: "عينة مرتفعة وعينة متوسطة وعينة منخفضة.",
  },
];

// Mechanical's: the practical exam's copy and the workshop's safety checklist. General Studies has
// none yet.
const MECHANICAL: Template[] = [ELECTRICAL[0], ELECTRICAL[2]];

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

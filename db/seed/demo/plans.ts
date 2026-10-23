import { eq } from "drizzle-orm";
import { holdersIn, listRoles } from "../../../src/modules/access/index.ts";
import { listAxes } from "../../../src/modules/axes/index.ts";
import type { PlanItemInput } from "../../../src/modules/framework/index.ts";
import { people } from "../../../src/modules/identity/index.ts";
import { listDepartments } from "../../../src/modules/org/index.ts";
import {
  addPlanItem,
  departmentPlan,
  movePlanItems,
  publishPlan,
  startPlanDraft,
} from "../../../src/modules/planning/index.ts";
import { getSetting } from "../../../src/modules/settings/index.ts";
import { activeTerm } from "../../../src/modules/terms/index.ts";
import type { Db } from "../../../src/platform/db/client.ts";
import { demoAccounts } from "./accounts.ts";
import { demoDepartments } from "./departments.ts";
import { deviceOf } from "./device.ts";

// An item as the demo writes it: its axis by code, and whom it reaches by the trainers of each
// section or course, a role's key, or a person's employee number.
type Item = Omit<PlanItemInput, "axisId" | "appliesTo"> & {
  axis: string;
  reach:
    | { type: "eachSection" | "eachCourse" }
    | { role: string }
    | { employeeNumber: string };
};

const evidence = (
  types: string[],
  maxFiles: number,
  requiresApproval = false,
) => ({ required: true, types, maxFiles, requiresApproval });

// Electrical's plan for the demo term (Step 19): work the department asks of its people that the
// college's framework does not (Audit 6). A course's work reaches each of its trainers once for all
// their sections of it: the practical exam's copy, with the head's approval, and the quizzes. The
// workshop's safety checklist and samples of the lab reports reach each section's trainer, section
// by section (the owner's answers, 22 October 2026). The secretary keeps the minutes of the
// department's monthly meeting, and one trainer takes stock of the machines lab before the term
// ends.
const PRACTICAL_EXAM: Item = {
  axis: "2",
  reach: { type: "eachCourse" },
  title: "نسخة الاختبار العملي ونموذج تقييمه",
  kind: "exam_copy",
  due: { type: "week", week: 15 },
  evidence: evidence(["pdf", "docx"], 2, true),
  notes: "تُسلّم قبل أسبوع الاختبار العملي.",
};
const SAFETY: Item = {
  axis: "6",
  reach: { type: "eachSection" },
  title: "قائمة التحقق من السلامة في الورشة",
  kind: "general",
  due: { type: "week", week: 1 },
  evidence: evidence(["pdf", "jpg", "jpeg", "png", "heic"], 2),
  notes: "يوقّعها متدربو الشعبة قبل أول تدريب عملي.",
};
const MINUTES: Item = {
  axis: "9",
  reach: { role: "secretary" },
  title: "محاضر اجتماعات القسم",
  kind: "meeting_minutes",
  due: { type: "everyWeeks", every: 4 },
  evidence: evidence(["pdf", "docx"], 1),
  notes: "",
};
const ELECTRICAL: Item[] = [
  PRACTICAL_EXAM,
  {
    axis: "2",
    reach: { type: "eachCourse" },
    title: "الاختبارات القصيرة",
    kind: "exam_copy",
    due: { type: "everyWeeks", every: 4 },
    evidence: evidence(["pdf", "jpg", "jpeg", "png", "heic"], 2),
    notes: "",
  },
  SAFETY,
  {
    axis: "5",
    reach: { type: "eachSection" },
    title: "عينات من تقارير التجارب العملية",
    kind: "homework",
    due: { type: "week", week: 12 },
    evidence: evidence(["pdf", "jpg", "jpeg", "png", "heic"], 3),
    notes: "عينة مرتفعة وعينة متوسطة وعينة منخفضة.",
  },
  MINUTES,
  {
    axis: "9",
    reach: { employeeNumber: demoAccounts.trainer.employeeNumber },
    title: "جرد عهدة معمل الآلات الكهربائية",
    kind: "general",
    due: { type: "week", week: 17 },
    evidence: evidence(["xlsx", "pdf"], 2, true),
    notes: "يُسلّم قبل نهاية الفصل بأسبوع.",
  },
];

// What Electrical's head has added to its next version so far: a peer visit for each trainer, and
// a review of each course's exam questions with its coordinator two weeks before each periodic.
const ELECTRICAL_NEXT: Item[] = [
  {
    axis: "4",
    reach: { role: "trainer" },
    title: "زيارة صفية متبادلة",
    kind: "professional_development",
    due: { type: "week", week: 7 },
    evidence: evidence(["pdf", "docx"], 1),
    notes: "",
  },
  {
    axis: "2",
    reach: { type: "eachCourse" },
    title: "مراجعة أسئلة الاختبار مع منسق المقرر",
    kind: "general",
    due: {
      type: "examPeriods",
      periodTypes: ["first-periodic", "second-periodic"],
      side: "before",
      weeks: 2,
    },
    evidence: evidence(["pdf", "docx"], 1),
    notes: "",
  },
];

// Mechanical's: the practical exam's copy, the workshop's safety checklist and the meeting's
// minutes. General Studies has no plan yet.
const MECHANICAL: Item[] = [PRACTICAL_EXAM, SAFETY, MINUTES];

// Each department's plan, entered and published by its head; Electrical's next version is a draft
// with its lab reports a week earlier and two items more. Written once, while the department has no
// plan for the active term.
export async function seedDemoPlans({ db }: { db: Db }, collegeId: string) {
  const term = await activeTerm(collegeId, db);
  if (!term) return;
  const departments = await listDepartments(collegeId, db);
  const heads = await holdersIn(
    collegeId,
    departments.map(({ id }) => id),
    "plan.publish",
    db,
  );
  const axes = new Map(
    (await listAxes(collegeId, db))
      .flatMap((group) => group.axes)
      .map((axis) => [axis.code, axis.id]),
  );
  const roles = new Map(
    (await listRoles(collegeId, db)).map((role) => [role.key, role.id]),
  );
  const accepted = await getSetting("files.acceptedTypes", { collegeId }, db);
  const input = async ({ axis, reach, ...item }: Item) => {
    const axisId = axes.get(axis);
    if (!axisId) throw new Error(`seed:demo: no axis ${axis}`);
    if ("type" in reach) return { ...item, axisId, appliesTo: reach };
    if ("role" in reach) {
      const roleId = roles.get(reach.role);
      if (!roleId) throw new Error(`seed:demo: no role ${reach.role}`);
      return { ...item, axisId, appliesTo: { type: "role" as const, roleId } };
    }
    const [person] = await db
      .select({ userId: people.userId })
      .from(people)
      .where(eq(people.employeeNumber, reach.employeeNumber));
    if (!person) throw new Error(`seed:demo: no ${reach.employeeNumber}`);
    return {
      ...item,
      axisId,
      appliesTo: { type: "person" as const, userId: person.userId },
    };
  };

  for (const [name, items, next] of [
    [demoDepartments[1].name, ELECTRICAL, ELECTRICAL_NEXT],
    [demoDepartments[2].name, MECHANICAL, []],
  ] as const) {
    const department = departments.find((each) => each.name === name);
    const head = department && heads.get(department.id)?.[0];
    if (!department || !head) {
      throw new Error(`seed:demo: ${name} or its head is missing`);
    }
    const plan = await departmentPlan(collegeId, term.id, department.id, db);
    if (plan.versions.length > 0) continue;
    const change = {
      collegeId,
      actorId: head.userId,
      ...(await deviceOf(db, collegeId, head.userId)),
    };
    const fill = async (planId: string, list: readonly Item[]) => {
      for (const item of list) {
        const added = await addPlanItem(
          planId,
          await input(item),
          change,
          accepted,
          db,
        );
        if (added.status !== "saved") {
          throw new Error(
            `seed:demo: «${item.title}» was not added (${added.status})`,
          );
        }
      }
    };
    const started = async () => {
      const draft = await startPlanDraft(
        term.id,
        department.id,
        change,
        undefined,
        db,
      );
      if (draft.status !== "created") {
        throw new Error(`seed:demo: no plan for ${name} (${draft.status})`);
      }
      return draft.id;
    };

    const first = await started();
    await fill(first, items);
    const published = await publishPlan(first, change, db);
    if (published.status !== "published") {
      throw new Error(
        `seed:demo: ${name}'s plan was not published (${published.status})`,
      );
    }
    if (next.length === 0) continue;
    const second = await started();
    const { draft } = await departmentPlan(
      collegeId,
      term.id,
      department.id,
      db,
    );
    const reports = draft?.items.find(
      ({ due }) => due.type === "week" && due.week === 12,
    );
    if (reports) {
      await movePlanItems([{ itemId: reports.id, week: 11 }], change, db);
    }
    await fill(second, next);
  }
}

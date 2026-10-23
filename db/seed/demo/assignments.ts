import { inArray } from "drizzle-orm";
import { holdersIn } from "../../../src/modules/access/index.ts";
import {
  addTemplateItem,
  assign,
  createTemplate,
  departmentTemplates,
  termAssignments,
} from "../../../src/modules/assignments/index.ts";
import { listAxes } from "../../../src/modules/axes/index.ts";
import type { AssignmentItemInput } from "../../../src/modules/framework/index.ts";
import { people } from "../../../src/modules/identity/index.ts";
import { listDepartments } from "../../../src/modules/org/index.ts";
import { getSetting } from "../../../src/modules/settings/index.ts";
import { activeTerm } from "../../../src/modules/terms/index.ts";
import type { Db } from "../../../src/platform/db/client.ts";
import { assignmentCatalog } from "../base.ts";
import { demoDepartments } from "./departments.ts";
import { deviceOf } from "./device.ts";
import { demoTrainers } from "./people.ts";

// Electrical's own template: its inventory officer, whose stock-taking needs the head's approval.
const INVENTORY = {
  title: "مسؤول العهد",
  items: [
    "جرد عهد القسم وتحديث سجلاتها.",
    "تسجيل العهد الجديدة وتسليمها للمدربين.",
    "استلام العهد من المدربين في نهاية الفصل.",
  ],
  evidence: {
    required: true,
    types: ["xlsx", "pdf"],
    maxFiles: 2,
    requiresApproval: true,
  },
};

// The demo term's assignments (Step 21), each given by its department's head, in the log:
// - each department's secretary, its first generated trainer, by the secretary's template, which
//   gives them the secretary's role there for the term (Step 10's note);
// - in Electrical, its safety supervisor for the whole term; its schedule coordinator for the
//   term's first four weeks, whose tasks fell due in week 4; and its own inventory officer, a
//   template its head added, for the term's last six weeks.
// None is a trainer the tests sign in as. Written once, while the term has no assignment.
export async function seedDemoAssignments(
  { db }: { db: Db },
  collegeId: string,
) {
  const term = await activeTerm(collegeId, db);
  if (!term) return;
  const departments = await listDepartments(collegeId, db);
  const heads = await holdersIn(
    collegeId,
    departments.map(({ id }) => id),
    "assignment.manage",
    db,
  );
  for (const department of departments) {
    if (
      (await termAssignments(collegeId, term.id, department.id, db)).length > 0
    ) {
      return;
    }
  }
  const accounts = new Map(
    (
      await db
        .select({ number: people.employeeNumber, userId: people.userId })
        .from(people)
        .where(inArray(people.employeeNumber, demoTrainers.flat()))
    ).map(({ number, userId }) => [number, userId]),
  );
  const byKey = (key: string) =>
    assignmentCatalog.find((each) => each.key === key)?.title;

  for (const [index, { name }] of demoDepartments.entries()) {
    const department = departments.find((each) => each.name === name);
    const head = department && heads.get(department.id)?.[0];
    if (!department || !head) {
      throw new Error(`seed:demo: ${name} or its head is missing`);
    }
    const change = {
      collegeId,
      actorId: head.userId,
      ...(await deviceOf(db, collegeId, head.userId)),
    };
    const templates = await departmentTemplates(collegeId, department.id, db);
    const templateOf = (title: string | undefined) => {
      const found = templates.find((each) => each.title === title);
      if (!found) throw new Error(`seed:demo: no template ${title}`);
      return found.id;
    };
    const give = async (
      templateId: string,
      position: number,
      weeks?: { from: number; to: number },
    ) => {
      const userId = accounts.get(demoTrainers[index][position]);
      if (!userId) throw new Error(`seed:demo: no trainer at ${position}`);
      const given = await assign(
        {
          templateId,
          termId: term.id,
          departmentId: department.id,
          userIds: [userId],
          weeks,
        },
        change,
        db,
      );
      if (given.status !== "assigned") {
        throw new Error(
          `seed:demo: an assignment was refused (${given.status})`,
        );
      }
    };

    await give(templateOf(byKey("secretary")), 0);
    if (index !== 1) continue;
    await give(templateOf(byKey("safety-supervisor")), 1);
    await give(templateOf(byKey("schedule-coordinator")), 2, {
      from: 1,
      to: 4,
    });

    const [axis] = (await listAxes(collegeId, db))
      .flatMap((group) => group.axes)
      .filter(({ code }) => code === "9");
    const accepted = await getSetting("files.acceptedTypes", { collegeId }, db);
    const own = await createTemplate(
      department.id,
      { title: INVENTORY.title, axisId: axis.id },
      change,
      db,
    );
    if (own.status !== "created") {
      throw new Error(`seed:demo: ${INVENTORY.title} (${own.status})`);
    }
    for (const title of INVENTORY.items) {
      const item: AssignmentItemInput = {
        title,
        kind: "general",
        evidence: INVENTORY.evidence,
      };
      await addTemplateItem(own.id, item, change, accepted, db);
    }
    await give(own.id, 3, { from: 13, to: 18 });
  }
}

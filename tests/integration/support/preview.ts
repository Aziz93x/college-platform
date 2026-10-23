import { sectionCounts } from "../../../src/modules/academics/index.ts";
import { roleHolders } from "../../../src/modules/access/index.ts";
import {
  countTasks,
  departmentsReached,
  termFramework,
} from "../../../src/modules/framework/index.ts";
import { departmentPlan } from "../../../src/modules/planning/index.ts";
import { findTerm } from "../../../src/modules/terms/index.ts";
import type { Db } from "../../../src/platform/db/client.ts";

// The tasks the framework's page previews for a term's published version, from the reads the page
// makes: what the generation engine is to make of it (Step 20).
export async function publishedPreview(
  collegeId: string,
  termId: string,
  db: Db,
) {
  const [term, framework, holders, sections] = await Promise.all([
    findTerm(collegeId, termId, db),
    termFramework(collegeId, termId, db),
    roleHolders(collegeId, db),
    sectionCounts(collegeId, termId, db),
  ]);
  if (!term || !framework.published) throw new Error("no published version");
  return countTasks(
    framework.published.items,
    departmentsReached(holders, sections),
    { weeks: term.weeks, periods: term.periods },
  ).tasks;
}

// The tasks a department's plan page previews for its published version, from the reads the page
// makes: what the generation engine is to make of it, in its department alone (Step 19).
export async function planPreview(
  collegeId: string,
  termId: string,
  departmentId: string,
  db: Db,
) {
  const [term, plan, holders, sections] = await Promise.all([
    findTerm(collegeId, termId, db),
    departmentPlan(collegeId, termId, departmentId, db),
    roleHolders(collegeId, db),
    sectionCounts(collegeId, termId, db),
  ]);
  if (!term || !plan.published) throw new Error("no published version");
  return countTasks(
    plan.published.items,
    departmentsReached(holders, sections).filter(
      (department) => department.departmentId === departmentId,
    ),
    { weeks: term.weeks, periods: term.periods },
  ).tasks;
}

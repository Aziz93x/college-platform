import { sectionCounts } from "../../../src/modules/academics/index.ts";
import { countMembers } from "../../../src/modules/access/index.ts";
import {
  countTasks,
  departmentsReached,
  termFramework,
} from "../../../src/modules/framework/index.ts";
import { findTerm } from "../../../src/modules/terms/index.ts";
import type { Db } from "../../../src/platform/db/client.ts";

// The tasks the framework's page previews for a term's published version, from the reads the page
// makes: what the generation engine is to make of it (Step 20).
export async function publishedPreview(
  collegeId: string,
  termId: string,
  db: Db,
) {
  const [term, framework, members, sections] = await Promise.all([
    findTerm(collegeId, termId, db),
    termFramework(collegeId, termId, db),
    countMembers(collegeId, db),
    sectionCounts(collegeId, termId, db),
  ]);
  if (!term || !framework.published) throw new Error("no published version");
  return countTasks(
    framework.published.items,
    departmentsReached(members, sections),
    { weeks: term.weeks, periods: term.periods },
  ).tasks;
}

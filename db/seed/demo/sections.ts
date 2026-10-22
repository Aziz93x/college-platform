import { eq } from "drizzle-orm";
import {
  listSections,
  sectionTransfers,
  transferCandidates,
  transferSection,
} from "../../../src/modules/academics/index.ts";
import { users } from "../../../src/modules/identity/index.ts";
import { listDepartments } from "../../../src/modules/org/index.ts";
import { activeTerm } from "../../../src/modules/terms/index.ts";
import type { Db } from "../../../src/platform/db/client.ts";
import { demoAccounts } from "./accounts.ts";
import { demoDepartments } from "./departments.ts";
import { deviceOf } from "./device.ts";

// The head of Electrical's transfer of a section of the demo term, from this week on (Step 17): its
// first section a trainer on the platform teaches goes to the first other trainer of the
// department. It holds until the next SS01. Written once, while the term has no transfer.
export async function seedDemoSections(
  { db }: { db: Db },
  collegeId: string,
  week: number,
) {
  const term = await activeTerm(collegeId, db);
  if (!term) throw new Error("seed:demo: the demo term is missing");
  const [made] = await db
    .select({ id: sectionTransfers.id })
    .from(sectionTransfers)
    .where(eq(sectionTransfers.termId, term.id))
    .limit(1);
  if (made) return;

  const electrical = (await listDepartments(collegeId, db)).find(
    ({ name }) => name === demoDepartments[1].name,
  );
  const [head] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, demoAccounts.head.email));
  if (!electrical || !head) {
    throw new Error("seed:demo: Electrical or its head is missing");
  }
  const [{ sections }, candidates] = await Promise.all([
    listSections(collegeId, term.id, [electrical.id], week, db),
    transferCandidates(collegeId, electrical.id, db),
  ]);
  const section = sections.find((each) => each.trainers[0]?.userId);
  const from = section?.trainers[0];
  const to = candidates.find(
    (person) =>
      !section?.trainers.some(
        (trainer) => trainer.number === person.employeeNumber,
      ),
  );
  if (!section || !from || !to) {
    throw new Error("seed:demo: no section of Electrical to transfer");
  }
  const result = await transferSection(
    {
      termId: term.id,
      sectionRef: section.ref,
      fromNumber: from.number,
      toUserId: to.userId,
      week,
      reason: "تكليف المدرب بمهام إدارية في القسم",
    },
    {
      collegeId,
      actorId: head.id,
      ...(await deviceOf(db, collegeId, head.id)),
    },
    db,
  );
  if (result.status !== "transferred") {
    throw new Error(`seed:demo: the transfer was refused (${result.status})`);
  }
}

import { eq } from "drizzle-orm";
import {
  listSections,
  sectionTransfers,
  tellTransferConflicts,
  transferCandidates,
  transferSection,
  transferStates,
} from "../../../src/modules/academics/index.ts";
import { users } from "../../../src/modules/identity/index.ts";
import { listDepartments } from "../../../src/modules/org/index.ts";
import { applyRayat, uploadRayat } from "../../../src/modules/rayat/index.ts";
import { activeTerm } from "../../../src/modules/terms/index.ts";
import type { Db } from "../../../src/platform/db/client.ts";
import { demoAccounts } from "./accounts.ts";
import { demoDepartments } from "./departments.ts";
import { deviceOf } from "./device.ts";

// The head of Electrical's transfers of sections of the demo term (Step 17), each from Electrical's
// sections a trainer on the platform teaches to another trainer of the department:
// - the second, from two weeks back, which the next SS01 still does not show: the vice-dean applies
//   it, it is in conflict with the transfer, and the head is told (ADR-0020);
// - the first, from this week, made after that SS01: it holds until the next.
// Written once, while the term has no transfer.
export async function seedDemoSections(
  { db }: { db: Db },
  collegeId: string,
  week: number,
  newerSs01: string[][] | undefined,
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
  const changeBy = async ({ email }: { email: string }) => {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email));
    if (!user) throw new Error(`seed:demo: ${email} is missing`);
    return {
      collegeId,
      actorId: user.id,
      ...(await deviceOf(db, collegeId, user.id)),
    };
  };
  if (!electrical) throw new Error("seed:demo: Electrical is missing");
  const head = await changeBy(demoAccounts.head);
  const [{ sections }, candidates] = await Promise.all([
    listSections(collegeId, term.id, [electrical.id], week, db),
    transferCandidates(collegeId, [electrical.id], db),
  ]);
  const taught = sections.filter((each) => each.trainers[0]?.userId);
  const transfer = async (
    at: number,
    choice: number,
    from: number,
    reason: string,
  ) => {
    const section = taught[at];
    const others = (candidates.get(electrical.id) ?? []).filter(
      (person) =>
        !section?.trainers.some(
          (trainer) => trainer.number === person.employeeNumber,
        ),
    );
    const to = others[choice % Math.max(others.length, 1)];
    const trainer = section?.trainers[0];
    if (!section || !trainer || !to) {
      throw new Error("seed:demo: no section of Electrical to transfer");
    }
    const result = await transferSection(
      {
        termId: term.id,
        sectionRef: section.ref,
        fromNumber: trainer.number,
        toUserId: to.userId,
        week: from,
        reason,
      },
      head,
      db,
    );
    if (result.status !== "transferred") {
      throw new Error(`seed:demo: the transfer was refused (${result.status})`);
    }
  };

  await transfer(1, 1, Math.max(week - 2, 1), "إسناد الشعبة لمدرب أقل نصابًا");
  if (newerSs01) {
    const viceDean = await changeBy(demoAccounts.viceDean);
    const before = await transferStates(collegeId, term.id, db);
    const uploaded = await uploadRayat(
      "ss01",
      term.id,
      newerSs01,
      viceDean,
      db,
    );
    if (uploaded.status !== "pending") {
      throw new Error(
        `seed:demo: the next SS01 was not imported (${uploaded.status})`,
      );
    }
    await applyRayat(uploaded.importId, viceDean, db);
    await tellTransferConflicts(collegeId, term.id, before, db);
  }
  await transfer(0, 0, week, "تكليف المدرب بمهام إدارية في القسم");
}

import { and, asc, eq, sql } from "drizzle-orm";
import { type Db, getDb, type Tx } from "../../../platform/db/client.ts";
import { lockCollege } from "../../../platform/db/college-lock.ts";
import { listDirectory } from "../../access/index.ts";
import { writeAudit } from "../../audit/index.ts";
import { people, users } from "../../identity/index.ts";
import { rayatVersion } from "../../rayat/index.ts";
import { terms } from "../../terms/index.ts";
import type { TransferInput } from "../domain/inputs.ts";
import {
  type TransferStatus,
  trainersInWeek,
  transferStatus,
} from "../domain/transfers.ts";
import { sectionTransfers } from "./schema.ts";

// Someone transferring a section, for the audit event.
type Change = {
  collegeId: string;
  actorId: string;
  ip?: string | null;
  userAgent?: string | null;
};

// A trainer by the employee number Rayat or a transfer names them with, and the person of the
// college with that number; none while they are not on the platform.
export type Trainer = { number: string; userId?: string; name?: string };

export type SectionTransfer = {
  id: string;
  from: Trainer;
  to: Trainer;
  week: number;
  reason: string;
  by: string | null;
  at: Date;
  status: TransferStatus;
};

// A section of the term as Rayat's SS01 in force has it (Step 17): its course, schedule and numbers,
// SF01's registrations in it by their status, its trainers in a week after the head's transfers,
// and those transfers.
export type Section = {
  ref: string;
  departmentId: string;
  course: { code: string; name: string; hours: number | null };
  deliveryMode: string;
  capacity: number;
  enrolled: number;
  meetings: { day: string; time: string; building: string; room: string }[];
  registrations: { status: string; count: number }[];
  trainers: Trainer[];
  transfers: SectionTransfer[];
};

// The people of the college by employee number.
async function peopleByNumber(collegeId: string, db: Db | Tx) {
  const rows = await db
    .select({
      number: people.employeeNumber,
      userId: people.userId,
      name: users.name,
    })
    .from(people)
    .innerJoin(users, eq(users.id, people.userId))
    .where(eq(people.collegeId, collegeId));
  return new Map(rows.map(({ number, ...person }) => [number, person]));
}

// A term's transfers, or a section's, in the order they were made, with the new trainer's employee
// number and who made each.
async function transfersOf(
  db: Db | Tx,
  collegeId: string,
  termId: string,
  sectionRef?: string,
) {
  return db
    .select({
      id: sectionTransfers.id,
      departmentId: sectionTransfers.departmentId,
      sectionRef: sectionTransfers.sectionRef,
      fromNumber: sectionTransfers.fromNumber,
      toNumber: people.employeeNumber,
      week: sectionTransfers.week,
      reason: sectionTransfers.reason,
      by: sql<
        string | null
      >`(select ${users.name} from ${users} where ${users.id} = ${sectionTransfers.createdBy})`,
      createdAt: sectionTransfers.createdAt,
      keptAt: sectionTransfers.keptAt,
    })
    .from(sectionTransfers)
    .innerJoin(people, eq(people.userId, sectionTransfers.toUserId))
    .where(
      and(
        eq(sectionTransfers.collegeId, collegeId),
        eq(sectionTransfers.termId, termId),
        sectionRef === undefined
          ? undefined
          : eq(sectionTransfers.sectionRef, sectionRef),
      ),
    )
    .orderBy(asc(sectionTransfers.createdAt), asc(sectionTransfers.id));
}

// The term's sections in these departments, or in all of them, by course code and reference, with
// their trainers in this week of the term; and the transfers of sections SS01 in force no longer
// has, for the head to see and cancel.
export async function listSections(
  collegeId: string,
  termId: string,
  departments: "college" | readonly string[],
  week: number,
  db: Db = getDb(),
): Promise<{
  sections: Section[];
  gone: (SectionTransfer & { sectionRef: string })[];
}> {
  const [ss01, sf01, transfers, byNumber] = await Promise.all([
    rayatVersion(collegeId, termId, "ss01", db),
    rayatVersion(collegeId, termId, "sf01", db),
    transfersOf(db, collegeId, termId),
    peopleByNumber(collegeId, db),
  ]);
  const inScope = (departmentId: string) =>
    departments === "college" || departments.includes(departmentId);
  const trainer = (number: string): Trainer => ({
    number,
    ...byNumber.get(number),
  });
  const view = (
    transfer: (typeof transfers)[number],
    trainers: readonly string[] | undefined,
  ): SectionTransfer => ({
    id: transfer.id,
    from: trainer(transfer.fromNumber),
    to: trainer(transfer.toNumber),
    week: transfer.week,
    reason: transfer.reason,
    by: transfer.by,
    at: transfer.createdAt,
    status: transferStatus(
      { ...transfer, since: transfer.keptAt ?? transfer.createdAt },
      ss01 && { appliedAt: ss01.appliedAt, trainers },
    ),
  });

  const registrations = new Map<string, Map<string, number>>();
  for (const { sectionRef, registrationStatus } of sf01?.records ?? []) {
    const counts = registrations.get(sectionRef) ?? new Map<string, number>();
    counts.set(registrationStatus, (counts.get(registrationStatus) ?? 0) + 1);
    registrations.set(sectionRef, counts);
  }
  const records = ss01?.records ?? [];
  const sections = records
    .filter((section) => inScope(section.departmentId))
    .sort(
      (a, b) =>
        a.courseCode.localeCompare(b.courseCode) ||
        a.sectionRef.localeCompare(b.sectionRef),
    )
    .map((section) => {
      const own = transfers.filter(
        (transfer) => transfer.sectionRef === section.sectionRef,
      );
      return {
        ref: section.sectionRef,
        departmentId: section.departmentId,
        course: {
          code: section.courseCode,
          name: section.courseName,
          hours: section.creditHours,
        },
        deliveryMode: section.deliveryMode,
        capacity: section.capacity,
        enrolled: section.enrolled,
        meetings: section.meetings,
        registrations: [
          ...(registrations.get(section.sectionRef) ?? new Map()),
        ].map(([status, count]) => ({ status, count })),
        trainers: trainersInWeek(section.trainerNumbers, own, week).map(
          trainer,
        ),
        transfers: own.map((transfer) =>
          view(transfer, section.trainerNumbers),
        ),
      };
    });
  const refs = new Set(records.map((section) => section.sectionRef));
  const gone = transfers
    .filter(
      (transfer) =>
        !refs.has(transfer.sectionRef) && inScope(transfer.departmentId),
    )
    .map((transfer) => ({
      ...view(transfer, undefined),
      sectionRef: transfer.sectionRef,
    }));
  return { sections, gone };
}

// The trainers SS01 in force names who are not on the platform: each employee number no person of
// the college has, with the sections it teaches (Step 17).
export async function unmatchedTrainers(
  collegeId: string,
  termId: string,
  db: Db = getDb(),
) {
  const [ss01, byNumber] = await Promise.all([
    rayatVersion(collegeId, termId, "ss01", db),
    peopleByNumber(collegeId, db),
  ]);
  const missing = new Map<string, string[]>();
  for (const section of ss01?.records ?? []) {
    for (const number of section.trainerNumbers) {
      if (byNumber.has(number)) continue;
      missing.set(number, [...(missing.get(number) ?? []), section.sectionRef]);
    }
  }
  return [...missing]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([number, sections]) => ({ number, sections: sections.sort() }));
}

// How many sections each department has in SS01 in force: what a framework's or a plan's items for
// each section's trainer reach (Step 15).
export async function sectionCounts(
  collegeId: string,
  termId: string,
  db: Db = getDb(),
) {
  const counts: Record<string, number> = {};
  for (const { departmentId } of (
    await rayatVersion(collegeId, termId, "ss01", db)
  )?.records ?? []) {
    counts[departmentId] = (counts[departmentId] ?? 0) + 1;
  }
  return counts;
}

// A section of the term in SS01 in force, with its department, where transferring it is checked.
export async function findSection(
  collegeId: string,
  termId: string,
  sectionRef: string,
  db: Db = getDb(),
) {
  return (await rayatVersion(collegeId, termId, "ss01", db))?.records.find(
    (section) => section.sectionRef === sectionRef,
  );
}

// Whom a section of a department can be transferred to: the enabled people who hold a role in the
// department and complete tasks, as its trainers do.
export async function transferCandidates(
  collegeId: string,
  departmentId: string,
  db: Db = getDb(),
) {
  return (await listDirectory(collegeId, { departments: [departmentId] }, db))
    .filter(
      (person) =>
        person.state !== "disabled" && person.permissions.has("task.complete"),
    )
    .map(({ userId, name, employeeNumber }) => ({
      userId,
      name,
      employeeNumber,
    }));
}

// Transfers a section of the term from one of its trainers in that week to another, from the week
// on (docs/PLAN.md, section 3), and records sectionTransfer.create. Refused: a section SS01 in force
// does not have, a closed term or a week past its last, someone not teaching the section that week,
// someone it cannot go to, and someone teaching it already.
export async function transferSection(
  input: TransferInput,
  change: Change,
  db: Db = getDb(),
): Promise<
  | { status: "transferred"; id: string }
  | {
      status:
        | "notFound"
        | "termClosed"
        | "week"
        | "notTrainer"
        | "notCandidate"
        | "alreadyTrainer";
    }
> {
  const { collegeId } = change;
  const section = await findSection(
    collegeId,
    input.termId,
    input.sectionRef,
    db,
  );
  if (!section) return { status: "notFound" };
  // Read before the transaction: the directory reads outside one.
  const candidate = (
    await transferCandidates(collegeId, section.departmentId, db)
  ).find((person) => person.userId === input.toUserId);
  return db.transaction(async (tx) => {
    await lockCollege(tx, collegeId);
    const [term] = await tx
      .select({ status: terms.status, weeks: terms.weeks })
      .from(terms)
      .where(and(eq(terms.collegeId, collegeId), eq(terms.id, input.termId)));
    if (!term) return { status: "notFound" };
    if (term.status === "closed") return { status: "termClosed" };
    if (input.week > term.weeks) return { status: "week" };
    const trainers = trainersInWeek(
      section.trainerNumbers,
      await transfersOf(tx, collegeId, input.termId, input.sectionRef),
      input.week,
    );
    if (!trainers.includes(input.fromNumber)) return { status: "notTrainer" };
    if (!candidate) return { status: "notCandidate" };
    if (trainers.includes(candidate.employeeNumber)) {
      return { status: "alreadyTrainer" };
    }
    const [{ id }] = await tx
      .insert(sectionTransfers)
      .values({
        collegeId,
        termId: input.termId,
        departmentId: section.departmentId,
        sectionRef: input.sectionRef,
        fromNumber: input.fromNumber,
        toUserId: candidate.userId,
        week: input.week,
        reason: input.reason,
        createdBy: change.actorId,
      })
      .returning({ id: sectionTransfers.id });
    await writeAudit(
      {
        collegeId,
        actorId: change.actorId,
        action: "sectionTransfer.create",
        entityType: "sectionTransfer",
        entityId: id,
        diff: {
          to: {
            termId: input.termId,
            sectionRef: input.sectionRef,
            fromNumber: input.fromNumber,
            userId: candidate.userId,
            week: input.week,
            reason: input.reason,
          },
        },
        ip: change.ip,
        userAgent: change.userAgent,
      },
      tx,
    );
    return { status: "transferred", id };
  });
}

// A transfer of the college's, with the department where keeping or cancelling it is checked.
export async function findTransfer(
  collegeId: string,
  id: string,
  db: Db = getDb(),
) {
  const [found] = await db
    .select({
      id: sectionTransfers.id,
      departmentId: sectionTransfers.departmentId,
    })
    .from(sectionTransfers)
    .where(
      and(
        eq(sectionTransfers.collegeId, collegeId),
        eq(sectionTransfers.id, id),
      ),
    );
  return found;
}

// A transfer of the college's in a term that is not closed, locked for its change.
async function openTransfer(tx: Tx, collegeId: string, id: string) {
  await lockCollege(tx, collegeId);
  const [found] = await tx
    .select({
      termId: sectionTransfers.termId,
      sectionRef: sectionTransfers.sectionRef,
      fromNumber: sectionTransfers.fromNumber,
      userId: sectionTransfers.toUserId,
      week: sectionTransfers.week,
      reason: sectionTransfers.reason,
      termStatus: terms.status,
    })
    .from(sectionTransfers)
    .innerJoin(terms, eq(terms.id, sectionTransfers.termId))
    .where(
      and(
        eq(sectionTransfers.collegeId, collegeId),
        eq(sectionTransfers.id, id),
      ),
    );
  return found;
}

// Keeps a transfer that a newer SS01 is in conflict with: it holds again until the next one
// (sectionTransfer.keep).
export async function keepTransfer(
  id: string,
  change: Change,
  db: Db = getDb(),
): Promise<{ status: "kept" | "notFound" | "termClosed" }> {
  return db.transaction(async (tx) => {
    const found = await openTransfer(tx, change.collegeId, id);
    if (!found) return { status: "notFound" };
    if (found.termStatus === "closed") return { status: "termClosed" };
    await tx
      .update(sectionTransfers)
      .set({ keptAt: sql`now()` })
      .where(eq(sectionTransfers.id, id));
    await writeAudit(
      {
        collegeId: change.collegeId,
        actorId: change.actorId,
        action: "sectionTransfer.keep",
        entityType: "sectionTransfer",
        entityId: id,
        diff: { termId: found.termId, sectionRef: found.sectionRef },
        ip: change.ip,
        userAgent: change.userAgent,
      },
      tx,
    );
    return { status: "kept" };
  });
}

// Cancels a transfer: the section's trainers are again Rayat's and its other transfers'
// (sectionTransfer.cancel, with what the transfer was).
export async function cancelTransfer(
  id: string,
  change: Change,
  db: Db = getDb(),
): Promise<{ status: "cancelled" | "notFound" | "termClosed" }> {
  return db.transaction(async (tx) => {
    const found = await openTransfer(tx, change.collegeId, id);
    if (!found) return { status: "notFound" };
    const { termStatus, ...was } = found;
    if (termStatus === "closed") return { status: "termClosed" };
    await tx.delete(sectionTransfers).where(eq(sectionTransfers.id, id));
    await writeAudit(
      {
        collegeId: change.collegeId,
        actorId: change.actorId,
        action: "sectionTransfer.cancel",
        entityType: "sectionTransfer",
        entityId: id,
        diff: { from: was },
        ip: change.ip,
        userAgent: change.userAgent,
      },
      tx,
    );
    return { status: "cancelled" };
  });
}

import { and, asc, eq, sql } from "drizzle-orm";
import { type Db, getDb, type Tx } from "../../../platform/db/client.ts";
import { lockCollege } from "../../../platform/db/college-lock.ts";
import { holdersIn } from "../../access/index.ts";
import { writeAudit } from "../../audit/index.ts";
import { people, users } from "../../identity/index.ts";
import { notify } from "../../notifications/index.ts";
import { listDepartments } from "../../org/index.ts";
import { pendingRayat, rayatVersion } from "../../rayat/index.ts";
import { terms } from "../../terms/index.ts";
import type { TransferInput } from "../domain/inputs.ts";
import { readTransfers, type TransferStatus } from "../domain/transfers.ts";
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
// number, who made each, and when it was made or last kept.
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
      since:
        sql<Date>`coalesce(${sectionTransfers.keptAt}, ${sectionTransfers.createdAt})`.mapWith(
          sectionTransfers.createdAt,
        ),
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

// Each transfer of the term read against a version of SS01: the section's trainers in its records,
// from a file uploaded then (readTransfers()). A section the version does not have reads as having
// no trainer, so its transfers change nothing.
function readAll<
  T extends {
    sectionRef: string;
    fromNumber: string;
    toNumber: string;
    week: number;
    since: Date;
  },
>(
  transfers: readonly T[],
  ss01: {
    uploadedAt: Date;
    records: readonly { sectionRef: string; trainerNumbers: string[] }[];
  },
) {
  const trainers = new Map(
    ss01.records.map((section) => [section.sectionRef, section.trainerNumbers]),
  );
  const bySection = new Map<string, T[]>();
  for (const transfer of transfers) {
    bySection.set(transfer.sectionRef, [
      ...(bySection.get(transfer.sectionRef) ?? []),
      transfer,
    ]);
  }
  const statuses = new Map<T, TransferStatus>();
  const reads = new Map<string, ReturnType<typeof readTransfers>>();
  for (const [ref, own] of bySection) {
    const read = readTransfers(trainers.get(ref) ?? [], ss01.uploadedAt, own);
    reads.set(ref, read);
    own.forEach((transfer, index) => {
      statuses.set(transfer, read.statuses[index]);
    });
  }
  return { statuses, reads };
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
  gone: (SectionTransfer & { sectionRef: string; departmentId: string })[];
}> {
  const [ss01, sf01, transfers, byNumber] = await Promise.all([
    rayatVersion(collegeId, termId, "ss01", db),
    rayatVersion(collegeId, termId, "sf01", db),
    transfersOf(db, collegeId, termId),
    peopleByNumber(collegeId, db),
  ]);
  if (!ss01) return { sections: [], gone: [] };
  const inScope = (departmentId: string) =>
    departments === "college" || departments.includes(departmentId);
  const trainer = (number: string): Trainer => ({
    number,
    ...byNumber.get(number),
  });
  const { statuses, reads } = readAll(transfers, ss01);
  const view = (transfer: (typeof transfers)[number]): SectionTransfer => ({
    id: transfer.id,
    from: trainer(transfer.fromNumber),
    to: trainer(transfer.toNumber),
    week: transfer.week,
    reason: transfer.reason,
    by: transfer.by,
    at: transfer.createdAt,
    status: statuses.get(transfer) ?? "otherTrainer",
  });

  const registrations = new Map<string, Map<string, number>>();
  for (const { sectionRef, registrationStatus } of sf01?.records ?? []) {
    const counts = registrations.get(sectionRef) ?? new Map<string, number>();
    counts.set(registrationStatus, (counts.get(registrationStatus) ?? 0) + 1);
    registrations.set(sectionRef, counts);
  }
  const sections = ss01.records
    .filter((section) => inScope(section.departmentId))
    .sort(
      (a, b) =>
        a.courseCode.localeCompare(b.courseCode) ||
        a.sectionRef.localeCompare(b.sectionRef),
    )
    .map((section) => ({
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
      trainers: (
        reads.get(section.sectionRef)?.trainersInWeek(week) ??
        section.trainerNumbers
      ).map(trainer),
      transfers: transfers
        .filter((transfer) => transfer.sectionRef === section.sectionRef)
        .map(view),
    }));
  const refs = new Set(ss01.records.map((section) => section.sectionRef));
  const gone = transfers
    .filter(
      (transfer) =>
        !refs.has(transfer.sectionRef) && inScope(transfer.departmentId),
    )
    .map((transfer) => ({
      ...view(transfer),
      sectionRef: transfer.sectionRef,
      departmentId: transfer.departmentId,
    }));
  return { sections, gone };
}

// Each transfer of the term whose state applying the SS01 waiting to be applied would change
// (ADR-0020): its section and trainers, its state before and the one it would take after.
export async function pendingTransferChanges(
  collegeId: string,
  termId: string,
  db: Db = getDb(),
) {
  const [ss01, pending, transfers, byNumber] = await Promise.all([
    rayatVersion(collegeId, termId, "ss01", db),
    pendingRayat(collegeId, termId, "ss01", db),
    transfersOf(db, collegeId, termId),
    peopleByNumber(collegeId, db),
  ]);
  if (!pending || transfers.length === 0) return [];
  const now = ss01 && readAll(transfers, ss01).statuses;
  const then = readAll(transfers, pending).statuses;
  const trainer = (number: string): Trainer => ({
    number,
    ...byNumber.get(number),
  });
  return transfers
    .map((transfer) => ({
      id: transfer.id,
      sectionRef: transfer.sectionRef,
      from: trainer(transfer.fromNumber),
      to: trainer(transfer.toNumber),
      week: transfer.week,
      before: now?.get(transfer) ?? ("holds" as TransferStatus),
      after: then.get(transfer) ?? ("otherTrainer" as TransferStatus),
    }))
    .filter((change) => change.before !== change.after);
}

// The state of each transfer of the term against SS01 in force, by its id: what a new version of
// SS01 is compared with (ADR-0020).
export async function transferStates(
  collegeId: string,
  termId: string,
  db: Db = getDb(),
) {
  const [ss01, transfers] = await Promise.all([
    rayatVersion(collegeId, termId, "ss01", db),
    transfersOf(db, collegeId, termId),
  ]);
  const statuses = ss01 && readAll(transfers, ss01).statuses;
  return new Map(
    transfers.map((transfer) => [
      transfer.id,
      statuses?.get(transfer) ?? ("holds" as TransferStatus),
    ]),
  );
}

// Tells the holders of sections.transfer in a department of each transfer of the term that the
// version of SS01 now in force puts in conflict, or leaves replacing a trainer who no longer teaches
// the section, where it was not before (ADR-0020). Called after SS01 is applied or rolled back.
export async function tellTransferConflicts(
  collegeId: string,
  termId: string,
  before: ReadonlyMap<string, TransferStatus>,
  db: Db = getDb(),
) {
  const [after, transfers, departments] = await Promise.all([
    transferStates(collegeId, termId, db),
    transfersOf(db, collegeId, termId),
    listDepartments(collegeId, db),
  ]);
  const broken = transfers.flatMap((transfer) => {
    const status = after.get(transfer.id);
    return (status === "conflict" || status === "otherTrainer") &&
      before.get(transfer.id) !== status
      ? [{ ...transfer, status }]
      : [];
  });
  if (broken.length === 0) return 0;
  const heads = await holdersIn(
    collegeId,
    [...new Set(broken.map((transfer) => transfer.departmentId))],
    "sections.transfer",
    db,
  );
  let told = 0;
  for (const transfer of broken) {
    const department =
      departments.find(({ id }) => id === transfer.departmentId)?.name ?? "";
    for (const head of heads.get(transfer.departmentId) ?? []) {
      const sent = await notify(
        {
          collegeId,
          userId: head.userId,
          kind: "transferConflict",
          params: {
            sectionRef: transfer.sectionRef,
            department,
            status: transfer.status,
          },
        },
        db,
      );
      if (sent === "sent") told += 1;
    }
  }
  return told;
}

// The trainers SS01 in force names who are not on the platform: each employee number no person of
// the college has, with the sections it teaches and the department of the first (Step 17).
export async function unmatchedTrainers(
  collegeId: string,
  termId: string,
  db: Db = getDb(),
) {
  const [ss01, byNumber] = await Promise.all([
    rayatVersion(collegeId, termId, "ss01", db),
    peopleByNumber(collegeId, db),
  ]);
  const missing = new Map<string, { ref: string; departmentId: string }[]>();
  for (const section of ss01?.records ?? []) {
    for (const number of section.trainerNumbers) {
      if (byNumber.has(number)) continue;
      missing.set(number, [
        ...(missing.get(number) ?? []),
        { ref: section.sectionRef, departmentId: section.departmentId },
      ]);
    }
  }
  return [...missing]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([number, taught]) => {
      const sections = taught.sort((a, b) => a.ref.localeCompare(b.ref));
      return {
        number,
        sections: sections.map(({ ref }) => ref),
        departmentId: sections[0].departmentId,
      };
    });
}

// Each section of the term in SS01 in force, with its department and its places in a week after the
// head's transfers (readTransfers()): what the generation engine makes the tasks for each section's
// trainer for, one for each place (Step 20).
export async function sectionPlaces(
  collegeId: string,
  termId: string,
  db: Db | Tx = getDb(),
) {
  const [ss01, transfers] = await Promise.all([
    rayatVersion(collegeId, termId, "ss01", db),
    transfersOf(db, collegeId, termId),
  ]);
  if (!ss01) return [];
  const { reads } = readAll(transfers, ss01);
  return ss01.records.map((section) => ({
    ref: section.sectionRef,
    departmentId: section.departmentId,
    places: (
      reads.get(section.sectionRef) ??
      readTransfers(section.trainerNumbers, ss01.uploadedAt, [])
    ).places,
  }));
}

// What each department's sections in SS01 in force give a framework's or a plan's items for each
// section's trainer (Step 15): a task for each trainer of each section, and none for a section with
// no trainer yet, which the preview names apart (the owner's rule, lead review C).
export async function sectionCounts(
  collegeId: string,
  termId: string,
  db: Db = getDb(),
) {
  const counts: Record<string, { trainers: number; untaught: number }> = {};
  for (const { departmentId, trainerNumbers } of (
    await rayatVersion(collegeId, termId, "ss01", db)
  )?.records ?? []) {
    counts[departmentId] ??= { trainers: 0, untaught: 0 };
    const count = counts[departmentId];
    const trainers = new Set(trainerNumbers).size;
    count.trainers += trainers;
    if (trainers === 0) count.untaught += 1;
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

// Whom a section of each of these departments can be transferred to: the enabled people who complete
// tasks through a role in force in the department, as its trainers do. One read for them all.
export async function transferCandidates(
  collegeId: string,
  departmentIds: readonly string[],
  db: Db | Tx = getDb(),
) {
  return holdersIn(collegeId, departmentIds, "task.complete", db);
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
  return db.transaction(async (tx) => {
    await lockCollege(tx, collegeId);
    const [[term], ss01] = await Promise.all([
      tx
        .select({ status: terms.status, weeks: terms.weeks })
        .from(terms)
        .where(and(eq(terms.collegeId, collegeId), eq(terms.id, input.termId))),
      rayatVersion(collegeId, input.termId, "ss01", tx),
    ]);
    const section = ss01?.records.find(
      (record) => record.sectionRef === input.sectionRef,
    );
    if (!term || !ss01 || !section) return { status: "notFound" };
    if (term.status === "closed") return { status: "termClosed" };
    if (input.week > term.weeks) return { status: "week" };
    const candidate = (
      await transferCandidates(collegeId, [section.departmentId], tx)
    )
      .get(section.departmentId)
      ?.find((person) => person.userId === input.toUserId);
    const trainers = readTransfers(
      section.trainerNumbers,
      ss01.uploadedAt,
      await transfersOf(tx, collegeId, input.termId, input.sectionRef),
    ).trainersInWeek(input.week);
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
// (sectionTransfer.keep). Only while it is in conflict, Rayat still naming the trainer it replaced:
// one that changes nothing is cancelled, or the section transferred again (lead review C).
export async function keepTransfer(
  id: string,
  change: Change,
  db: Db = getDb(),
): Promise<{ status: "kept" | "notFound" | "termClosed" | "notConflict" }> {
  return db.transaction(async (tx) => {
    const found = await openTransfer(tx, change.collegeId, id);
    if (!found) return { status: "notFound" };
    if (found.termStatus === "closed") return { status: "termClosed" };
    const [ss01, own] = await Promise.all([
      rayatVersion(change.collegeId, found.termId, "ss01", tx),
      transfersOf(tx, change.collegeId, found.termId, found.sectionRef),
    ]);
    const section = ss01?.records.find(
      (record) => record.sectionRef === found.sectionRef,
    );
    const read =
      ss01 &&
      readTransfers(section?.trainerNumbers ?? [], ss01.uploadedAt, own);
    const status = read?.statuses[own.findIndex((each) => each.id === id)];
    if (status !== "conflict") return { status: "notConflict" };
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
): Promise<
  | { status: "notFound" | "termClosed" }
  | { status: "cancelled"; termId: string }
> {
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
    return { status: "cancelled", termId: was.termId };
  });
}

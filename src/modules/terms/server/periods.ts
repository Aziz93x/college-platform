import { and, asc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { type Db, getDb, type Tx } from "../../../platform/db/client.ts";
import { lockCollege } from "../../../platform/db/college-lock.ts";
import { writeAudit } from "../../audit/index.ts";
import { type ExamPeriod, periodProblems } from "../domain/periods.ts";
import { examPeriods, examPeriodTypes, terms } from "./schema.ts";

// Who changes a term's exam periods, for the audit event. The caller has authorized them.
type Change = {
  collegeId: string;
  actorId: string;
  ip?: string | null;
  userAgent?: string | null;
};

// An exam-period type of the college's catalog (the owner's notes, 21 October 2026).
export type ExamPeriodType = { code: string; name: string; shortName: string };

// The college's exam-period types in order.
export function listExamPeriodTypes(collegeId: string, db: Db | Tx = getDb()) {
  return db
    .select({
      code: examPeriodTypes.code,
      name: examPeriodTypes.name,
      shortName: examPeriodTypes.shortName,
    })
    .from(examPeriodTypes)
    .where(eq(examPeriodTypes.collegeId, collegeId))
    .orderBy(asc(examPeriodTypes.position), asc(examPeriodTypes.code));
}

// The exam-period types the base seed gives a college, each where it has none with that code yet:
// one already there stays as it is.
export async function seedExamPeriodTypes(
  collegeId: string,
  catalog: readonly ExamPeriodType[],
  db: Db = getDb(),
) {
  await db
    .insert(examPeriodTypes)
    .values(catalog.map((type, position) => ({ collegeId, ...type, position })))
    .onConflictDoNothing();
}

// These terms' exam periods, each with its term, in the order of their weeks.
export function periodsOf(
  termIds: readonly string[],
  db: Db | Tx = getDb(),
): Promise<(ExamPeriod & { termId: string })[]> {
  return db
    .select({
      termId: examPeriods.termId,
      type: examPeriods.type,
      from: examPeriods.fromWeek,
      to: examPeriods.toWeek,
    })
    .from(examPeriods)
    .where(inArray(examPeriods.termId, [...termIds]))
    .orderBy(asc(examPeriods.fromWeek), asc(examPeriods.type));
}

// The names of the types of these periods, each once, in their order: what a refusal names.
export async function periodNames(
  collegeId: string,
  periods: readonly ExamPeriod[],
  db: Db | Tx,
) {
  const names = new Map(
    (await listExamPeriodTypes(collegeId, db)).map(({ code, name }) => [
      code,
      name,
    ]),
  );
  return [...new Set(periods.map(({ type }) => names.get(type) ?? type))];
}

// A period's weeks, each by its number: how the audit log shows it.
const weeksOf = ({ from, to }: ExamPeriod) =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index);

// Sets a draft or active term's exam periods to these, of the college's types, and records
// examPeriods.update with each period that changed, by its type's name, its weeks before and after.
// A period past the term's last week, or two that share a week, is refused, naming them.
export async function saveExamPeriods(
  termId: string,
  periods: readonly ExamPeriod[],
  change: Change,
  db: Db = getDb(),
): Promise<
  | { status: "notFound" | "closed" | "unknownType" }
  | { status: "pastEnd" | "overlap"; periods: string[] }
  | { status: "saved" | "unchanged" }
> {
  return db.transaction(async (tx) => {
    await lockCollege(tx, change.collegeId);
    const [term] = await tx
      .select({ weeks: terms.weeks, status: terms.status })
      .from(terms)
      .where(and(eq(terms.collegeId, change.collegeId), eq(terms.id, termId)));
    if (!term) return { status: "notFound" };
    if (term.status === "closed") return { status: "closed" };
    const types = await listExamPeriodTypes(change.collegeId, tx);
    if (!periods.every(({ type }) => types.some(({ code }) => code === type))) {
      return { status: "unknownType" };
    }
    const { pastEnd, overlaps } = periodProblems(periods, term.weeks);
    if (pastEnd.length > 0) {
      return {
        status: "pastEnd",
        periods: await periodNames(change.collegeId, pastEnd, tx),
      };
    }
    if (overlaps.length > 0) {
      return {
        status: "overlap",
        periods: await periodNames(change.collegeId, overlaps[0], tx),
      };
    }

    const current = await periodsOf([termId], tx);
    const from: Record<string, number[]> = {};
    const to: Record<string, number[]> = {};
    for (const { code, name } of types) {
      const was = current.find(({ type }) => type === code);
      const now = periods.find(({ type }) => type === code);
      if (was?.from === now?.from && was?.to === now?.to) continue;
      if (was) from[name] = weeksOf(was);
      if (now) to[name] = weeksOf(now);
    }
    if (Object.keys(from).length + Object.keys(to).length === 0) {
      return { status: "unchanged" };
    }
    await tx.delete(examPeriods).where(
      periods.length > 0
        ? and(
            eq(examPeriods.termId, termId),
            notInArray(
              examPeriods.type,
              periods.map(({ type }) => type),
            ),
          )
        : eq(examPeriods.termId, termId),
    );
    if (periods.length > 0) {
      await tx
        .insert(examPeriods)
        .values(
          periods.map(({ type, from, to }) => ({
            collegeId: change.collegeId,
            termId,
            type,
            fromWeek: from,
            toWeek: to,
          })),
        )
        .onConflictDoUpdate({
          target: [examPeriods.termId, examPeriods.type],
          set: {
            fromWeek: sql`excluded.from_week`,
            toWeek: sql`excluded.to_week`,
            updatedAt: sql`now()`,
          },
        });
    }
    await writeAudit(
      {
        collegeId: change.collegeId,
        actorId: change.actorId,
        action: "examPeriods.update",
        entityType: "term",
        entityId: termId,
        diff: { from, to },
        ip: change.ip,
        userAgent: change.userAgent,
      },
      tx,
    );
    return { status: "saved" };
  });
}

import { and, asc, eq, gte, sql } from "drizzle-orm";
import { type Db, getDb, type Tx } from "../../../platform/db/client.ts";
import { writeAudit } from "../../audit/index.ts";
import { getSetting, weekdays } from "../../settings/index.ts";
import { type BreakRule, estimateBreak, weekend } from "../domain/holidays.ts";
import type { Day } from "../domain/weeks.ts";
import { holidays } from "./schema.ts";

export type Holiday = {
  id: string;
  key: string;
  name: string;
  hijriYear: number;
  startsOn: Day;
  endsOn: Day;
  adjusted: boolean;
};

const columns = {
  id: holidays.id,
  key: holidays.key,
  name: holidays.name,
  hijriYear: holidays.hijriYear,
  startsOn: holidays.startsOn,
  endsOn: holidays.endsOn,
  adjusted: holidays.adjusted,
};

// The breaks the base seed gives a college (ADR-0018): each rule's break in each of these Umm
// al-Qura years, estimated around its Eid with the college's weekend, where the college has none
// for that rule and year yet. A break already there, estimated or adjusted, stays as it is. Returns
// how many it added.
export async function estimateHolidays(
  collegeId: string,
  rules: readonly (BreakRule & { key: string; name: string })[],
  years: readonly number[],
  db: Db = getDb(),
) {
  const [weekStart, workingDays] = await Promise.all([
    getSetting("locale.weekStart", { collegeId }, db),
    getSetting("calendar.workingDays", { collegeId }, db),
  ]);
  const weekendDays = weekend(weekdays.indexOf(weekStart), workingDays);
  if (years.length === 0 || rules.length === 0) return 0;
  const added = await db
    .insert(holidays)
    .values(
      years.flatMap((hijriYear) =>
        rules.map(({ key, name, ...rule }) => ({
          collegeId,
          key,
          name,
          hijriYear,
          ...estimateBreak(rule, hijriYear, weekendDays),
        })),
      ),
    )
    .onConflictDoNothing()
    .returning({ id: holidays.id });
  return added.length;
}

// The college's breaks that end on or after a day, in order: those a term starting then can meet,
// and those the vice-dean may still adjust.
export function holidaysFrom(
  collegeId: string,
  from: Day,
  db: Db | Tx = getDb(),
) {
  return db
    .select(columns)
    .from(holidays)
    .where(and(eq(holidays.collegeId, collegeId), gte(holidays.endsOn, from)))
    .orderBy(asc(holidays.startsOn), asc(holidays.key));
}

// Sets a break's days as they were announced, marks it adjusted, and records holiday.update with
// its days before and after. A break that has begun by today stays as it was, so the terms that
// counted it keep their weeks, and none moves to a day that has passed.
export async function updateHoliday(
  id: string,
  days: { startsOn: Day; endsOn: Day },
  change: {
    collegeId: string;
    actorId: string;
    ip?: string | null;
    userAgent?: string | null;
  },
  today: Day,
  db: Db = getDb(),
): Promise<{ status: "notFound" | "begun" | "past" | "saved" | "unchanged" }> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select(columns)
      .from(holidays)
      .where(and(eq(holidays.collegeId, change.collegeId), eq(holidays.id, id)))
      .for("update");
    if (!current) return { status: "notFound" };
    if (current.startsOn <= today) return { status: "begun" };
    // Nor does a break move to a day that has passed.
    if (days.startsOn <= today) return { status: "past" };
    if (current.startsOn === days.startsOn && current.endsOn === days.endsOn) {
      return { status: "unchanged" };
    }
    await tx
      .update(holidays)
      .set({ ...days, adjusted: true, updatedAt: sql`now()` })
      .where(eq(holidays.id, id));
    await writeAudit(
      {
        collegeId: change.collegeId,
        actorId: change.actorId,
        action: "holiday.update",
        entityType: "holiday",
        entityId: id,
        diff: {
          from: {
            name: current.name,
            hijriYear: current.hijriYear,
            startsOn: current.startsOn,
            endsOn: current.endsOn,
          },
          to: {
            name: current.name,
            hijriYear: current.hijriYear,
            ...days,
          },
        },
        ip: change.ip,
        userAgent: change.userAgent,
      },
      tx,
    );
    return { status: "saved" };
  });
}

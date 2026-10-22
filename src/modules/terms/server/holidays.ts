import { and, asc, eq, gte, sql } from "drizzle-orm";
import { type Db, getDb, type Tx } from "../../../platform/db/client.ts";
import { writeAudit } from "../../audit/index.ts";
import { getSetting, weekdays } from "../../settings/index.ts";
import { type BreakRule, estimateBreak, weekend } from "../domain/holidays.ts";
import type { Day } from "../domain/weeks.ts";
import { holidays } from "./schema.ts";

const columns = {
  id: holidays.id,
  key: holidays.key,
  name: holidays.name,
  hijriYear: holidays.hijriYear,
  startsOn: holidays.startsOn,
  endsOn: holidays.endsOn,
  adjusted: holidays.adjusted,
};

// The holidays the base seed gives a college (ADR-0018): each rule's holiday in each of these Umm
// al-Qura years that holds it, estimated with the college's weekend, where the college has none for
// that rule and year yet. One already there, estimated or approved, stays as it is. Returns how many
// it added.
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
  const rows = years.flatMap((hijriYear) =>
    rules.flatMap(({ key, name, ...rule }) => {
      const days = estimateBreak(rule, hijriYear, weekendDays);
      return days ? [{ collegeId, key, name, hijriYear, ...days }] : [];
    }),
  );
  if (rows.length === 0) return 0;
  const added = await db
    .insert(holidays)
    .values(rows)
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

// Sets a holiday's days as they were announced, marks it approved, and records holiday.update with
// its days before and after; the same days approve an estimate as it is, recorded as
// holiday.approve. A holiday that has begun by today stays as it was, so the terms that counted it
// keep their weeks, and none moves to a day that has passed.
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
): Promise<{
  status: "notFound" | "begun" | "past" | "saved" | "approved" | "unchanged";
}> {
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
    const held = {
      name: current.name,
      hijriYear: current.hijriYear,
      startsOn: current.startsOn,
      endsOn: current.endsOn,
    };
    if (current.startsOn === days.startsOn && current.endsOn === days.endsOn) {
      if (current.adjusted) return { status: "unchanged" };
      await tx
        .update(holidays)
        .set({ adjusted: true, updatedAt: sql`now()` })
        .where(eq(holidays.id, id));
      await writeAudit(
        {
          collegeId: change.collegeId,
          actorId: change.actorId,
          action: "holiday.approve",
          entityType: "holiday",
          entityId: id,
          diff: { to: held },
          ip: change.ip,
          userAgent: change.userAgent,
        },
        tx,
      );
      return { status: "approved" };
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
          from: held,
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

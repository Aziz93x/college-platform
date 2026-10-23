import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { type Db, getDb, type Tx } from "../../../platform/db/client.ts";
import { lockCollege } from "../../../platform/db/college-lock.ts";
import { addDays } from "../../../platform/i18n/time-zone.ts";
import { foldCase } from "../../../platform/validation/text.ts";
import { type AuditAction, writeAudit } from "../../audit/index.ts";
import { getSetting, weekdays } from "../../settings/index.ts";
import type {
  CalendarEventInput,
  CalendarEventKind,
  TermInput,
  TermStatus,
} from "../domain/inputs.ts";
import { periodProblems } from "../domain/periods.ts";
import {
  calendarOf,
  type Day,
  outside,
  type TermCalendar,
  weekDays,
  weekOf,
  workingDays,
} from "../domain/weeks.ts";
import { holidaysFrom } from "./holidays.ts";
import { periodNames, periodsOf } from "./periods.ts";
import { calendarEvents, examPeriods, terms } from "./schema.ts";

// Who changes a term, for the audit event. The caller has authorized them.
type Change = {
  collegeId: string;
  actorId: string;
  ip?: string | null;
  userAgent?: string | null;
};

export type Term = {
  id: string;
  name: string;
  startsOn: Day;
  weeks: number;
  status: TermStatus;
};

type CalendarEvent = {
  id: string;
  kind: CalendarEventKind;
  title: string;
  startsOn: Day;
  endsOn: Day;
};

type Dated = Pick<CalendarEvent, "kind" | "title" | "startsOn" | "endsOn">;

const termColumns = {
  id: terms.id,
  name: terms.name,
  startsOn: terms.startsOn,
  weeks: terms.weeks,
  status: terms.status,
};

const eventColumns = {
  id: calendarEvents.id,
  kind: calendarEvents.kind,
  title: calendarEvents.title,
  startsOn: calendarEvents.startsOn,
  endsOn: calendarEvents.endsOn,
};

// How the college counts a term's weeks: the days worked from the week's first day, and whether a
// week of holidays goes without a number. Read before a transaction, as settings are.
export async function calendarSettings(collegeId: string, db?: Db) {
  const [weekStart, count, skipHolidayWeeks] = await Promise.all([
    getSetting("locale.weekStart", { collegeId }, db),
    getSetting("calendar.workingDays", { collegeId }, db),
    getSetting("calendar.skipHolidayWeeks", { collegeId }, db),
  ]);
  return {
    workingDays: workingDays(weekdays.indexOf(weekStart), count),
    skipHolidayWeeks,
  };
}

export type CalendarSettings = Awaited<ReturnType<typeof calendarSettings>>;

// The settings that count a term's weeks, which calendarSettings() reads.
const calendarKeys = [
  "locale.weekStart",
  "calendar.workingDays",
  "calendar.skipHolidayWeeks",
] as const;

// The events of the college's terms that are not closed which a new value of a setting that counts
// their weeks would leave outside their term, with the first such term's name: as a holiday's new
// days may not (Audit 5), nor may the settings (lead review C). Undefined for another setting, and
// for a value that leaves every event in its term. The value is one the setting's schema took.
export async function strandedBySetting(
  collegeId: string,
  key: string,
  value: unknown,
  db: Db = getDb(),
) {
  if (!calendarKeys.some((each) => each === key)) return undefined;
  const [weekStart, count, skipHolidayWeeks, listed] = await Promise.all([
    getSetting("locale.weekStart", { collegeId }, db),
    getSetting("calendar.workingDays", { collegeId }, db),
    getSetting("calendar.skipHolidayWeeks", { collegeId }, db),
    listTermCalendars(collegeId, db),
  ]);
  const raw = {
    "locale.weekStart": weekStart,
    "calendar.workingDays": count,
    "calendar.skipHolidayWeeks": skipHolidayWeeks,
    [key]: value,
  } as {
    "locale.weekStart": typeof weekStart;
    "calendar.workingDays": typeof count;
    "calendar.skipHolidayWeeks": typeof skipHolidayWeeks;
  };
  const settings = {
    workingDays: workingDays(
      weekdays.indexOf(raw["locale.weekStart"]),
      raw["calendar.workingDays"],
    ),
    skipHolidayWeeks: raw["calendar.skipHolidayWeeks"],
  };
  for (const term of listed.filter((each) => each.status !== "closed")) {
    const left = outside(
      calendarOf(term, term.events, settings, term.breaks),
      term.events,
    );
    if (left.length > 0) {
      return { term: term.name, events: left.map(({ title }) => title) };
    }
  }
  return undefined;
}

// The college's terms, the latest first.
export async function listTerms(collegeId: string, db: Db = getDb()) {
  return db
    .select(termColumns)
    .from(terms)
    .where(eq(terms.collegeId, collegeId))
    .orderBy(desc(terms.startsOn), desc(terms.id));
}

// The college's terms, the latest first, each with its calendar as findTerm() gives it: four reads
// whatever the number of terms (lead review C).
export async function listTermCalendars(collegeId: string, db: Db = getDb()) {
  const listed = await listTerms(collegeId, db);
  if (listed.length === 0) return [];
  const earliest = listed.reduce(
    (first, term) => (term.startsOn < first ? term.startsOn : first),
    listed[0].startsOn,
  );
  const ids = listed.map((term) => term.id);
  const [events, breaks, periods] = await Promise.all([
    db
      .select({ termId: calendarEvents.termId, ...eventColumns })
      .from(calendarEvents)
      .where(inArray(calendarEvents.termId, ids))
      .orderBy(asc(calendarEvents.startsOn), asc(calendarEvents.endsOn)),
    holidaysFrom(collegeId, earliest, db),
    periodsOf(ids, db),
  ]);
  return listed.map((term) => ({
    ...term,
    events: events
      .filter((event) => event.termId === term.id)
      .map(({ termId: _, ...event }) => event),
    breaks: breaks.filter((range) => range.endsOn >= term.startsOn),
    periods: periods
      .filter((period) => period.termId === term.id)
      .map(({ termId: _, ...period }) => period),
  }));
}

async function eventsOf(termId: string, db: Db | Tx) {
  return db
    .select(eventColumns)
    .from(calendarEvents)
    .where(eq(calendarEvents.termId, termId))
    .orderBy(asc(calendarEvents.startsOn), asc(calendarEvents.endsOn));
}

// A term with its calendar's events in order, the college's breaks it can meet (ADR-0018), and its
// exam periods by week number (the owner's notes, 21 October 2026).
async function withCalendar(term: Term, collegeId: string, db: Db | Tx) {
  return {
    ...term,
    events: await eventsOf(term.id, db),
    breaks: await holidaysFrom(collegeId, term.startsOn, db),
    periods: (await periodsOf([term.id], db)).map(
      ({ termId: _, ...period }) => period,
    ),
  };
}

// One term of the college with its calendar; undefined for an id that is not one of the college's.
export async function findTerm(
  collegeId: string,
  id: string,
  db: Db | Tx = getDb(),
) {
  const [term] = await db
    .select(termColumns)
    .from(terms)
    .where(and(eq(terms.collegeId, collegeId), eq(terms.id, id)));
  return term ? withCalendar(term, collegeId, db) : undefined;
}

// The college's active term with its calendar, if it has one.
export async function activeTerm(collegeId: string, db: Db = getDb()) {
  const [term] = await db
    .select(termColumns)
    .from(terms)
    .where(and(eq(terms.collegeId, collegeId), eq(terms.status, "active")));
  return term ? withCalendar(term, collegeId, db) : undefined;
}

// Another term of the college with this name in any case of its Latin letters.
async function nameTaken(
  tx: Tx,
  collegeId: string,
  name: string,
  except?: string,
) {
  const others = await tx
    .select({ name: terms.name })
    .from(terms)
    .where(
      except
        ? and(eq(terms.collegeId, collegeId), ne(terms.id, except))
        : eq(terms.collegeId, collegeId),
    );
  return others.some((other) => foldCase(other.name) === foldCase(name));
}

const audit = (
  tx: Tx,
  change: Change,
  action: AuditAction,
  termId: string,
  diff: Record<string, unknown>,
) =>
  writeAudit(
    {
      collegeId: change.collegeId,
      actorId: change.actorId,
      action,
      entityType: "term",
      entityId: termId,
      diff,
      ip: change.ip,
      userAgent: change.userAgent,
    },
    tx,
  );

// Adds a term as a draft and records term.create with what it was given.
export async function createTerm(
  input: TermInput,
  change: Change,
  db: Db = getDb(),
): Promise<{ status: "nameTaken" } | { status: "created"; id: string }> {
  return db.transaction(async (tx) => {
    await lockCollege(tx, change.collegeId);
    if (await nameTaken(tx, change.collegeId, input.name)) {
      return { status: "nameTaken" };
    }
    const [{ id }] = await tx
      .insert(terms)
      .values({ collegeId: change.collegeId, ...input })
      .returning({ id: terms.id });
    await audit(tx, change, "term.create", id, { to: input });
    return { status: "created", id };
  });
}

type Refusal =
  | { status: "notFound" }
  | { status: "closed" }
  | { status: "eventsOutside"; events: string[] };

// Saves a draft or active term's name, first day and weeks, and records term.update with each
// changed one before and after. A change that leaves an event of its calendar outside the term is
// refused, naming the events.
export async function updateTerm(
  id: string,
  input: TermInput,
  change: Change,
  settings: CalendarSettings,
  db: Db = getDb(),
): Promise<
  Refusal | { status: "nameTaken" } | { status: "saved" | "unchanged" }
> {
  return db.transaction(async (tx) => {
    await lockCollege(tx, change.collegeId);
    const current = await findTerm(change.collegeId, id, tx);
    if (!current) return { status: "notFound" };
    if (current.status === "closed") return { status: "closed" };
    if (await nameTaken(tx, change.collegeId, input.name, id)) {
      return { status: "nameTaken" };
    }
    const left = outside(
      calendarOf(
        input,
        current.events,
        settings,
        await holidaysFrom(change.collegeId, input.startsOn, tx),
      ),
      current.events,
    );
    if (left.length > 0) {
      return { status: "eventsOutside", events: left.map((e) => e.title) };
    }
    const from: Record<string, unknown> = {};
    const to: Record<string, unknown> = {};
    for (const key of ["name", "startsOn", "weeks"] as const) {
      if (current[key] !== input[key]) {
        from[key] = current[key];
        to[key] = input[key];
      }
    }
    if (Object.keys(to).length === 0) return { status: "unchanged" };
    await tx
      .update(terms)
      .set({ ...input, updatedAt: sql`now()` })
      .where(eq(terms.id, id));
    await audit(tx, change, "term.update", id, { from, to });
    return { status: "saved" };
  });
}

// Makes a draft the college's active term, closing the one active before it in the same
// transaction, and records term.close for that one and term.activate for this one. A term with an
// exam period past its last week, or two that share a week, is not activated: the refusal names
// them (the owner's notes, 21 October 2026).
export async function activateTerm(
  id: string,
  change: Change,
  db: Db = getDb(),
): Promise<
  | { status: "notFound" | "notDraft" }
  | { status: "periodProblems"; periods: string[] }
  | { status: "activated"; closed?: string }
> {
  return db.transaction(async (tx) => {
    await lockCollege(tx, change.collegeId);
    const current = await findTerm(change.collegeId, id, tx);
    if (!current) return { status: "notFound" };
    if (current.status !== "draft") return { status: "notDraft" };
    const { pastEnd, overlaps } = periodProblems(
      current.periods,
      current.weeks,
    );
    if (pastEnd.length + overlaps.length > 0) {
      return {
        status: "periodProblems",
        periods: await periodNames(
          change.collegeId,
          [...pastEnd, ...overlaps.flat()],
          tx,
        ),
      };
    }
    const [previous] = await tx
      .update(terms)
      .set({ status: "closed", updatedAt: sql`now()` })
      .where(
        and(eq(terms.collegeId, change.collegeId), eq(terms.status, "active")),
      )
      .returning({ id: terms.id, name: terms.name });
    if (previous) {
      await audit(tx, change, "term.close", previous.id, {
        from: { status: "active" },
        to: { status: "closed" },
      });
    }
    await tx
      .update(terms)
      .set({ status: "active", updatedAt: sql`now()` })
      .where(eq(terms.id, id));
    await audit(tx, change, "term.activate", id, {
      from: { status: "draft" },
      to: { status: "active" },
    });
    return { status: "activated", closed: previous?.name };
  });
}

// Closes the active term and records term.close. A closed term is kept as it is.
export async function closeTerm(
  id: string,
  change: Change,
  db: Db = getDb(),
): Promise<{ status: "notFound" | "notActive" | "closed" }> {
  return db.transaction(async (tx) => {
    await lockCollege(tx, change.collegeId);
    const current = await findTerm(change.collegeId, id, tx);
    if (!current) return { status: "notFound" };
    if (current.status !== "active") return { status: "notActive" };
    await tx
      .update(terms)
      .set({ status: "closed", updatedAt: sql`now()` })
      .where(eq(terms.id, id));
    await audit(tx, change, "term.close", id, {
      from: { status: "active" },
      to: { status: "closed" },
    });
    return { status: "closed" };
  });
}

// Changes a draft or active term's calendar: what the events become, checked against the term,
// then written. An event outside the term is refused, and so is a change that leaves another one
// outside it (a holiday taken away shortens a term that skips its weeks).
async function changeCalendar(
  termId: string,
  change: Change,
  settings: CalendarSettings,
  db: Db,
  edit: (
    events: CalendarEvent[],
  ) => { events: Dated[]; write: (tx: Tx) => Promise<void> } | undefined,
): Promise<Refusal | { status: "eventNotFound" } | { status: "saved" }> {
  return db.transaction(async (tx) => {
    await lockCollege(tx, change.collegeId);
    const term = await findTerm(change.collegeId, termId, tx);
    if (!term) return { status: "notFound" };
    if (term.status === "closed") return { status: "closed" };
    const edited = edit(term.events);
    if (!edited) return { status: "eventNotFound" };
    const left = outside(
      calendarOf(term, edited.events, settings, term.breaks),
      edited.events,
    );
    if (left.length > 0) {
      return {
        status: "eventsOutside",
        events: left.map((event) => event.title),
      };
    }
    await edited.write(tx);
    return { status: "saved" };
  });
}

// Adds a day or days to a term's calendar and records calendarEvent.create on the term.
export function addCalendarEvent(
  termId: string,
  input: CalendarEventInput,
  change: Change,
  settings: CalendarSettings,
  db: Db = getDb(),
) {
  return changeCalendar(termId, change, settings, db, (events) => ({
    events: [...events, input],
    write: async (tx) => {
      await tx
        .insert(calendarEvents)
        .values({ collegeId: change.collegeId, termId, ...input });
      await audit(tx, change, "calendarEvent.create", termId, { to: input });
    },
  }));
}

// Saves an event of a term's calendar and records calendarEvent.update with what changed.
export function updateCalendarEvent(
  termId: string,
  eventId: string,
  input: CalendarEventInput,
  change: Change,
  settings: CalendarSettings,
  db: Db = getDb(),
) {
  return changeCalendar(termId, change, settings, db, (events) => {
    const current = events.find((event) => event.id === eventId);
    if (!current) return undefined;
    return {
      events: events.map((event) =>
        event.id === eventId ? { ...event, ...input } : event,
      ),
      write: async (tx) => {
        const from: Record<string, unknown> = {};
        const to: Record<string, unknown> = {};
        for (const key of ["kind", "title", "startsOn", "endsOn"] as const) {
          if (current[key] !== input[key]) {
            from[key] = current[key];
            to[key] = input[key];
          }
        }
        if (Object.keys(to).length === 0) return;
        await tx
          .update(calendarEvents)
          .set({ ...input, updatedAt: sql`now()` })
          .where(eq(calendarEvents.id, eventId));
        await audit(tx, change, "calendarEvent.update", termId, {
          from: { title: current.title, ...from },
          to,
        });
      },
    };
  });
}

// Takes an event off a term's calendar and records calendarEvent.delete with what it was.
export function removeCalendarEvent(
  termId: string,
  eventId: string,
  change: Change,
  settings: CalendarSettings,
  db: Db = getDb(),
) {
  return changeCalendar(termId, change, settings, db, (events) => {
    const current = events.find((event) => event.id === eventId);
    if (!current) return undefined;
    return {
      events: events.filter((event) => event.id !== eventId),
      write: async (tx) => {
        await tx.delete(calendarEvents).where(eq(calendarEvents.id, eventId));
        const { id: _, ...was } = current;
        await audit(tx, change, "calendarEvent.delete", termId, { from: was });
      },
    };
  });
}

// The day of another term at the same place in its weeks: the same day of the week with the same
// number. Nothing for a day in a week of holidays, or past the other term's last week.
function samePlace(from: TermCalendar, to: TermCalendar, day: Day) {
  const week = weekOf(from, day);
  if (week?.number == null) return undefined;
  const offset =
    (Date.parse(`${day}T00:00:00Z`) -
      Date.parse(`${week.startsOn}T00:00:00Z`)) /
    86_400_000;
  const there = weekDays(to, week.number);
  return there ? addDays(there.startsOn, offset) : undefined;
}

// The "open next term" wizard (Step 13): a draft from another term, with its deadlines and events
// of the college's own at the same places in its weeks, counted past the college's Eid breaks that
// fall in it (ADR-0018), and its exam periods in the same weeks, which the vice-dean then moves (the
// owner's notes, 21 October 2026). Its own holidays stay behind: they are days of the year. Records
// term.create with the term it came from and how many events and periods it took. Steps 15, 18 and
// 19 add their parts to the copy as drafts.
export async function openNextTerm(
  fromId: string,
  input: TermInput,
  change: Change,
  settings: CalendarSettings,
  db: Db = getDb(),
  // What the modules built on terms copy into the new term, in the same transaction: the
  // framework (Step 15), then the templates and plans (Steps 18 and 19).
  also?: (tx: Tx, fromId: string, toId: string) => Promise<unknown>,
): Promise<
  | { status: "notFound" | "nameTaken" }
  | { status: "created"; id: string; copied: number; periods: number }
> {
  return db.transaction(async (tx) => {
    await lockCollege(tx, change.collegeId);
    const source = await findTerm(change.collegeId, fromId, tx);
    if (!source) return { status: "notFound" };
    if (await nameTaken(tx, change.collegeId, input.name)) {
      return { status: "nameTaken" };
    }
    const [{ id }] = await tx
      .insert(terms)
      .values({ collegeId: change.collegeId, ...input })
      .returning({ id: terms.id });
    const from = calendarOf(source, source.events, settings, source.breaks);
    const to = calendarOf(
      input,
      [],
      settings,
      await holidaysFrom(change.collegeId, input.startsOn, tx),
    );
    const copies = source.events.flatMap((event) => {
      if (event.kind === "holiday") return [];
      const startsOn = samePlace(from, to, event.startsOn);
      const endsOn = samePlace(from, to, event.endsOn);
      return startsOn && endsOn
        ? [{ kind: event.kind, title: event.title, startsOn, endsOn }]
        : [];
    });
    if (copies.length > 0) {
      await tx.insert(calendarEvents).values(
        copies.map((copy) => ({
          collegeId: change.collegeId,
          termId: id,
          ...copy,
        })),
      );
    }
    if (source.periods.length > 0) {
      await tx.insert(examPeriods).values(
        source.periods.map(({ type, from, to }) => ({
          collegeId: change.collegeId,
          termId: id,
          type,
          fromWeek: from,
          toWeek: to,
        })),
      );
    }
    await audit(tx, change, "term.create", id, {
      to: {
        ...input,
        from: source.name,
        copied: copies.length,
        periods: source.periods.length,
      },
    });
    await also?.(tx, fromId, id);
    return {
      status: "created",
      id,
      copied: copies.length,
      periods: source.periods.length,
    };
  });
}

import {
  addDays,
  atHour,
  wallClock,
} from "../../../platform/i18n/time-zone.ts";
import type { Sent } from "./kinds.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

// When the college's digest falls due: a day of the week (0 is Sunday, as JavaScript counts) at an
// hour of its clock (the settings reminders.digestDay, reminders.digestHour and locale.timeZone).
export type DigestSchedule = {
  weekday: number;
  hour: number;
  timeZone: string;
};

// One week's digest: the instant it fell due, and that day on the college's clock, which names it.
export type DigestMoment = { day: string; at: Date };

// The latest moment, at `now` or before it, at which a digest fell due.
export function lastDigestMoment(
  now: Date,
  { weekday, hour, timeZone }: DigestSchedule,
): DigestMoment {
  const today = wallClock(now, timeZone).slice(0, 10);
  const todayWeekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const day = addDays(today, -((todayWeekday - weekday + 7) % 7));
  const at = atHour(day, hour, timeZone);
  if (at <= now) return { day, at };
  const weekBefore = addDays(day, -7);
  return { day: weekBefore, at: atHour(weekBefore, hour, timeZone) };
}

// A digest still goes out for a day after it fell due, so a worker that was off at that hour (a
// laptop asleep) sends it when it starts; later than that, the week has moved on.
export function isDigestDue(now: Date, moment: DigestMoment) {
  return now.getTime() - moment.at.getTime() < DAY_MS;
}

// The week a digest covers: the seven days before it fell due.
export function digestWeek(moment: DigestMoment) {
  return { from: new Date(moment.at.getTime() - 7 * DAY_MS), to: moment.at };
}

// The once key a person's digest of a week carries, so the job may run again and send nothing more.
export function digestKey(moment: DigestMoment) {
  return `weeklyDigest:${moment.day}`;
}

// How many of the unread notifications a digest names; it counts the rest.
const NAMED = 3;

// What a person's digest says: how many of the week's notifications they left unread, and the
// newest of them, given newest first. It keeps which they are, all it counts, so it is read with
// the last of them (ADR-0015).
export function digestOf(unread: readonly (Sent & { id: string })[]) {
  return {
    count: unread.length,
    latest: unread
      .slice(0, NAMED)
      .map(({ kind, params }) => ({ kind, params })),
    ids: unread.map(({ id }) => id),
  };
}

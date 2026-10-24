import { addDays } from "../../../platform/i18n/time-zone.ts";

/** A calendar day, YYYY-MM-DD: strings in this form sort as the days do. */
export type Day = string;

/** The days from one to another, both included. */
export interface DayRange {
  startsOn: Day;
  endsOn: Day;
}

// What a term's weeks are counted from: its first day, how many weeks it has, its holidays, and the
// college's calendar settings.
export interface TermCalendar {
  startsOn: Day;
  weeks: number;
  holidays: readonly DayRange[];
  /** Whether a week whose working days are all holidays goes without a number (calendar.skipHolidayWeeks). */
  skipHolidayWeeks: boolean;
  /** The days of the week that are worked, 0 for Sunday (workingDays below). */
  workingDays: ReadonlySet<number>;
}

export interface TermWeek extends DayRange {
  /** Its number in the term; null for a week of holidays the term skips. */
  number: number | null;
  /** Whether holidays take every working day of it. */
  holiday: boolean;
}

// The days worked in a week: the first count days from its first day (0 for Sunday), as the
// settings locale.weekStart and calendar.workingDays say.
export function workingDays(weekStart: number, count: number) {
  return new Set(
    Array.from({ length: count }, (_, index) => (weekStart + index) % 7),
  );
}

// The day of the week a day is, 0 for Sunday.
export function weekday(day: Day) {
  return new Date(`${day}T00:00:00Z`).getUTCDay();
}

const within = (day: Day, range: DayRange) =>
  range.startsOn <= day && day <= range.endsOn;

// The term's weeks in order: seven days each from its first day, numbered until it has its number
// of weeks. A week whose working days are all holidays, an Eid break, is marked; where the setting
// says so it goes without a number and the term runs a week longer.
export function termWeeks(term: TermCalendar): TermWeek[] {
  const weeks: TermWeek[] = [];
  let number = 0;
  for (let day = term.startsOn; number < term.weeks; day = addDays(day, 7)) {
    const days = Array.from({ length: 7 }, (_, index) => addDays(day, index));
    const holiday = days
      .filter((each) => term.workingDays.has(weekday(each)))
      .every((each) => term.holidays.some((range) => within(each, range)));
    const counted = !(holiday && term.skipHolidayWeeks);
    if (counted) number += 1;
    weeks.push({
      startsOn: day,
      endsOn: days[6],
      number: counted ? number : null,
      holiday,
    });
  }
  return weeks;
}

// The week a day falls in, or nothing before the term's first day and after its last.
export function weekOf(term: TermCalendar, day: Day) {
  return termWeeks(term).find((week) => within(day, week));
}

// The days of a week of the term by its number.
export function weekDays(term: TermCalendar, number: number) {
  return termWeeks(term).find((week) => week.number === number);
}

// The term's last day: the end of its last week.
export function termEndsOn(term: TermCalendar) {
  return termWeeks(term).at(-1)?.endsOn ?? term.startsOn;
}

// The numbered week a day has reached: the one it falls in, or the last before it in a week without
// a number; 0 before the term's first week (Step 20).
export function weekReached(weeks: readonly TermWeek[], day: Day) {
  return (
    weeks.filter((week) => week.number !== null && week.startsOn <= day).at(-1)
      ?.number ?? 0
  );
}

// The day a task of a week is due: the week's last working day that is not a holiday, or its last
// working day when holidays take them all (Step 20).
export function dueDay(
  term: Pick<TermCalendar, "holidays" | "workingDays">,
  week: DayRange,
): Day {
  const worked = Array.from({ length: 7 }, (_, index) =>
    addDays(week.startsOn, 6 - index),
  ).filter((day) => term.workingDays.has(weekday(day)));
  return (
    worked.find((day) => !term.holidays.some((range) => within(day, range))) ??
    worked[0] ??
    week.endsOn
  );
}

// Whether a day is worked: one of the college's working days, and in none of the term's holidays,
// the days a task can be due on (ADR-0025; lead review D, proposal 6).
export function isWorkingDay(
  term: Pick<TermCalendar, "holidays" | "workingDays">,
  day: Day,
) {
  return (
    term.workingDays.has(weekday(day)) &&
    !term.holidays.some((range) => within(day, range))
  );
}

// The first day on or after a day that a week's tasks are due: that week's due day, or the next
// week's once it has passed (lead review D, proposal 4). A week whose working days are all holidays
// has none, as nothing is due on a holiday; after the term's last week there is none.
export function nextDueDay(term: TermCalendar, day: Day) {
  return termWeeks(term)
    .map((week) => dueDay(term, week))
    .find((due) => due >= day && isWorkingDay(term, due));
}

// The day a task set for a day is due: that day while it is worked, else the last day worked before
// it in its week, or the first after it there, and the day itself when holidays take the whole week,
// as a week's own tasks move off its holidays and never out of it (dueDay). A quick request's day
// that a holiday or a break takes later moves so, and its tasks keep their week (lead review D).
export function workingDayBy(term: TermCalendar, day: Day): Day {
  const week = weekOf(term, day);
  if (!week || isWorkingDay(term, day)) return day;
  const worked = Array.from({ length: 7 }, (_, index) =>
    addDays(week.startsOn, index),
  ).filter((each) => isWorkingDay(term, each));
  return (
    worked.filter((each) => each < day).at(-1) ??
    worked.find((each) => each > day) ??
    day
  );
}

// A term's calendar as the week utilities count it: its own holidays and the college's Eid breaks
// (ADR-0018), with the college's settings.
export function calendarOf(
  term: { startsOn: Day; weeks: number },
  events: readonly (DayRange & { kind: string })[],
  settings: Pick<TermCalendar, "skipHolidayWeeks" | "workingDays">,
  breaks: readonly DayRange[] = [],
): TermCalendar {
  return {
    startsOn: term.startsOn,
    weeks: term.weeks,
    holidays: [
      ...events.filter((event) => event.kind === "holiday"),
      ...breaks,
    ],
    ...settings,
  };
}

// The events of a calendar that fall outside its term, before its first day or after its last.
export function outside<T extends DayRange>(
  calendar: TermCalendar,
  events: readonly T[],
) {
  const last = termEndsOn(calendar);
  return events.filter(
    (event) => event.startsOn < calendar.startsOn || event.endsOn > last,
  );
}

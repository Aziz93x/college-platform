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

function weekday(day: Day) {
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

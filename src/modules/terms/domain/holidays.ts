import { addDays } from "../../../platform/i18n/time-zone.ts";
import { type Day, type DayRange, weekday } from "./weeks.ts";

// The Umm al-Qura calendar as Intl carries it, ICU's own table: nothing is fetched (ADR-0018).
const umAlQura = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: "UTC",
});

function hijri(day: Day) {
  const parts = new Map(
    umAlQura
      .formatToParts(new Date(`${day}T00:00:00Z`))
      .map(({ type, value }) => [type, Number.parseInt(value, 10)]),
  );
  return {
    year: parts.get("year"),
    month: parts.get("month"),
    day: parts.get("day"),
  };
}

// The Umm al-Qura year a day falls in.
export function umAlQuraYear(day: Day) {
  return hijri(day).year ?? Number.NaN;
}

// The day a date of the Umm al-Qura calendar falls on. The tabular Islamic calendar comes within a
// day of it from 1440 to 1460; the days around that estimate are read until one is the date.
export function umAlQuraDay(year: number, month: number, day: number): Day {
  const julianDay =
    day +
    Math.ceil(29.5 * (month - 1)) +
    (year - 1) * 354 +
    Math.floor((3 + 11 * year) / 30) +
    1948438.5;
  const estimate = new Date((julianDay - 2440587.5) * 86_400_000)
    .toISOString()
    .slice(0, 10);
  for (const offset of [0, -1, 1, -2, 2, -3, 3]) {
    const candidate = addDays(estimate, offset);
    const found = hijri(candidate);
    if (found.year === year && found.month === month && found.day === day) {
      return candidate;
    }
  }
  throw new Error(`No Umm al-Qura day ${year}-${month}-${day}`);
}

// The days after a week's working days, by the first and the last of them, 0 for Sunday: what the
// settings locale.weekStart and calendar.workingDays leave.
export function weekend(weekStart: number, workingDays: number) {
  return { first: (weekStart + workingDays) % 7, last: (weekStart + 6) % 7 };
}

// The day of a weekday nearest another day.
function nearest(day: Day, target: number) {
  const ahead = (target - weekday(day) + 7) % 7;
  return addDays(day, ahead <= 3 ? ahead : ahead - 7);
}

// How a holiday is estimated (ADR-0018): a break around its feast, by the feast's Umm al-Qura month
// and day and how many days before and after it the break begins and ends on average; or a day of
// the Gregorian year, such as Founding Day.
export type BreakRule =
  | {
      calendar: "umalqura";
      month: number;
      day: number;
      before: number;
      after: number;
    }
  | { calendar: "gregory"; month: number; day: number };

// A day of the Gregorian year in an Umm al-Qura year, where that year holds it.
function gregorianIn(year: number, month: number, day: number) {
  const first = umAlQuraDay(year, 1, 1);
  const next = umAlQuraDay(year + 1, 1, 1);
  const from = Number(first.slice(0, 4));
  return [from, from + 1]
    .map(
      (each) =>
        `${each}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    )
    .find((candidate) => first <= candidate && candidate < next);
}

// A holiday in an Umm al-Qura year. A break around its feast runs from the first day of the weekend
// nearest its average start to the last day of the weekend nearest its average end, so it runs
// whole weeks as the calendars it was measured on did. A day of the Gregorian year that falls on the
// weekend's first day gives the working day before it instead, and on its last day the working day
// after it, as the official rule does for a Friday and a Saturday.
export function estimateBreak(
  rule: BreakRule,
  year: number,
  weekendDays: { first: number; last: number },
): DayRange | undefined {
  if (rule.calendar === "gregory") {
    const date = gregorianIn(year, rule.month, rule.day);
    if (!date) return undefined;
    const off =
      weekday(date) === weekendDays.first
        ? addDays(date, -1)
        : weekday(date) === weekendDays.last
          ? addDays(date, 1)
          : date;
    return { startsOn: off, endsOn: off };
  }
  const feast = umAlQuraDay(year, rule.month, rule.day);
  return {
    startsOn: nearest(addDays(feast, -rule.before), weekendDays.first),
    endsOn: nearest(addDays(feast, rule.after), weekendDays.last),
  };
}

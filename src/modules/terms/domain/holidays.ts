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

// How a break is estimated around its feast (ADR-0018): the feast's Umm al-Qura month and day, and
// how many days before and after it the break begins and ends on average.
export type BreakRule = {
  month: number;
  day: number;
  before: number;
  after: number;
};

// A break around its feast in an Umm al-Qura year: from the first day of the weekend nearest its
// average start to the last day of the weekend nearest its average end, so it runs whole weeks as
// the calendars it was measured on did.
export function estimateBreak(
  rule: BreakRule,
  year: number,
  weekendDays: { first: number; last: number },
): DayRange {
  const feast = umAlQuraDay(year, rule.month, rule.day);
  return {
    startsOn: nearest(addDays(feast, -rule.before), weekendDays.first),
    endsOn: nearest(addDays(feast, rule.after), weekendDays.last),
  };
}

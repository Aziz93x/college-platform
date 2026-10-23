import { describe, expect, it } from "vitest";
import {
  dueDay,
  type TermCalendar,
  termEndsOn,
  termWeeks,
  weekDays,
  weekOf,
  weekReached,
  workingDays,
} from "./weeks.ts";

// The second term of 1447 as a Saudi college keeps it: 18 weeks from Sunday 11 January 2026, worked
// Sunday to Thursday. Ramadan runs from Wednesday 18 February to Thursday 19 March, and the term
// trains through it; Eid al-Fitr (Friday 20 March) and Eid al-Adha (Wednesday 27 May) each close
// the college for two weeks, and Founding Day (22 February) for one Sunday.
const SUNDAY_TO_THURSDAY = workingDays(0, 5);
const term: TermCalendar = {
  startsOn: "2026-01-11",
  weeks: 18,
  holidays: [
    { startsOn: "2026-02-22", endsOn: "2026-02-22" },
    { startsOn: "2026-03-15", endsOn: "2026-03-28" },
    { startsOn: "2026-05-24", endsOn: "2026-06-06" },
  ],
  skipHolidayWeeks: true,
  workingDays: SUNDAY_TO_THURSDAY,
};

it("counts the working days from the week's first day", () => {
  expect([...workingDays(0, 5)]).toEqual([0, 1, 2, 3, 4]);
  expect([...workingDays(6, 5)]).toEqual([6, 0, 1, 2, 3]);
  expect([...workingDays(1, 7)]).toEqual([1, 2, 3, 4, 5, 6, 0]);
});

describe("skipping the weeks of holidays", () => {
  it("trains through Ramadan: its weeks keep their numbers", () => {
    // 1 Ramadan 1447 is Wednesday 18 February, in the sixth week.
    expect(weekOf(term, "2026-02-18")).toEqual({
      startsOn: "2026-02-15",
      endsOn: "2026-02-21",
      number: 6,
      holiday: false,
    });
    // One holiday on a Sunday does not take the week.
    expect(weekOf(term, "2026-02-22")?.number).toBe(7);
    // The last days of Ramadan, before the break.
    expect(weekOf(term, "2026-03-12")?.number).toBe(9);
  });

  it("gives the Eid breaks no number, and counts on after them", () => {
    expect(weekOf(term, "2026-03-20")).toEqual({
      startsOn: "2026-03-15",
      endsOn: "2026-03-21",
      number: null,
      holiday: true,
    });
    expect(weekOf(term, "2026-03-26")?.number).toBeNull();
    expect(weekDays(term, 10)).toMatchObject({
      startsOn: "2026-03-29",
      endsOn: "2026-04-04",
    });
    expect(weekDays(term, 17)).toMatchObject({ startsOn: "2026-05-17" });
    expect(weekOf(term, "2026-05-27")?.number).toBeNull();
    expect(weekDays(term, 18)).toMatchObject({
      startsOn: "2026-06-07",
      endsOn: "2026-06-13",
    });
  });

  it("runs the term four weeks longer for the two breaks", () => {
    const weeks = termWeeks(term);
    expect(weeks).toHaveLength(22);
    expect(weeks.filter((week) => week.number !== null)).toHaveLength(18);
    expect(termEndsOn(term)).toBe("2026-06-13");
  });

  it("takes a break entered on its working days only, the weekends left out", () => {
    const workingDaysOnly = {
      ...term,
      holidays: [{ startsOn: "2026-03-15", endsOn: "2026-03-26" }],
    };
    expect(weekOf(workingDaysOnly, "2026-03-15")?.number).toBeNull();
    expect(weekOf(workingDaysOnly, "2026-03-22")?.number).toBeNull();
    expect(weekDays(workingDaysOnly, 10)?.startsOn).toBe("2026-03-29");
  });

  it("keeps the number of a week the holidays take only in part", () => {
    const shortBreak = {
      ...term,
      holidays: [{ startsOn: "2026-03-16", endsOn: "2026-03-26" }],
    };
    expect(weekOf(shortBreak, "2026-03-17")).toMatchObject({
      number: 10,
      holiday: false,
    });
    expect(weekOf(shortBreak, "2026-03-22")).toMatchObject({
      number: null,
      holiday: true,
    });
  });
});

describe("counting every week", () => {
  const counted = { ...term, skipHolidayWeeks: false };

  it("numbers the Eid al-Fitr break as weeks of the term, marked as holidays", () => {
    expect(weekOf(counted, "2026-03-20")).toEqual({
      startsOn: "2026-03-15",
      endsOn: "2026-03-21",
      number: 10,
      holiday: true,
    });
    expect(weekDays(counted, 12)?.startsOn).toBe("2026-03-29");
  });

  it("ends the term after its own number of weeks, before Eid al-Adha", () => {
    expect(termWeeks(counted)).toHaveLength(18);
    expect(termEndsOn(counted)).toBe("2026-05-16");
    expect(weekOf(counted, "2026-05-27")).toBeUndefined();
  });
});

describe("what the generation engine counts on", () => {
  const weeks = termWeeks(term);

  it("reaches no week before the term, the last one before a break during it, and the last after it", () => {
    expect(weekReached(weeks, "2026-01-10")).toBe(0);
    expect(weekReached(weeks, "2026-01-11")).toBe(1);
    expect(weekReached(weeks, "2026-03-20")).toBe(9);
    expect(weekReached(weeks, "2026-07-01")).toBe(18);
  });

  it("makes a week's task due on its last working day that is not a holiday", () => {
    expect(dueDay(term, weeks[0])).toBe("2026-01-15");
    // Founding Day takes a Sunday of week 7, not its Thursday.
    expect(dueDay(term, weeks[6])).toBe("2026-02-26");
    const thursdayOff = {
      ...term,
      holidays: [{ startsOn: "2026-01-15", endsOn: "2026-01-15" }],
    };
    expect(dueDay(thursdayOff, weeks[0])).toBe("2026-01-14");
    // A week the Eid al-Fitr break takes whole, as a term that counts every week numbers it.
    expect(dueDay(term, weeks[9])).toBe("2026-03-19");
  });
});

it("knows no week before the term's first day or after its last", () => {
  expect(weekOf(term, "2026-01-10")).toBeUndefined();
  expect(weekOf(term, "2026-01-11")?.number).toBe(1);
  expect(weekOf(term, "2026-06-13")?.number).toBe(18);
  expect(weekOf(term, "2026-06-14")).toBeUndefined();
  expect(weekDays(term, 19)).toBeUndefined();
});

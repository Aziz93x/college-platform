import { describe, expect, it } from "vitest";
import {
  estimateBreak,
  umAlQuraDay,
  umAlQuraYear,
  weekend,
} from "./holidays.ts";

// The averages measured on past Saudi calendars (docs/reviews/eid-breaks.md); the base seed keeps
// them as data, and these tests take the same numbers.
const EID_AL_FITR = { month: 10, day: 1, before: 12, after: 5 };
const EID_AL_ADHA = { month: 12, day: 10, before: 7, after: 6 };
const FRIDAY_SATURDAY = weekend(0, 5);

it("reads the Umm al-Qura calendar both ways", () => {
  expect(umAlQuraDay(1447, 9, 1)).toBe("2026-02-18");
  expect(umAlQuraDay(1447, 10, 1)).toBe("2026-03-20");
  expect(umAlQuraDay(1448, 12, 10)).toBe("2027-05-16");
  expect(umAlQuraDay(1457, 10, 1)).toBe("2035-12-01");
  expect(umAlQuraYear("2026-10-22")).toBe(1448);
  expect(() => umAlQuraDay(1448, 9, 30)).toThrow();
});

it("finds the weekend after the working days", () => {
  expect(weekend(0, 5)).toEqual({ first: 5, last: 6 });
  expect(weekend(1, 5)).toEqual({ first: 6, last: 0 });
});

describe("the averaged estimate against the calendars it was measured on", () => {
  it.each([
    [1443, "2022-04-22", "2022-05-07"],
    [1447, "2026-03-06", "2026-03-28"],
    [1448, "2027-02-26", "2027-03-13"],
  ])("gives the Eid al-Fitr break of %i exactly", (year, startsOn, endsOn) => {
    expect(estimateBreak(EID_AL_FITR, year, FRIDAY_SATURDAY)).toEqual({
      startsOn,
      endsOn,
    });
  });

  it.each([
    [1446, "2025-05-30", "2025-06-14"],
    [1448, "2027-05-07", "2027-05-22"],
  ])("gives the Eid al-Adha break of %i exactly", (year, startsOn, endsOn) => {
    expect(estimateBreak(EID_AL_ADHA, year, FRIDAY_SATURDAY)).toEqual({
      startsOn,
      endsOn,
    });
  });

  it("comes within two days of the others, on the weekends they started", () => {
    // 1445's break ended on Sunday 14 April 2024; 1447's Eid al-Adha break on Monday 1 June 2026.
    expect(estimateBreak(EID_AL_FITR, 1445, FRIDAY_SATURDAY)).toEqual({
      startsOn: "2024-03-29",
      endsOn: "2024-04-13",
    });
    expect(estimateBreak(EID_AL_ADHA, 1447, FRIDAY_SATURDAY)).toEqual({
      startsOn: "2026-05-22",
      endsOn: "2026-05-30",
    });
    expect(estimateBreak(EID_AL_ADHA, 1443, FRIDAY_SATURDAY).startsOn).toBe(
      "2022-07-01",
    );
  });
});

it("fits every break of the next ten years to whole weeks, around its Eid", () => {
  for (let year = 1448; year <= 1457; year++) {
    for (const rule of [EID_AL_FITR, EID_AL_ADHA]) {
      const { startsOn, endsOn } = estimateBreak(rule, year, FRIDAY_SATURDAY);
      const feast = umAlQuraDay(year, rule.month, rule.day);
      expect(new Date(startsOn).getUTCDay()).toBe(5);
      expect(new Date(endsOn).getUTCDay()).toBe(6);
      expect(startsOn < feast && feast < endsOn).toBe(true);
    }
  }
});

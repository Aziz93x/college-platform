import { describe, expect, it } from "vitest";
import { examPeriodsInput, periodProblems } from "./periods.ts";

// The exam periods of the owner's canvas (21 October 2026), in an 18-week term.
const PERIODS = [
  { type: "first-periodic", from: 5, to: 6 },
  { type: "second-periodic", from: 11, to: 12 },
  { type: "practical-final", from: 16, to: 16 },
  { type: "theoretical-final", from: 17, to: 18 },
];

describe("examPeriodsInput", () => {
  it("takes each type once, from a week to a week no earlier", () => {
    expect(examPeriodsInput.safeParse(PERIODS).success).toBe(true);
    expect(examPeriodsInput.safeParse([]).success).toBe(true);
    expect(
      examPeriodsInput.safeParse([...PERIODS, { ...PERIODS[0], from: 8 }])
        .success,
    ).toBe(false);
    expect(
      examPeriodsInput.safeParse([{ type: "midterm", from: 9, to: 8 }]).success,
    ).toBe(false);
    expect(
      examPeriodsInput.safeParse([{ type: "midterm", from: 0, to: 1 }]).success,
    ).toBe(false);
  });
});

describe("periodProblems", () => {
  it("finds none in the canvas's term", () => {
    expect(periodProblems(PERIODS, 18)).toEqual({ pastEnd: [], overlaps: [] });
  });

  it("finds a period that a shorter term leaves past its last week, and none that ends in it", () => {
    expect(periodProblems(PERIODS, 17).pastEnd).toEqual([PERIODS[3]]);
    expect(periodProblems(PERIODS, 16).pastEnd).toEqual([PERIODS[3]]);
    expect(periodProblems(PERIODS, 15).pastEnd).toEqual(PERIODS.slice(2));
  });

  it("finds each two periods that share a week, and none that only meet", () => {
    const moved = [...PERIODS.slice(0, 3), { ...PERIODS[3], from: 16 }];
    expect(periodProblems(moved, 18).overlaps).toEqual([
      [PERIODS[2], moved[3]],
    ]);
    const inside = [{ type: "midterm", from: 4, to: 12 }, ...PERIODS];
    expect(periodProblems(inside, 18).overlaps).toEqual([
      [inside[0], PERIODS[0]],
      [inside[0], PERIODS[1]],
    ]);
  });
});

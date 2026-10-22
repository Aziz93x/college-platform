import { describe, expect, it } from "vitest";
import { trainerCounts } from "./counts.ts";

const section = (
  departmentId: string,
  courseCode: string,
  trainerNumbers: string[],
) => ({ departmentId, courseCode, trainerNumbers });

describe("trainerCounts", () => {
  it("counts each trainer of each section, each trainer of each course once, and the sections no one teaches yet", () => {
    expect(
      trainerCounts([
        // One trainer's two sections of a course, and a co-taught section of another.
        section("a", "ELC 101", ["200101"]),
        section("a", "ELC 101", ["200101"]),
        section("a", "ELC 102", ["200101", "200102"]),
        section("a", "ELC 103", []),
        // The same course and trainer in another department count there too.
        section("b", "ELC 101", ["200101"]),
      ]),
    ).toEqual({
      a: { trainers: 4, untaught: 1, courses: 3 },
      b: { trainers: 1, untaught: 0, courses: 1 },
    });
  });
});

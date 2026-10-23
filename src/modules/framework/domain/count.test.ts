import { describe, expect, it } from "vitest";
import {
  countTasks,
  departmentsReached,
  dueWeeks,
  occurrences,
} from "./count.ts";
import type { AppliesTo, DueRule } from "./inputs.ts";

const TRAINER = "0199b2a4-0000-7000-8000-000000000001";
const HEAD = "0199b2a4-0000-7000-8000-000000000002";
// An 18-week term with the exam periods of the owner's canvas (21 October 2026): the first periodic
// in weeks 5 and 6, the second in weeks 11 and 12, the practical final in week 16 and the
// theoretical final in weeks 17 and 18.
const TERM = {
  weeks: 18,
  periods: [
    { type: "first-periodic", from: 5, to: 6 },
    { type: "second-periodic", from: 11, to: 12 },
    { type: "practical-final", from: 16, to: 16 },
    { type: "theoretical-final", from: 17, to: 18 },
  ],
};
const EVERY_PERIOD = TERM.periods.map(({ type }) => type);
const anchored = (
  side: "before" | "after",
  weeks: number,
  periodTypes = EVERY_PERIOD,
): DueRule => ({ type: "examPeriods", periodTypes, side, weeks });
const trainers: AppliesTo = { type: "role", roleId: TRAINER };
const heads: AppliesTo = { type: "role", roleId: HEAD };

describe("occurrences", () => {
  it.each<[DueRule, number]>([
    [{ type: "week", week: 3 }, 1],
    [{ type: "week", week: 19 }, 0],
    [{ type: "weekly" }, 18],
    [{ type: "everyWeeks", every: 4 }, 4],
    [anchored("before", 1), 4],
    // A week after the theoretical final is past the term (Audit 5).
    [anchored("after", 1), 3],
    [anchored("after", 0, ["theoretical-final"]), 1],
    // A type with no period this term.
    [anchored("after", 0, ["midterm"]), 0],
  ])("counts %j %i times in 18 weeks", (due, times) => {
    expect(occurrences(due, TERM)).toBe(times);
  });
});

describe("dueWeeks", () => {
  it.each<[DueRule, number[]]>([
    [{ type: "week", week: 3 }, [3]],
    [{ type: "week", week: 19 }, []],
    [{ type: "everyWeeks", every: 4 }, [4, 8, 12, 16]],
    // The exam's questions the week before each period counts from its first week; its analysis
    // the week after counts from its last, and the theoretical final's is past the term.
    [anchored("before", 1), [4, 10, 15, 16]],
    [anchored("after", 1), [7, 13, 17]],
    // In each period's first or last week.
    [anchored("before", 0, ["first-periodic"]), [5]],
    [anchored("after", 0, ["first-periodic", "practical-final"]), [6, 16]],
    // Five weeks before the first periodic is before the term's first week.
    [anchored("before", 5, ["first-periodic", "second-periodic"]), [6]],
  ])("gives %j the weeks %j in 18 weeks", (due, weeks) => {
    expect(dueWeeks(due, TERM)).toEqual(weeks);
  });

  it("gives a weekly rule every week, and the periods' weeks in their order whatever the periods' order", () => {
    expect(dueWeeks({ type: "weekly" }, TERM)).toHaveLength(18);
    expect(
      dueWeeks(anchored("after", 2), {
        weeks: 18,
        periods: [...TERM.periods].reverse(),
      }),
    ).toEqual([8, 14, 18]);
  });
});

describe("departmentsReached", () => {
  it("joins each department's role holders and its sections' and courses' trainers, a department with sections and no one in it yet too", () => {
    expect(
      departmentsReached(
        [
          { departmentId: "a", roleId: "trainer", count: 4 },
          { departmentId: "a", roleId: "head", count: 1 },
          { departmentId: "b", roleId: "trainer", count: 2 },
        ],
        { a: { trainers: 11, courses: 6 }, c: { trainers: 3, courses: 2 } },
      ),
    ).toEqual([
      {
        roles: { trainer: 4, head: 1 },
        sectionTrainers: 11,
        courseTrainers: 6,
      },
      { roles: {}, sectionTrainers: 3, courseTrainers: 2 },
      { roles: { trainer: 2 }, sectionTrainers: 0, courseTrainers: 0 },
    ]);
  });
});

describe("countTasks", () => {
  it("counts each item for each holder or section, each time it is due, and the departments it reaches", () => {
    const electrical = {
      roles: { [TRAINER]: 12, [HEAD]: 1 },
      sectionTrainers: 0,
      courseTrainers: 0,
    };
    const mechanical = {
      roles: { [TRAINER]: 8, [HEAD]: 1 },
      sectionTrainers: 0,
      courseTrainers: 0,
    };
    const general = { roles: {}, sectionTrainers: 0, courseTrainers: 0 };
    expect(
      countTasks(
        [
          // A grade analysis a week after each exam period, for every trainer: three, as the
          // theoretical final ends the term: 3 × (12 + 8).
          { appliesTo: trainers, due: anchored("after", 1) },
          // A monthly report from each head: 4 × (1 + 1).
          { appliesTo: heads, due: { type: "everyWeeks", every: 4 } },
          // Each section's homework in week 5: no sections until Rayat's import.
          {
            appliesTo: { type: "eachSection" },
            due: { type: "week", week: 5 },
          },
        ],
        [electrical, mechanical, general],
        TERM,
      ),
    ).toEqual({ tasks: 68, departments: 2 });
  });

  it("counts nothing for no items, each trainer of each section once there are sections, and each trainer of each course once for all its sections", () => {
    // 29 sections, one of them taught by two trainers, of 12 trainers' courses.
    const sections = { roles: {}, sectionTrainers: 30, courseTrainers: 12 };
    expect(countTasks([], [sections], TERM)).toEqual({
      tasks: 0,
      departments: 0,
    });
    // 30 trainers' tasks each week.
    expect(
      countTasks(
        [{ appliesTo: { type: "eachSection" }, due: { type: "weekly" } }],
        [sections],
        TERM,
      ),
    ).toEqual({ tasks: 540, departments: 1 });
    // An exam copy for each course the week before each exam period: 12 × 4.
    expect(
      countTasks(
        [{ appliesTo: { type: "eachCourse" }, due: anchored("before", 1) }],
        [sections],
        TERM,
      ),
    ).toEqual({ tasks: 48, departments: 1 });
  });
});

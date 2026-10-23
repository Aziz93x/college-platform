import { describe, expect, it } from "vitest";
import {
  busiestWeek,
  countTasks,
  departmentsReached,
  dueWeeks,
  occurrences,
  weeksOutside,
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
// A department with so many holders of each role and trainers of its sections and courses, and its
// lab supervisor, who holds a role there.
const SUPERVISOR = "0199b2a4-0000-7000-8000-000000000003";
const department = (
  roles: Record<string, number>,
  sectionTrainers = 0,
  courseTrainers = 0,
) => ({
  departmentId: "d",
  roles,
  people: new Set([SUPERVISOR]),
  sectionTrainers,
  courseTrainers,
});

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

describe("weeksOutside", () => {
  it.each<[DueRule, number]>([
    [{ type: "week", week: 18 }, 0],
    [{ type: "week", week: 19 }, 1],
    [{ type: "weekly" }, 0],
    [{ type: "everyWeeks", every: 5 }, 0],
    // The theoretical final's analysis a week after it, and the first periodic's questions five
    // weeks before it, fall outside the 18 weeks.
    [anchored("after", 1), 1],
    [anchored("before", 5, ["first-periodic", "second-periodic"]), 1],
    [anchored("before", 1), 0],
  ])("counts the times %j falls outside 18 weeks: %d", (due, outside) => {
    expect(weeksOutside(due, TERM)).toBe(outside);
  });
});

describe("departmentsReached", () => {
  it("joins each department's role holders, by account, and its sections' and courses' trainers, a department with sections and no one in it yet too", () => {
    expect(
      departmentsReached(
        [
          ...["u1", "u2", "u3", "u4"].map((userId) => ({
            departmentId: "a",
            roleId: "trainer",
            userId,
          })),
          // The head teaches too.
          { departmentId: "a", roleId: "head", userId: "u1" },
          ...["u5", "u6"].map((userId) => ({
            departmentId: "b",
            roleId: "trainer",
            userId,
          })),
        ],
        { a: { trainers: 11, courses: 6 }, c: { trainers: 3, courses: 2 } },
      ),
    ).toEqual([
      {
        departmentId: "a",
        roles: { trainer: 4, head: 1 },
        people: new Set(["u1", "u2", "u3", "u4"]),
        sectionTrainers: 11,
        courseTrainers: 6,
      },
      {
        departmentId: "c",
        roles: {},
        people: new Set(),
        sectionTrainers: 3,
        courseTrainers: 2,
      },
      {
        departmentId: "b",
        roles: { trainer: 2 },
        people: new Set(["u5", "u6"]),
        sectionTrainers: 0,
        courseTrainers: 0,
      },
    ]);
  });
});

describe("countTasks", () => {
  it("counts each item for each holder or section, each time it is due, and the departments it reaches", () => {
    const electrical = department({ [TRAINER]: 12, [HEAD]: 1 });
    const mechanical = department({ [TRAINER]: 8, [HEAD]: 1 });
    const general = department({});
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
    const sections = department({}, 30, 12);
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

  it("counts an item for one person once where they hold a role, and nowhere else (Step 19)", () => {
    const item = {
      appliesTo: { type: "person" as const, userId: SUPERVISOR },
      due: { type: "everyWeeks" as const, every: 6 },
    };
    expect(countTasks([item], [department({})], TERM)).toEqual({
      tasks: 3,
      departments: 1,
    });
    expect(
      countTasks(
        [item],
        [{ ...department({}), people: new Set<string>() }],
        TERM,
      ),
    ).toEqual({ tasks: 0, departments: 0 });
  });
});

describe("busiestWeek", () => {
  it("finds the week whose tasks are the most, the earliest of equals, and none for no task (Audit 7)", () => {
    const electrical = department({ [TRAINER]: 12, [HEAD]: 1 });
    // A head's report every 4 weeks (4, 8, 12, 16), and each trainer's exam copy the week before
    // each exam period (4, 10, 15, 16): week 4 has 13, and week 16 has 13 too, so week 4.
    expect(
      busiestWeek(
        [
          { appliesTo: heads, due: { type: "everyWeeks", every: 4 } },
          { appliesTo: trainers, due: anchored("before", 1) },
        ],
        [electrical],
        TERM,
      ),
    ).toEqual({ week: 4, tasks: 13 });
    // The eve of the practical final (week 15) and of the theoretical final (week 16): 12 tasks
    // each, so the earlier.
    expect(
      busiestWeek(
        [
          {
            appliesTo: trainers,
            due: anchored("before", 1, ["practical-final"]),
          },
          {
            appliesTo: trainers,
            due: anchored("before", 1, ["theoretical-final"]),
          },
        ],
        [electrical],
        TERM,
      ),
    ).toEqual({ week: 15, tasks: 12 });
    expect(busiestWeek([], [electrical], TERM)).toBeUndefined();
    expect(
      busiestWeek(
        [{ appliesTo: { type: "eachSection" }, due: { type: "weekly" } }],
        [department({})],
        TERM,
      ),
    ).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { countTasks, departmentsReached, occurrences } from "./count.ts";
import type { AppliesTo, DueRule } from "./inputs.ts";

const TRAINER = "0199b2a4-0000-7000-8000-000000000001";
const HEAD = "0199b2a4-0000-7000-8000-000000000002";
// An 18-week term with its midterms in week 8 and its finals in week 18.
const TERM = { weeks: 18, events: { exam: [8, 18], holiday: [4] } };
const trainers: AppliesTo = { type: "role", roleId: TRAINER };
const heads: AppliesTo = { type: "role", roleId: HEAD };

describe("occurrences", () => {
  it.each<[DueRule, number]>([
    [{ type: "week", week: 3 }, 1],
    [{ type: "week", week: 19 }, 0],
    [{ type: "weekly" }, 18],
    [{ type: "everyWeeks", every: 4 }, 4],
    [{ type: "afterEvent", eventKind: "exam", weeks: 0 }, 2],
    // A week after the finals is past the term (Audit 5).
    [{ type: "afterEvent", eventKind: "exam", weeks: 1 }, 1],
    [{ type: "afterEvent", eventKind: "gradeDeadline", weeks: 0 }, 0],
  ])("counts %j %i times in 18 weeks", (due, times) => {
    expect(occurrences(due, TERM)).toBe(times);
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
          // A grade analysis a week after each exam, for every trainer: the midterms' only, as the
          // finals end the term: 1 × (12 + 8).
          {
            appliesTo: trainers,
            due: { type: "afterEvent", eventKind: "exam", weeks: 1 },
          },
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
    ).toEqual({ tasks: 28, departments: 2 });
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
    // An exam copy for each course after each exam: 12 × 2.
    expect(
      countTasks(
        [
          {
            appliesTo: { type: "eachCourse" },
            due: { type: "afterEvent", eventKind: "exam", weeks: 0 },
          },
        ],
        [sections],
        TERM,
      ),
    ).toEqual({ tasks: 24, departments: 1 });
  });
});

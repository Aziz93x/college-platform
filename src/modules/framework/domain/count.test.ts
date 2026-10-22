import { describe, expect, it } from "vitest";
import { countTasks, occurrences } from "./count.ts";
import type { AppliesTo, DueRule } from "./inputs.ts";

const TRAINER = "0199b2a4-0000-7000-8000-000000000001";
const HEAD = "0199b2a4-0000-7000-8000-000000000002";
// An 18-week term with a midterm and a final exam week.
const TERM = { weeks: 18, events: { exam: 2, holiday: 1 } };
const trainers: AppliesTo = { type: "role", roleId: TRAINER };
const heads: AppliesTo = { type: "role", roleId: HEAD };

describe("occurrences", () => {
  it.each<[DueRule, number]>([
    [{ type: "week", week: 3 }, 1],
    [{ type: "week", week: 19 }, 0],
    [{ type: "weekly" }, 18],
    [{ type: "everyWeeks", every: 4 }, 4],
    [{ type: "afterEvent", eventKind: "exam", weeks: 1 }, 2],
    [{ type: "afterEvent", eventKind: "gradeDeadline", weeks: 0 }, 0],
  ])("counts %j %i times in 18 weeks", (due, times) => {
    expect(occurrences(due, TERM)).toBe(times);
  });
});

describe("countTasks", () => {
  it("counts each item for each holder or section, each time it is due, and the departments it reaches", () => {
    const electrical = { roles: { [TRAINER]: 12, [HEAD]: 1 }, sections: 0 };
    const mechanical = { roles: { [TRAINER]: 8, [HEAD]: 1 }, sections: 0 };
    const general = { roles: {}, sections: 0 };
    expect(
      countTasks(
        [
          // A grade analysis after each exam week, for every trainer: 2 × (12 + 8).
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
    ).toEqual({ tasks: 48, departments: 2 });
  });

  it("counts nothing for no items, and sections once there are some", () => {
    expect(countTasks([], [{ roles: {}, sections: 30 }], TERM)).toEqual({
      tasks: 0,
      departments: 0,
    });
    expect(
      countTasks(
        [{ appliesTo: { type: "eachSection" }, due: { type: "weekly" } }],
        [{ roles: {}, sections: 30 }],
        TERM,
      ),
    ).toEqual({ tasks: 540, departments: 1 });
  });
});

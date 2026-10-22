import type { AppliesTo, DueRule } from "./inputs.ts";

// What a department holds that items reach: how many hold each role in it, and its sections.
export type Department = {
  roles: Readonly<Record<string, number>>;
  sections: number;
};

// What each department holds that items reach, from how many hold each role in it and how many
// sections it has in SS01 in force (Step 17): a department with sections and no one in it yet
// counts too.
export function departmentsReached(
  members: readonly { departmentId: string; roleId: string; count: number }[],
  sections: Readonly<Record<string, number>>,
): Department[] {
  const all: Record<
    string,
    { roles: Record<string, number>; sections: number }
  > = {};
  for (const [departmentId, count] of Object.entries(sections)) {
    all[departmentId] = { roles: {}, sections: count };
  }
  for (const { departmentId, roleId, count } of members) {
    all[departmentId] ??= { roles: {}, sections: 0 };
    all[departmentId].roles[roleId] = count;
  }
  return Object.values(all);
}

// What the term holds that rules count on: its numbered weeks, and for each kind of day of its
// calendar, the last numbered week of each such day.
export type TermShape = {
  weeks: number;
  events: Readonly<Record<string, readonly number[]>>;
};

// How many times a rule is due in the term: a task due past its last week is not one of its tasks
// (Audit 5).
export function occurrences(due: DueRule, term: TermShape) {
  switch (due.type) {
    case "week":
      return due.week <= term.weeks ? 1 : 0;
    case "weekly":
      return term.weeks;
    case "everyWeeks":
      return Math.floor(term.weeks / due.every);
    case "afterEvent":
      return (term.events[due.eventKind] ?? []).filter(
        (week) => week + due.weeks <= term.weeks,
      ).length;
  }
}

// How many an item reaches in a department.
function reached(applies: AppliesTo, department: Department) {
  return applies.type === "eachSection"
    ? department.sections
    : (department.roles[applies.roleId] ?? 0);
}

// The tasks a framework or a plan creates (the impact preview, and the generation engine's count):
// each item, in each department, once for each person or section it reaches and each time it is
// due; and how many departments get any.
export function countTasks(
  items: readonly { appliesTo: AppliesTo; due: DueRule }[],
  departments: readonly Department[],
  term: TermShape,
) {
  let tasks = 0;
  let touched = 0;
  for (const department of departments) {
    const here = items.reduce(
      (sum, item) =>
        sum + reached(item.appliesTo, department) * occurrences(item.due, term),
      0,
    );
    tasks += here;
    if (here > 0) touched += 1;
  }
  return { tasks, departments: touched };
}

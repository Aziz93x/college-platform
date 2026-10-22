import type { AppliesTo, DueRule } from "./inputs.ts";

// What a department holds that items reach: how many hold each role in it, and its sections'
// trainers, each trainer of each section counted once.
export type Department = {
  roles: Readonly<Record<string, number>>;
  sectionTrainers: number;
};

// What each department holds that items reach, from how many hold each role in it and how many
// trainers its sections have in SS01 in force (Step 17): a department with sections and no one in
// it yet counts too. A section with two trainers gives each of them its tasks, and one with none
// gives none (the owner's rule, lead review C).
export function departmentsReached(
  members: readonly { departmentId: string; roleId: string; count: number }[],
  sections: Readonly<Record<string, { trainers: number }>>,
): Department[] {
  const all: Record<
    string,
    { roles: Record<string, number>; sectionTrainers: number }
  > = {};
  for (const [departmentId, { trainers }] of Object.entries(sections)) {
    all[departmentId] = { roles: {}, sectionTrainers: trainers };
  }
  for (const { departmentId, roleId, count } of members) {
    all[departmentId] ??= { roles: {}, sectionTrainers: 0 };
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

// The weeks a rule is due in the term, in order, one for each time: a task due past its last week is
// not one of its tasks (Audit 5). The generation engine makes a task for each, so the preview counts
// these and nothing else (Step 20).
export function dueWeeks(due: DueRule, term: TermShape): number[] {
  switch (due.type) {
    case "week":
      return due.week <= term.weeks ? [due.week] : [];
    case "weekly":
      return Array.from({ length: term.weeks }, (_, index) => index + 1);
    case "everyWeeks":
      return Array.from(
        { length: Math.floor(term.weeks / due.every) },
        (_, index) => (index + 1) * due.every,
      );
    case "afterEvent":
      return (term.events[due.eventKind] ?? [])
        .map((week) => week + due.weeks)
        .filter((week) => week <= term.weeks)
        .sort((a, b) => a - b);
  }
}

// How many times a rule is due in the term.
export function occurrences(due: DueRule, term: TermShape) {
  return dueWeeks(due, term).length;
}

// How many an item reaches in a department.
function reached(applies: AppliesTo, department: Department) {
  return applies.type === "eachSection"
    ? department.sectionTrainers
    : (department.roles[applies.roleId] ?? 0);
}

// The tasks a framework or a plan creates (the impact preview, and the generation engine's count):
// each item, in each department, once for each person it reaches, or each trainer of each section,
// and each time it is due; and how many departments get any.
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

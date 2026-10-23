import type { ExamPeriod } from "../../terms/index.ts";
import type { AppliesTo, DueRule } from "./inputs.ts";

// What a department holds that items reach: how many hold each role in it, its sections' trainers,
// each trainer of each section counted once, and its courses' trainers, each trainer of each course
// counted once.
export type Department = {
  roles: Readonly<Record<string, number>>;
  sectionTrainers: number;
  courseTrainers: number;
};

// What each department holds that items reach, from how many hold each role in it and how many
// trainers its sections and its courses have in SS01 in force (Step 17): a department with sections
// and no one in it yet counts too. A section with two trainers gives each of them its tasks, and
// one with none gives none (the owner's rule, lead review C).
export function departmentsReached(
  members: readonly { departmentId: string; roleId: string; count: number }[],
  sections: Readonly<Record<string, { trainers: number; courses: number }>>,
): Department[] {
  const all: Record<string, Department & { roles: Record<string, number> }> =
    {};
  for (const [departmentId, { trainers, courses }] of Object.entries(
    sections,
  )) {
    all[departmentId] = {
      roles: {},
      sectionTrainers: trainers,
      courseTrainers: courses,
    };
  }
  for (const { departmentId, roleId, count } of members) {
    all[departmentId] ??= { roles: {}, sectionTrainers: 0, courseTrainers: 0 };
    all[departmentId].roles[roleId] = count;
  }
  return Object.values(all);
}

// What the term holds that rules count on: its numbered weeks, and its exam periods by week number.
export type TermShape = {
  weeks: number;
  periods: readonly ExamPeriod[];
};

// The weeks a rule is due in the term, in order, one for each time: a task due before its first week
// or past its last is not one of its tasks (Audit 5). The generation engine makes a task for each, so the preview counts
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
    case "examPeriods":
      return term.periods
        .filter((period) => due.periodTypes.includes(period.type))
        .map((period) =>
          due.side === "before"
            ? period.from - due.weeks
            : period.to + due.weeks,
        )
        .filter((week) => week >= 1 && week <= term.weeks)
        .sort((a, b) => a - b);
  }
}

// How many times a rule is due in the term.
export function occurrences(due: DueRule, term: TermShape) {
  return dueWeeks(due, term).length;
}

// How many an item reaches in a department.
function reached(applies: AppliesTo, department: Department) {
  switch (applies.type) {
    case "eachSection":
      return department.sectionTrainers;
    case "eachCourse":
      return department.courseTrainers;
    case "role":
      return department.roles[applies.roleId] ?? 0;
  }
}

// The tasks a framework or a plan creates (the impact preview, and the generation engine's count):
// each item, in each department, once for each person it reaches, each trainer of each section or
// each trainer of each course, and each time it is due; and how many departments get any.
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

import type { ExamPeriod } from "../../terms/index.ts";
import type { DueRule, PlanReach } from "./inputs.ts";

// What a department holds that items reach: how many hold each role in it, and who, by account; its
// sections' trainers, each trainer of each section counted once; and its courses' trainers, each
// trainer of each course counted once.
export type Department = {
  departmentId: string;
  roles: Readonly<Record<string, number>>;
  people: ReadonlySet<string>;
  sectionTrainers: number;
  courseTrainers: number;
};

// What each department holds that items reach, from the holders of each role in it, as the
// generation engine reads them (roleHolders()), and how many trainers its sections and its courses
// have in SS01 in force (Step 17): a department with sections and no one in it yet counts too. A
// section with two trainers gives each of them its tasks, and one with none gives none (the owner's
// rule, lead review C).
export function departmentsReached(
  holders: readonly { departmentId: string; roleId: string; userId: string }[],
  sections: Readonly<Record<string, { trainers: number; courses: number }>>,
): Department[] {
  const all = new Map<
    string,
    Department & { roles: Record<string, number>; people: Set<string> }
  >();
  const of = (departmentId: string) => {
    const found = all.get(departmentId) ?? {
      departmentId,
      roles: {},
      people: new Set<string>(),
      sectionTrainers: 0,
      courseTrainers: 0,
    };
    all.set(departmentId, found);
    return found;
  };
  for (const [departmentId, { trainers, courses }] of Object.entries(
    sections,
  )) {
    of(departmentId).sectionTrainers = trainers;
    of(departmentId).courseTrainers = courses;
  }
  for (const { departmentId, roleId, userId } of holders) {
    const department = of(departmentId);
    department.roles[roleId] = (department.roles[roleId] ?? 0) + 1;
    department.people.add(userId);
  }
  return [...all.values()];
}

// What the term holds that rules count on: its numbered weeks, and its exam periods by week number.
export type TermShape = {
  weeks: number;
  periods: readonly ExamPeriod[];
};

// The weeks a rule names, one for each time, before or past the term's weeks too.
function namedWeeks(due: DueRule, term: TermShape): number[] {
  switch (due.type) {
    case "week":
      return [due.week];
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
        );
  }
}

// The weeks a rule is due in the term, in order, one for each time: a task due before its first week
// or past its last is not one of its tasks (Audit 5). The generation engine makes a task for each, so the preview counts
// these and nothing else (Step 20).
export function dueWeeks(due: DueRule, term: TermShape): number[] {
  return namedWeeks(due, term)
    .filter((week) => week >= 1 && week <= term.weeks)
    .sort((a, b) => a - b);
}

// How many times a rule names a week before the term's first or past its last, which are not its
// tasks: a department plan's editor flags such an item (the owner's notes, 21 October 2026).
export function weeksOutside(due: DueRule, term: TermShape) {
  return namedWeeks(due, term).length - dueWeeks(due, term).length;
}

// How many times a rule is due in the term.
export function occurrences(due: DueRule, term: TermShape) {
  return dueWeeks(due, term).length;
}

// How many an item reaches in a department.
function reached(applies: PlanReach, department: Department) {
  switch (applies.type) {
    case "eachSection":
      return department.sectionTrainers;
    case "eachCourse":
      return department.courseTrainers;
    case "role":
      return department.roles[applies.roleId] ?? 0;
    case "person":
      return department.people.has(applies.userId) ? 1 : 0;
  }
}

// The tasks a framework or a plan creates (the impact preview, and the generation engine's count):
// each item, in each department, once for each person it reaches, each trainer of each section or
// each trainer of each course, and each time it is due; and how many departments get any. A plan's
// preview gives it its own department alone.
export function countTasks(
  items: readonly { appliesTo: PlanReach; due: DueRule }[],
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

// The week whose tasks are the most, and how many, the earliest of equals: the review load's peak
// beside its average, as countTasks() counts them (Audit 7, enhancement 2). None for no task.
export function busiestWeek(
  items: readonly { appliesTo: PlanReach; due: DueRule }[],
  departments: readonly Department[],
  term: TermShape,
) {
  const load = new Map<number, number>();
  for (const department of departments) {
    for (const item of items) {
      const each = reached(item.appliesTo, department);
      if (each === 0) continue;
      for (const week of dueWeeks(item.due, term)) {
        load.set(week, (load.get(week) ?? 0) + each);
      }
    }
  }
  let peak: { week: number; tasks: number } | undefined;
  for (const [week, tasks] of [...load].sort(([a], [b]) => a - b)) {
    if (!peak || tasks > peak.tasks) peak = { week, tasks };
  }
  return peak;
}

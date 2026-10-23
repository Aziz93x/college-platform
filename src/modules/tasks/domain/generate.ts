import { canonical } from "../../../platform/validation/text.ts";
import type {
  EvidencePolicy,
  PlanReach,
  TaskKind,
} from "../../framework/index.ts";
import { openStatuses, type TaskStatus } from "./status.ts";

// The generation engine's rules (docs/PLAN.md, section 3; Step 20), pure: the tasks a term's items
// call for, and what to change so that the term's tasks are those and no others, which running it
// again finds nothing to do for.

// An item as the engine reads it: its source, the framework, a department's plan, an assignment or
// a quick request, whose items reach their own department alone, or a request each department when
// it is the whole college's (Steps 19, 21 and 22); the item it was first entered as, which names its
// tasks in every version; what its tasks say, whom it reaches, the weeks its rule is due
// (dueWeeks()), and a request's own due day. A template's item assigned to several people is an item
// for each, with the same words, and so is a request to chosen people.
export type SourceItem = {
  source: TaskSource;
  departmentId?: string;
  origin: string;
  title: string;
  axisId: string;
  kind: TaskKind;
  appliesTo: ItemReach;
  weeks: readonly number[];
  dueOn?: string;
  evidence: EvidencePolicy;
};

// Whom an item reaches: as a plan's item does, or everyone who holds a role in the department but
// the person a quick request leaves out, its sender (Step 22).
type ItemReach = PlanReach | { type: "everyone"; except: string | null };

// Where a task comes from: the term's general framework, a department's plan (Step 19), a template
// assigned to a person (Step 21), or a quick request (Step 22, ADR-0025).
export type TaskSource = "framework" | "plan" | "assignment" | "request";

// What a department holds that items reach: the people who hold each role in it, and each of its
// sections with its course, by Rayat's code, and its places, each place by the trainer Rayat gave it
// at the term's start.
export type Reach = {
  departmentId: string;
  holders: Readonly<Record<string, readonly string[]>>;
  sections: readonly {
    ref: string;
    course: string;
    places: readonly string[];
  }[];
};

// A task's place in the term, its key: the item, the time its rule is due, the department, and the
// section or the course and the place it is for, or the holder of the role there, or the person.
// Its source says where its item is: items of either have ids of their own.
export type Slot = {
  source: TaskSource;
  item: string;
  occurrence: number;
  week: number;
  departmentId: string;
  sectionRef: string;
  courseCode: string;
  place: string;
  holderId: string | null;
};

export const slotKey = (slot: {
  item: string;
  occurrence: number;
  departmentId: string;
  sectionRef: string;
  courseCode: string;
  place: string;
  holderId: string | null;
}) =>
  [
    slot.item,
    slot.occurrence,
    slot.departmentId,
    slot.sectionRef,
    slot.courseCode,
    slot.place,
    slot.holderId ?? "",
  ].join("\u0000");

// Each course of a department's sections, by its code, with its places: each trainer its sections
// started the term with, once, and the sections where they did.
function coursesOf(sections: Reach["sections"]) {
  const courses = new Map<string, Map<string, string[]>>();
  for (const section of sections) {
    const places = courses.get(section.course) ?? new Map<string, string[]>();
    courses.set(section.course, places);
    for (const place of section.places) {
      places.set(place, [...(places.get(place) ?? []), section.ref]);
    }
  }
  return courses;
}

// The slots of a term's items: each item, in each department, or a plan's in its own, once for each
// person who holds its role, for each place of each section, for each place of each course, for
// the one person it names while they hold a role there, or for everyone who holds a role there but
// the one it leaves out, and each time it is due. countTasks() counts the same of the framework's
// and the plans' items.
export function slotsOf(
  items: readonly SourceItem[],
  reach: readonly Reach[],
): Slot[] {
  const slots: Slot[] = [];
  for (const department of reach) {
    const courses = coursesOf(department.sections);
    const people = new Set(Object.values(department.holders).flat());
    for (const item of items) {
      if (item.departmentId && item.departmentId !== department.departmentId) {
        continue;
      }
      item.weeks.forEach((week, index) => {
        const at = {
          source: item.source,
          item: item.origin,
          occurrence: index + 1,
          week,
          departmentId: department.departmentId,
          sectionRef: "",
          courseCode: "",
          place: "",
          holderId: null,
        };
        switch (item.appliesTo.type) {
          case "eachSection":
            for (const section of department.sections) {
              for (const place of section.places) {
                slots.push({ ...at, sectionRef: section.ref, place });
              }
            }
            break;
          case "eachCourse":
            for (const [courseCode, places] of courses) {
              for (const place of places.keys()) {
                slots.push({ ...at, courseCode, place });
              }
            }
            break;
          case "role":
            for (const holderId of department.holders[item.appliesTo.roleId] ??
              []) {
              slots.push({ ...at, holderId });
            }
            break;
          case "person":
            if (people.has(item.appliesTo.userId)) {
              slots.push({ ...at, holderId: item.appliesTo.userId });
            }
            break;
          case "everyone":
            for (const holderId of people) {
              if (holderId !== item.appliesTo.except) {
                slots.push({ ...at, holderId });
              }
            }
            break;
        }
      });
    }
  }
  return slots;
}

// Whom a task is for: an account, or a trainer by the employee number Rayat names them with, whose
// tasks wait for them while they are not on the platform.
type Assignee = { id: string | null; number: string | null };

// A slot's task as the term's items now call for it.
export type Wanted = Slot & {
  title: string;
  axisId: string;
  kind: TaskKind;
  dueOn: string;
  policy: EvidencePolicy;
  assignee: Assignee;
};

// What the term counts on: the numbered week it has reached, the day a week's tasks are due, who
// holds a section's place in a week, and the account of a trainer's employee number.
export type TermNow = {
  week: number;
  dueOn: (week: number) => string;
  holder: (sectionRef: string, place: string, week: number) => string;
  account: (employeeNumber: string) => string | undefined;
};

// Who holds a course's place in a week: its trainer, while they still teach one of the sections they
// started the term with; once the last of those has moved, whoever holds the place they left in it
// (the owner's rule, 23 October 2026).
function courseHolder(
  sections: readonly string[],
  place: string,
  week: number,
  holder: TermNow["holder"],
) {
  for (let at = week; at >= 1; at--) {
    const kept = sections.find((ref) => holder(ref, place, at) === place);
    if (kept !== undefined) {
      return at === week ? place : holder(kept, place, week);
    }
  }
  return sections.length > 0 ? holder(sections[0], place, week) : place;
}

// The tasks the term's items call for. A section's task is for whoever holds its place in its week,
// and once its week has passed, for whoever holds the place now: work still to do goes with the
// section to the trainer a transfer gives it, from the week the transfer takes effect (Step 17). A
// course's task is for whoever holds its place the same way (courseHolder()).
export function wantedTasks(
  items: readonly SourceItem[],
  reach: readonly Reach[],
  term: TermNow,
): Wanted[] {
  const byOrigin = new Map(items.map((item) => [item.origin, item]));
  const courses = new Map(
    reach.map((department) => [
      department.departmentId,
      coursesOf(department.sections),
    ]),
  );
  return slotsOf(items, reach).map((slot) => {
    const item = byOrigin.get(slot.item) as SourceItem;
    let assignee: Assignee = { id: slot.holderId, number: null };
    if (slot.holderId === null) {
      const week = Math.max(slot.week, term.week);
      const number = slot.courseCode
        ? courseHolder(
            courses
              .get(slot.departmentId)
              ?.get(slot.courseCode)
              ?.get(slot.place) ?? [],
            slot.place,
            week,
            term.holder,
          )
        : term.holder(slot.sectionRef, slot.place, week);
      assignee = { id: term.account(number) ?? null, number };
    }
    return {
      ...slot,
      title: item.title,
      axisId: item.axisId,
      kind: item.kind,
      dueOn: item.dueOn ?? term.dueOn(slot.week),
      policy: item.evidence,
      assignee,
    };
  });
}

// A task as it stands, as the engine compares it.
export type Task = {
  id: string;
  item: string;
  occurrence: number;
  sectionRef: string;
  courseCode: string;
  place: string;
  holderId: string | null;
  departmentId: string;
  week: number;
  title: string;
  axisId: string;
  kind: string;
  dueOn: string;
  policy: EvidencePolicy;
  status: TaskStatus;
  cancelled: boolean;
  assignee: Assignee;
};

// What to change (section 3, re-publishing): new tasks for the slots that have none; the slot's
// current words, axis, kind, week, due day, evidence and person for a task not started, and a task
// cancelled before comes back so; another person for work started and still to do, as a transfer
// gives it; and a task its items no longer call for cancelled, when it has not been started.
// Finished work never changes, and neither does started work its items no longer call for.
export type Changes = {
  create: Wanted[];
  update: { id: string; wanted: Wanted }[];
  revive: { id: string; wanted: Wanted }[];
  reassign: { id: string; assignee: Assignee }[];
  cancel: string[];
};

const sameAssignee = (a: Assignee, b: Assignee) =>
  a.id === b.id && a.number === b.number;

const current = (task: Task, wanted: Wanted) =>
  task.week === wanted.week &&
  task.title === wanted.title &&
  task.axisId === wanted.axisId &&
  task.kind === wanted.kind &&
  task.dueOn === wanted.dueOn &&
  canonical(task.policy) === canonical(wanted.policy) &&
  sameAssignee(task.assignee, wanted.assignee);

export function reconcile(
  wanted: readonly Wanted[],
  tasks: readonly Task[],
): Changes {
  const changes: Changes = {
    create: [],
    update: [],
    revive: [],
    reassign: [],
    cancel: [],
  };
  const bySlot = new Map(tasks.map((task) => [slotKey(task), task]));
  const keys = new Set<string>();
  for (const each of wanted) {
    const key = slotKey(each);
    keys.add(key);
    const task = bySlot.get(key);
    if (!task) {
      changes.create.push(each);
    } else if (task.cancelled) {
      changes.revive.push({ id: task.id, wanted: each });
    } else if (task.status === "notStarted") {
      if (!current(task, each)) {
        changes.update.push({ id: task.id, wanted: each });
      }
    } else if (
      openStatuses.has(task.status) &&
      !sameAssignee(task.assignee, each.assignee)
    ) {
      changes.reassign.push({ id: task.id, assignee: each.assignee });
    }
  }
  for (const task of tasks) {
    if (
      !keys.has(slotKey(task)) &&
      !task.cancelled &&
      task.status === "notStarted"
    ) {
      changes.cancel.push(task.id);
    }
  }
  return changes;
}

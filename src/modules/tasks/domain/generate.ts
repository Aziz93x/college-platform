import type {
  AppliesTo,
  EvidencePolicy,
  TaskKind,
} from "../../framework/index.ts";
import { openStatuses, type TaskStatus } from "./status.ts";

// The generation engine's rules (docs/PLAN.md, section 3; Step 20), pure: the tasks a term's items
// call for, and what to change so that the term's tasks are those and no others, which running it
// again finds nothing to do for.

// An item as the engine reads it: the item it was first entered as, which names its tasks in every
// version, what its tasks say, whom it reaches, and the weeks its rule is due (dueWeeks()).
export type SourceItem = {
  origin: string;
  title: string;
  axisId: string;
  kind: TaskKind;
  appliesTo: AppliesTo;
  weeks: readonly number[];
  evidence: EvidencePolicy;
};

// What a department holds that items reach: the people who hold each role in it, and each of its
// sections with its places, each place by the trainer Rayat gave it at the term's start.
export type Reach = {
  departmentId: string;
  holders: Readonly<Record<string, readonly string[]>>;
  sections: readonly { ref: string; places: readonly string[] }[];
};

// A task's place in the term, its key: the item, the time its rule is due, the department, and the
// section and place it is for, or the holder of the role there.
export type Slot = {
  item: string;
  occurrence: number;
  week: number;
  departmentId: string;
  sectionRef: string;
  place: string;
  holderId: string | null;
};

export const slotKey = (slot: {
  item: string;
  occurrence: number;
  departmentId: string;
  sectionRef: string;
  place: string;
  holderId: string | null;
}) =>
  [
    slot.item,
    slot.occurrence,
    slot.departmentId,
    slot.sectionRef,
    slot.place,
    slot.holderId ?? "",
  ].join("\u0000");

// The slots of a term's items: each item, in each department, once for each person who holds its
// role, or for each place of each section, and each time it is due. countTasks() counts the same.
export function slotsOf(
  items: readonly SourceItem[],
  reach: readonly Reach[],
): Slot[] {
  const slots: Slot[] = [];
  for (const department of reach) {
    for (const item of items) {
      item.weeks.forEach((week, index) => {
        const at = { item: item.origin, occurrence: index + 1, week };
        const { departmentId } = department;
        if (item.appliesTo.type === "eachSection") {
          for (const section of department.sections) {
            for (const place of section.places) {
              slots.push({
                ...at,
                departmentId,
                sectionRef: section.ref,
                place,
                holderId: null,
              });
            }
          }
        } else {
          for (const holderId of department.holders[item.appliesTo.roleId] ??
            []) {
            slots.push({
              ...at,
              departmentId,
              sectionRef: "",
              place: "",
              holderId,
            });
          }
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

// The tasks the term's items call for. A section's task is for whoever holds its place in its week,
// and once its week has passed, for whoever holds the place now: work still to do goes with the
// section to the trainer a transfer gives it, from the week the transfer takes effect (Step 17).
export function wantedTasks(
  items: readonly SourceItem[],
  reach: readonly Reach[],
  term: TermNow,
): Wanted[] {
  const byOrigin = new Map(items.map((item) => [item.origin, item]));
  return slotsOf(items, reach).map((slot) => {
    const item = byOrigin.get(slot.item) as SourceItem;
    let assignee: Assignee = { id: slot.holderId, number: null };
    if (slot.holderId === null) {
      const number = term.holder(
        slot.sectionRef,
        slot.place,
        Math.max(slot.week, term.week),
      );
      assignee = { id: term.account(number) ?? null, number };
    }
    return {
      ...slot,
      title: item.title,
      axisId: item.axisId,
      kind: item.kind,
      dueOn: term.dueOn(slot.week),
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

// Two values the same, however a database kept their keys.
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_, each) =>
    each && typeof each === "object" && !Array.isArray(each)
      ? Object.fromEntries(
          Object.entries(each).sort(([a], [b]) => a.localeCompare(b)),
        )
      : each,
  );

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

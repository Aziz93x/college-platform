// A section's trainers and the transfers that change them (docs/PLAN.md, section 3). Trainers are
// named by their employee numbers, as Rayat names them.

// A head's transfer of a section: from the week it takes effect, the trainer with toNumber teaches
// it in place of the one with fromNumber. It was made, or last kept by the head, at `since`.
export type TransferChange = {
  fromNumber: string;
  toNumber: string;
  week: number;
  since: Date;
};

// What a transfer comes to against Rayat's SS01 in force (lead review C):
// - confirmed: Rayat names the new trainer and not the one replaced;
// - holds: it applies, and Rayat's file was uploaded before it was made or last kept, so it cannot
//   know of it yet;
// - conflict: it applies, and a file uploaded after it still names the trainer it replaced; it
//   applies until the head keeps or cancels it;
// - otherTrainer: the trainer it replaced no longer teaches the section by its week, so it changes
//   nothing.
export type TransferStatus =
  | "holds"
  | "confirmed"
  | "conflict"
  | "otherTrainer";

// A section's transfers read against the employee numbers Rayat's SS01 in force names for it, from
// a file uploaded at uploadedAt. The transfers come in the order they were made, and take effect
// by their weeks, those of one week in the order they were made.
//
// Each trainer Rayat names holds a place in the section. Rayat's names come after the transfers it
// confirms, so the term starts with those undone, the latest first. Each transfer then puts its
// new trainer in the place of the one it replaced, from its week on: a confirmed transfer in the
// place Rayat gave its new trainer, another where the trainer it replaced is by then. Gives each
// transfer's status, in the order given, and the section's trainers in a week.
export function readTransfers(
  rayat: readonly string[],
  uploadedAt: Date,
  transfers: readonly TransferChange[],
) {
  const order = transfers
    .map((transfer, index) => ({ transfer, index }))
    .sort((a, b) => a.transfer.week - b.transfer.week);
  const start = [...rayat];
  const confirmed = new Map<number, number>();
  for (const { transfer, index } of [...order].reverse()) {
    const place = start.indexOf(transfer.toNumber);
    if (place !== -1 && !start.includes(transfer.fromNumber)) {
      confirmed.set(index, place);
      start[place] = transfer.fromNumber;
    }
  }
  const statuses: TransferStatus[] = [];
  const steps: { week: number; place: number; number: string }[] = [];
  const places = [...start];
  for (const { transfer, index } of order) {
    const place = confirmed.get(index) ?? places.indexOf(transfer.fromNumber);
    if (place === -1) {
      statuses[index] = "otherTrainer";
      continue;
    }
    statuses[index] = confirmed.has(index)
      ? "confirmed"
      : transfer.since < uploadedAt
        ? "conflict"
        : "holds";
    places[place] = transfer.toNumber;
    steps.push({ week: transfer.week, place, number: transfer.toNumber });
  }
  return {
    statuses,
    trainersInWeek(week: number) {
      const trainers = [...start];
      for (const step of steps) {
        if (step.week <= week) trainers[step.place] = step.number;
      }
      return [...new Set(trainers)];
    },
  };
}

// A task's statuses (section 3); overdue is a flag on top of them, not one of them.
export type TaskStatus =
  | "notStarted"
  | "inProgress"
  | "submitted"
  | "done"
  | "returned"
  | "notApplicable";

// Work still to do: the trainer has not finished it, or it came back to them.
const open: ReadonlySet<TaskStatus> = new Set([
  "notStarted",
  "inProgress",
  "returned",
]);

// What a transfer does to the section's tasks (section 3): the replaced trainer's open tasks move to
// the new trainer, and their completed work stays with them, marked with the last week they taught
// the section. Other trainers' tasks do not change.
export function transferTasks<
  T extends { status: TaskStatus; assigneeId: string },
>(
  tasks: readonly T[],
  transfer: { fromId: string; toId: string; week: number },
): (T & { untilWeek?: number })[] {
  return tasks.map((task) => {
    if (task.assigneeId !== transfer.fromId) return task;
    return open.has(task.status)
      ? { ...task, assigneeId: transfer.toId }
      : { ...task, untilWeek: transfer.week - 1 };
  });
}

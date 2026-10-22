// A section's trainers and the transfers that change them (docs/PLAN.md, section 3). Trainers are
// named by their employee numbers, as Rayat names them.

// A head's transfer of a section: from the week it takes effect, the trainer with toNumber teaches
// it in place of the one with fromNumber.
export type TransferChange = {
  fromNumber: string;
  toNumber: string;
  week: number;
};

// A section's trainers in a week: Rayat's, each replaced by whom a transfer in force by that week
// gave the section. Transfers of one week replace in the order they come, the order they were made.
export function trainersInWeek(
  rayat: readonly string[],
  transfers: readonly TransferChange[],
  week: number,
) {
  return transfers
    .filter((transfer) => transfer.week <= week)
    .sort((a, b) => a.week - b.week)
    .reduce(
      (trainers, transfer) =>
        trainers.map((number) =>
          number === transfer.fromNumber ? transfer.toNumber : number,
        ),
      [...rayat],
    );
}

export type TransferStatus = "holds" | "confirmed" | "conflict";

// Whether Rayat agrees with a transfer. It holds until a version of SS01 applied after it was made,
// or after the head last kept it: that version confirms it when it names the new trainer and no
// longer the one replaced, and is in conflict with it otherwise, the section gone from it too.
export function transferStatus(
  transfer: { fromNumber: string; toNumber: string; since: Date },
  ss01:
    | { appliedAt: Date; trainers: readonly string[] | undefined }
    | undefined,
): TransferStatus {
  if (!ss01 || ss01.appliedAt <= transfer.since) return "holds";
  const trainers = ss01.trainers ?? [];
  return trainers.includes(transfer.toNumber) &&
    !trainers.includes(transfer.fromNumber)
    ? "confirmed"
    : "conflict";
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

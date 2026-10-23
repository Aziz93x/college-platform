// A task's statuses (docs/PLAN.md, section 3); overdue is a flag on top of them, not one of them.
export const taskStatuses = [
  "notStarted",
  "inProgress",
  "submitted",
  "done",
  "returned",
  "notApplicable",
] as const;
export type TaskStatus = (typeof taskStatuses)[number];

// Work still to do: its trainer has not finished it, or it came back to them. It goes with its
// section to the trainer who teaches it (Step 17); finished work stays with whoever did it.
export const openStatuses: ReadonlySet<TaskStatus> = new Set([
  "notStarted",
  "inProgress",
  "returned",
]);

// Why a term's tasks are generated again: the framework published, Rayat's SS01 applied or rolled
// back, a section transferred or the transfer cancelled, the term's exam periods changed, which the
// rules anchored to them move with, or the nightly pass over open terms.
export type GenerationReason =
  | "framework"
  | "ss01"
  | "transfer"
  | "periods"
  | "daily";

// A pass waits for the worker, runs, and ends done or failed.
export type GenerationStatus = "queued" | "running" | "done" | "failed";

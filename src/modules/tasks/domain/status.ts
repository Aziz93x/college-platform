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

// Why a term's tasks are generated again: the framework or a department's plan published, a
// template assigned, revoked or its items changed, a quick request sent, which generates at once
// (Step 22), Rayat's SS01 applied or rolled back, a section transferred or the transfer cancelled,
// the term's exam periods changed, which the rules anchored to them move with, the nightly pass over
// open terms, or an admin running a failed pass again from the system page (ADR-0029). Each has its
// words in the log and on /framework (tests/unit/generation-causes.test.ts).
export const generationReasons = [
  "framework",
  "plan",
  "assignment",
  "request",
  "ss01",
  "transfer",
  "periods",
  "daily",
  "admin",
] as const;
export type GenerationReason = (typeof generationReasons)[number];

// A pass waits for the worker, runs, and ends done or failed.
export type GenerationStatus = "queued" | "running" | "done" | "failed";

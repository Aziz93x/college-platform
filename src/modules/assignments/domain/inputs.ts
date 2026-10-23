import { z } from "zod";

// How many people one change may assign at once: it only keeps a slip of the keyboard out of the
// database. The service holds the weeks to the term's own.
export const assignmentLimits = { people: 500 } as const;

// A template given to people of a department for a term: the whole term, or from a week to a week
// of it (the owner's answers, 23 October 2026).
export const assignmentInput = z.object({
  templateId: z.uuid(),
  termId: z.uuid(),
  departmentId: z.uuid(),
  userIds: z
    .array(z.uuid())
    .min(1)
    .max(assignmentLimits.people)
    .refine((ids) => new Set(ids).size === ids.length),
  weeks: z
    .object({ from: z.int().min(1), to: z.int().min(1) })
    .refine(({ from, to }) => from <= to)
    .optional(),
});
export type AssignmentInput = z.infer<typeof assignmentInput>;

// The week an assignment's tasks are due in: its last, or the term's, and never past the term's
// end, which a calendar changed since may have brought forward.
export const dueWeekOf = (toWeek: number | null, termWeeks: number) =>
  Math.min(toWeek ?? termWeeks, termWeeks);

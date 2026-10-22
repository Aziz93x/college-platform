import { z } from "zod";
import { oneLine } from "../../../platform/validation/text.ts";

// The kinds of work the college asks for (docs/PLAN.md, section 3): capabilities, named by key.
// Step 18 gives each its payload, editor and view; a framework item names its kind.
export const taskKinds = [
  "general",
  "exam_copy",
  "grade_analysis",
  "homework",
  "e_learning",
  "training_practice",
  "advising_log",
  "meeting_minutes",
  "initiative",
  "professional_development",
  "profile_section",
] as const;
export type TaskKind = (typeof taskKinds)[number];

// The kinds of file evidence may be, as the upload will check them.
export const evidenceTypes = [
  "pdf",
  "image",
  "word",
  "excel",
  "powerpoint",
] as const;

// How long an item's words may be, how many weeks a rule may count and how many files evidence
// may hold. They only keep a slip of the keyboard out of the database.
export const frameworkLimits = {
  title: 200,
  notes: 1000,
  weeks: 52,
  files: 20,
} as const;

// Whom an item reaches: each holder of a role in each department, or each section's trainer.
const appliesTo = z.discriminatedUnion("type", [
  z.object({ type: z.literal("role"), roleId: z.uuid() }),
  z.object({ type: z.literal("eachSection") }),
]);
export type AppliesTo = z.infer<typeof appliesTo>;

// When an item is due: in a week of the term, every week, every so many weeks, or so many weeks
// after each day of the term's calendar of a kind, such as each exam week.
const dueRule = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("week"),
    week: z.int().min(1).max(frameworkLimits.weeks),
  }),
  z.object({ type: z.literal("weekly") }),
  z.object({
    type: z.literal("everyWeeks"),
    every: z.int().min(2).max(frameworkLimits.weeks),
  }),
  z.object({
    type: z.literal("afterEvent"),
    eventKind: z.string().min(1).max(40),
    weeks: z.int().min(0).max(frameworkLimits.weeks),
  }),
]);
export type DueRule = z.infer<typeof dueRule>;

// What evidence an item asks for: whether it is required, the kinds of file it accepts, how many,
// and whether the head approves it.
const evidencePolicy = z.object({
  required: z.boolean(),
  types: z.array(z.enum(evidenceTypes)).min(1),
  maxFiles: z.int().min(1).max(frameworkLimits.files),
  requiresApproval: z.boolean(),
});
export type EvidencePolicy = z.infer<typeof evidencePolicy>;

// A college-wide item of the framework, as the vice-dean enters it.
export const frameworkItemInput = z.object({
  title: z
    .string()
    .transform(oneLine)
    .pipe(z.string().min(1).max(frameworkLimits.title)),
  axisId: z.uuid(),
  kind: z.enum(taskKinds),
  appliesTo,
  due: dueRule,
  evidence: evidencePolicy,
  notes: z
    .string()
    .transform(oneLine)
    .pipe(z.string().max(frameworkLimits.notes)),
});
export type FrameworkItemInput = z.infer<typeof frameworkItemInput>;

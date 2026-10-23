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

// How long an item's words may be, how many weeks a rule may count, how many files evidence may
// hold, and how many items one change may move or take out. They only keep a slip of the keyboard
// out of the database.
export const frameworkLimits = {
  title: 200,
  notes: 1000,
  weeks: 52,
  files: 20,
  items: 500,
} as const;

// Whom an item reaches: each holder of a role in each department, each trainer of each section, or
// each trainer of each course once for all their sections of it. A course's work, such as its exam
// copies and training practices, goes into its portfolio as a whole, and a section's own, such as
// its grade analysis, section by section (the owner's answers, 22 October 2026).
const trainers = z.discriminatedUnion("type", [
  z.object({ type: z.literal("eachSection") }),
  z.object({ type: z.literal("eachCourse") }),
]);
export type TrainerReach = z.infer<typeof trainers>;
const appliesTo = z.union([
  z.object({ type: z.literal("role"), roleId: z.uuid() }),
  trainers,
]);
export type AppliesTo = z.infer<typeof appliesTo>;

// Whom a department plan's item reaches (Step 19): as a framework item does, or one person of the
// department by their account, while they hold a role in it.
const planReach = z.union([
  appliesTo,
  z.object({ type: z.literal("person"), userId: z.uuid() }),
]);
export type PlanReach = z.infer<typeof planReach>;

// Whether an item reaches trainers through their sections or courses, not a role's holders.
export const reachesTrainers = (applies: PlanReach): applies is TrainerReach =>
  applies.type === "eachSection" || applies.type === "eachCourse";

// When an item is due: in a week of the term, every week, every so many weeks, or so many weeks
// before or after each exam period of the types it names, by their codes, such as the exam's
// questions the week before each period and its analysis the week after it (the owner's notes,
// 21 October 2026). Such a rule moves with the periods when the vice-dean changes them.
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
    type: z.literal("examPeriods"),
    periodTypes: z
      .array(z.string().min(1).max(40))
      .min(1)
      .refine((types) => new Set(types).size === types.length),
    side: z.enum(["before", "after"]),
    weeks: z.int().min(0).max(frameworkLimits.weeks),
  }),
]);
export type DueRule = z.infer<typeof dueRule>;

// What evidence an item asks for: whether it is required, the file extensions it accepts, how many
// files, and whether the head approves it. The extensions are among the college's
// files.acceptedTypes, which the upload checks (Step 25); the item's service checks them against it.
const evidencePolicy = z.object({
  required: z.boolean(),
  types: z
    .array(z.string().regex(/^[a-z0-9]{1,10}$/))
    .min(1)
    .refine((types) => new Set(types).size === types.length),
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

// An item of a department's plan (Step 19), as its head enters it: a framework item's fields, and
// whom it reaches within the department. The section templates of Step 18 are its items for each
// section's or each course's trainer.
export const planItemInput = frameworkItemInput.extend({
  appliesTo: planReach,
});
export type PlanItemInput = z.infer<typeof planItemInput>;

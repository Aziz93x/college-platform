import { z } from "zod";
import { oneLine } from "../../../platform/validation/text.ts";

// A term moves from draft to active to closed; a college has one active term at most.
const termStatuses = ["draft", "active", "closed"] as const;
export type TermStatus = (typeof termStatuses)[number];

// What a day of a term's calendar is: a holiday, an exam week, the deadline for submitting grades,
// or an event of the college's own.
export const calendarEventKinds = [
  "holiday",
  "exam",
  "gradeDeadline",
  "custom",
] as const;
export type CalendarEventKind = (typeof calendarEventKinds)[number];

// How long a name may be and how many weeks a term may have. They only keep a slip of the keyboard
// out of the database; they are not a policy anyone sets.
export const termLimits = { name: 120, weeks: 52 } as const;

const line = (max: number) =>
  z.string().transform(oneLine).pipe(z.string().min(1).max(max));

// A calendar day, YYYY-MM-DD.
const day = z.iso.date();

// A term as the vice-dean enters it: its name as Rayat writes it, its first day and its weeks.
export const termInput = z.object({
  name: line(termLimits.name),
  startsOn: day,
  weeks: z.int().min(1).max(termLimits.weeks),
});

// A day or days of the term's calendar, the first no later than the last.
export const calendarEventInput = z
  .object({
    kind: z.enum(calendarEventKinds),
    title: line(termLimits.name),
    startsOn: day,
    endsOn: day,
  })
  .refine(({ startsOn, endsOn }) => startsOn <= endsOn, { path: ["endsOn"] });

export type TermInput = z.infer<typeof termInput>;
export type CalendarEventInput = z.infer<typeof calendarEventInput>;

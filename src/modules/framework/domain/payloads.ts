import { z } from "zod";
import {
  foldCase,
  oneLine,
  paragraph,
} from "../../../platform/validation/text.ts";
import { frameworkLimits, type TaskKind } from "./inputs.ts";

// How long a payload's words may be and how many entries its lists may hold. They only keep a slip
// of the keyboard out of the database. A band's trainees take as many digits as their limit has, so
// it is the most those digits write.
export const payloadLimits = {
  line: 200,
  paragraph: 2000,
  word: 100,
  words: 20,
  bands: 10,
  sessions: 50,
  count: 9_999,
} as const;
export type PayloadLimits = typeof payloadLimits;

// A field of what a task of a kind carries once its trainer fills it in: a line or a paragraph of
// text, a day, a week of the term, a percentage, a box ticked or not, a list of short entries, the
// trainees in each grade band, or advising sessions. An optional text may stay empty. Trainers
// write what they do in a course in their own words, its exam types, methods and kinds of
// development, and give each section's grade analysis its own bands: no college list holds them
// (the owner's answer, 22 October 2026).
export type PayloadField = { name: string } & (
  | { type: "line" | "paragraph"; optional?: true }
  | {
      type:
        | "day"
        | "week"
        | "percent"
        | "check"
        | "words"
        | "bands"
        | "sessions";
    }
);

// Each kind's fields, in the order the task card asks for them (docs/PLAN.md, section 3). The
// payload's schema comes from them here, and its editor and read view on the screen (Step 18).
// Files are the task's evidence, not its payload: an exam copy's paper and key, homework samples.
export const kindFields = {
  general: [{ name: "notes", type: "paragraph", optional: true }],
  exam_copy: [
    { name: "examType", type: "line" },
    { name: "examOn", type: "day" },
  ],
  // Counts and rates only: an analysis never names a trainee.
  grade_analysis: [
    { name: "examType", type: "line" },
    { name: "bands", type: "bands" },
    { name: "passRate", type: "percent" },
    { name: "average", type: "percent" },
    { name: "actions", type: "paragraph" },
  ],
  homework: [
    { name: "title", type: "line" },
    { name: "week", type: "week" },
  ],
  e_learning: [
    { name: "courseShell", type: "check" },
    { name: "content", type: "check" },
    { name: "activities", type: "check" },
  ],
  training_practice: [
    { name: "methods", type: "words" },
    { name: "description", type: "paragraph" },
  ],
  advising_log: [{ name: "sessions", type: "sessions" }],
  meeting_minutes: [
    { name: "meetingOn", type: "day" },
    { name: "summary", type: "paragraph" },
  ],
  initiative: [
    { name: "title", type: "line" },
    { name: "description", type: "paragraph" },
  ],
  professional_development: [
    { name: "developmentType", type: "line" },
    { name: "title", type: "line" },
    { name: "provider", type: "line", optional: true },
    { name: "on", type: "day" },
  ],
  profile_section: [{ name: "text", type: "paragraph" }],
} as const satisfies Record<TaskKind, readonly PayloadField[]>;

export type Payload = Record<string, unknown>;

const text = (tidy: (value: string) => string, max: number, optional = false) =>
  z
    .string()
    .transform(tidy)
    .pipe(
      z
        .string()
        .min(optional ? 0 : 1)
        .max(max),
    );
const day = z.iso.date();
const word = text(oneLine, payloadLimits.word);
const distinct = (values: readonly (string | number)[]) =>
  new Set(values.map((value) => foldCase(String(value)))).size ===
  values.length;

function fieldSchema(field: PayloadField): z.ZodType {
  switch (field.type) {
    case "line":
      return text(oneLine, payloadLimits.line, field.optional);
    case "paragraph":
      return text(paragraph, payloadLimits.paragraph, field.optional);
    case "day":
      return day;
    case "week":
      return z.int().min(1).max(frameworkLimits.weeks);
    case "percent":
      return z.number().min(0).max(100);
    case "check":
      return z.boolean();
    case "words":
      return z.array(word).min(1).max(payloadLimits.words).refine(distinct);
    // The trainees in each band by its lower bound, as the section's trainer gives the bands: at
    // least one trainee, each band once.
    case "bands":
      return z
        .array(
          z.object({
            from: z.int().min(0).max(99),
            count: z.int().min(0).max(payloadLimits.count),
          }),
        )
        .min(1)
        .max(payloadLimits.bands)
        .refine((bands) => distinct(bands.map(({ from }) => from)))
        .refine((bands) => bands.some(({ count }) => count > 0));
    case "sessions":
      return z
        .array(
          z.object({
            on: day,
            notes: text(paragraph, payloadLimits.paragraph),
          }),
        )
        .min(1)
        .max(payloadLimits.sessions);
  }
}

// The schema of a kind's payload: each of its fields, and nothing else.
export function payloadSchema(kind: TaskKind) {
  const fields: readonly PayloadField[] = kindFields[kind];
  return z.strictObject(
    Object.fromEntries(fields.map((field) => [field.name, fieldSchema(field)])),
  );
}

// A field's value before its trainer gives one, as its editor shows it: a box unticked, the week
// the task card opens in, an empty text or list. A day or a percentage shows nothing until chosen
// or typed, so it has none.
function blankValue(field: PayloadField, week: number): unknown {
  switch (field.type) {
    case "check":
      return false;
    case "week":
      return week;
    case "line":
    case "paragraph":
      return "";
    case "words":
    case "bands":
    case "sessions":
      return [];
    case "day":
    case "percent":
      return undefined;
  }
}

// What a task's payload holds before its trainer fills it in. The task card starts from it (Step
// 26), so what the editor shows is what the payload holds: a homework left at its week, or a
// checklist with a box left unticked, is still an answer its kind's schema takes.
export function blankPayload(
  fields: readonly PayloadField[],
  week: number,
): Payload {
  return Object.fromEntries(
    fields.flatMap((field) => {
      const value = blankValue(field, week);
      return value === undefined ? [] : [[field.name, value]];
    }),
  );
}

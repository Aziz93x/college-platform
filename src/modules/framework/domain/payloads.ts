import { z } from "zod";
import {
  foldCase,
  oneLine,
  paragraph,
} from "../../../platform/validation/text.ts";
import { frameworkLimits, type TaskKind } from "./inputs.ts";

// The college's catalogs (the settings catalogs.*, Step 18): the words a payload chooses from, and
// its grade bands, each band's lower bound in percent above 0.
export type Catalogs = {
  examTypes: readonly string[];
  trainingMethods: readonly string[];
  developmentTypes: readonly string[];
  gradeBands: readonly number[];
};
type WordCatalog = Exclude<keyof Catalogs, "gradeBands">;

// How long a payload's words may be and how many entries its lists may hold. They only keep a slip
// of the keyboard out of the database.
export const payloadLimits = {
  line: 200,
  paragraph: 2000,
  word: 100,
  choices: 20,
  sessions: 50,
  count: 10_000,
} as const;

// A field of what a task of a kind carries once its trainer fills it in: a line or a paragraph of
// text, a day, a week of the term, a percentage, a box ticked or not, a word from a catalog or
// several, the trainees in each grade band, or advising sessions. An optional text may stay empty.
export type PayloadField = { name: string } & (
  | { type: "line" | "paragraph"; optional?: true }
  | { type: "day" | "week" | "percent" | "check" | "bands" | "sessions" }
  | { type: "choice" | "choices"; catalog: WordCatalog }
);

// Each kind's fields, in the order the task card asks for them (docs/PLAN.md, section 3). The
// payload's schema comes from them here, and its editor and read view on the screen (Step 18).
// Files are the task's evidence, not its payload: an exam copy's paper and key, homework samples.
export const kindFields = {
  general: [{ name: "notes", type: "paragraph", optional: true }],
  exam_copy: [
    { name: "examType", type: "choice", catalog: "examTypes" },
    { name: "examOn", type: "day" },
  ],
  // Counts and rates only: an analysis never names a trainee.
  grade_analysis: [
    { name: "examType", type: "choice", catalog: "examTypes" },
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
    { name: "methods", type: "choices", catalog: "trainingMethods" },
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
    { name: "developmentType", type: "choice", catalog: "developmentTypes" },
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
    case "choice":
      return word;
    case "choices":
      return z.array(word).min(1).max(payloadLimits.choices).refine(distinct);
    // The trainees in each band by its lower bound: at least one trainee, each band once.
    case "bands":
      return z
        .array(
          z.object({
            from: z.int().min(0).max(99),
            count: z.int().min(0).max(payloadLimits.count),
          }),
        )
        .min(1)
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

// The college's grade bands, highest first: each from its lower bound to the bound above it, the
// highest to 100 and the lowest from 0.
export function gradeBands(bounds: readonly number[]) {
  const froms = [...new Set(bounds)]
    .filter((bound) => bound > 0 && bound < 100)
    .sort((a, b) => b - a);
  return [...froms, 0].map((from, index, all) => ({
    from,
    to: index === 0 ? 100 : all[index - 1],
  }));
}

// Whether a valid payload chooses only what the college's catalogs offer as they stand when it is
// saved, which may have changed since its editor opened: its types and methods among their words,
// and its grade bands the college's own.
export function fromCatalogs(
  kind: TaskKind,
  payload: Payload,
  catalogs: Catalogs,
) {
  const fields: readonly PayloadField[] = kindFields[kind];
  return fields.every((field) => {
    const value = payload[field.name];
    if (field.type === "choice") {
      return catalogs[field.catalog].includes(value as string);
    }
    if (field.type === "choices") {
      return (value as string[]).every((each) =>
        catalogs[field.catalog].includes(each),
      );
    }
    if (field.type === "bands") {
      const given = (value as { from: number }[]).map(({ from }) => from);
      const offered = gradeBands(catalogs.gradeBands).map(({ from }) => from);
      return (
        given.length === offered.length &&
        given.every((from) => offered.includes(from))
      );
    }
    return true;
  });
}

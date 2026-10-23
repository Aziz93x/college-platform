import { z } from "zod";
import { termLimits } from "./inputs.ts";

// An exam period of a term as the vice-dean sets it (the owner's notes, 21 October 2026): a type of
// the college's catalog, by its code, from a week of the term to a week, by their numbers. No
// period is fixed, and none is computed from the term's end.
const examPeriodInput = z
  .object({
    type: z.string().min(1).max(40),
    from: z.int().min(1).max(termLimits.weeks),
    to: z.int().min(1).max(termLimits.weeks),
  })
  .refine(({ from, to }) => from <= to, { path: ["to"] });

// A term's exam periods, each type once.
export const examPeriodsInput = z
  .array(examPeriodInput)
  .max(termLimits.weeks)
  .refine(
    (periods) =>
      new Set(periods.map(({ type }) => type)).size === periods.length,
  );

export type ExamPeriod = z.infer<typeof examPeriodInput>;

// What is wrong with a term's exam periods: each one past the term's last week, and each two that
// share a week. Both are errors on the vice-dean's screen; periods are saved with neither, and a
// term is activated with neither. Shortening a term moves no period, so a period it leaves past
// the end shows as one.
export function periodProblems(periods: readonly ExamPeriod[], weeks: number) {
  return {
    pastEnd: periods.filter((period) => period.to > weeks),
    overlaps: periods.flatMap((period, index) =>
      periods
        .slice(index + 1)
        .filter((other) => period.from <= other.to && other.from <= period.to)
        .map((other) => [period, other] as const),
    ),
  };
}

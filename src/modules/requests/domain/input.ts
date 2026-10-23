import { z } from "zod";
import { oneLine } from "../../../platform/validation/text.ts";

// How long a request's title may be, and how many people one request may name: they only keep a
// slip of the keyboard out of the database. The service holds the due day to the term's own days.
export const requestLimits = { title: 200, people: 500 } as const;

// Whom a quick request reaches (Step 22): everyone who holds a role in its department, or in each
// department when it is the whole college's; the holders of one role there; or chosen people, each
// in a department they hold a role in for the term.
const requestTargets = z.discriminatedUnion("type", [
  z.object({ type: z.literal("everyone") }),
  z.object({ type: z.literal("role"), roleId: z.uuid() }),
  z.object({
    type: z.literal("people"),
    people: z
      .array(z.object({ userId: z.uuid(), departmentId: z.uuid() }))
      .min(1)
      .max(requestLimits.people)
      .refine(
        (people) =>
          new Set(people.map(({ userId }) => userId)).size === people.length,
      ),
  }),
]);
export type RequestTargets = z.infer<typeof requestTargets>;

// An urgent request sent without the plan editor: its title, the axis its tasks count under (the
// sender's choice, the owner's answer of 23 October 2026), the day it is due, whom it reaches, and
// whether it asks for evidence. Without a department it is the whole college's.
export const quickRequestInput = z.object({
  termId: z.uuid(),
  departmentId: z.uuid().nullable(),
  title: z
    .string()
    .transform(oneLine)
    .pipe(z.string().min(1).max(requestLimits.title)),
  axisId: z.uuid(),
  dueOn: z.iso.date(),
  targets: requestTargets,
  evidence: z.boolean(),
});
export type QuickRequestInput = z.infer<typeof quickRequestInput>;

// Whether these targets fit the request's place: chosen people of a department's request are its
// own, and a role is held in a department, which the whole college's reaches in each of them.
export function targetsFit(
  targets: RequestTargets,
  departmentId: string | null,
) {
  return (
    targets.type !== "people" ||
    departmentId === null ||
    targets.people.every((person) => person.departmentId === departmentId)
  );
}

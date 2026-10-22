import { z } from "zod";
import { oneLine } from "../../../platform/validation/text.ts";

// How long a reason may be. The length only keeps a slip of the keyboard out of the database; it is
// not a policy anyone sets.
export const transferLengths = { reason: 300 } as const;

// A head's transfer of a section of the term (Step 17): the trainer it replaces, by the employee
// number the section names them with, the new trainer, the week it takes effect from, and why.
export const transferInput = z.object({
  termId: z.uuid(),
  sectionRef: z.string().transform(oneLine).pipe(z.string().min(1).max(40)),
  fromNumber: z.string().transform(oneLine).pipe(z.string().min(1).max(40)),
  toUserId: z.uuid(),
  week: z.int().min(1),
  reason: z
    .string()
    .transform(oneLine)
    .pipe(z.string().min(1).max(transferLengths.reason)),
});

export type TransferInput = z.infer<typeof transferInput>;

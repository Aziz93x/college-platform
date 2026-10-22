import { z } from "zod";
import { oneLine } from "../../../platform/validation/text.ts";

// How long an axis's title and description may be. They only keep a slip of the keyboard out of
// the database; they are not a policy anyone sets.
export const axisLimits = { title: 120, description: 500 } as const;

// An axis as the admin corrects it: its title, and a description that may be empty.
export const axisInput = z.object({
  title: z
    .string()
    .transform(oneLine)
    .pipe(z.string().min(1).max(axisLimits.title)),
  description: z
    .string()
    .transform(oneLine)
    .pipe(z.string().max(axisLimits.description)),
});
export type AxisInput = z.infer<typeof axisInput>;

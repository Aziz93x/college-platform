import { z } from "zod";
import { oneLine } from "../../../platform/validation/text.ts";

// One line of text, tidied as typed. The lengths only keep a slip of the keyboard out of the
// database; they are not a policy anyone sets.
const line = (max: number) =>
  z.string().transform(oneLine).pipe(z.string().min(1).max(max));

export const collegeInput = z.object({
  name: line(120),
  shortName: line(60),
});

export const departmentInput = z.object({
  name: line(100),
  shortName: line(40),
  // As Rayat's exports write the department in their department column: at least one, each once.
  rayatValues: z
    .array(line(100))
    .min(1)
    .max(20)
    .refine((values) => new Set(values).size === values.length),
  active: z.boolean(),
});

export type CollegeInput = z.infer<typeof collegeInput>;
export type DepartmentInput = z.infer<typeof departmentInput>;

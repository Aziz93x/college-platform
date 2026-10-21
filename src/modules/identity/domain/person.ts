import { z } from "zod";
import { toLatinDigits } from "../../../platform/validation/digits.ts";
import { oneLine } from "../../../platform/validation/text.ts";

// A person as admins type them, on a form or in a file: the name people read, the Microsoft 365
// address the person will sign in with (ADR-0008), and the employee number Rayat's reports carry,
// in either kind of digits. The lengths only keep a slip of the keyboard out of the database.
export const personName = z
  .string()
  .transform(oneLine)
  .pipe(z.string().min(1).max(120));

export const personEmail = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(254));

export const employeeNumber = z
  .string()
  .transform((value) => toLatinDigits(value).replace(/\s+/g, ""))
  .pipe(z.string().regex(/^\d{1,20}$/));

export const personInput = z.object({
  name: personName,
  email: personEmail,
  employeeNumber,
});

export type PersonInput = z.infer<typeof personInput>;

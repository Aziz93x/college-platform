import { toLatinDigits } from "../../../platform/validation/digits.ts";

// What a person types to sign in: their email or their employee number. An Arabic keyboard's digits
// are read as Latin ones, as everywhere else (docs/PLAN.md section 4).
export type Identifier =
  | { kind: "email"; email: string }
  | { kind: "employeeNumber"; employeeNumber: string };

export function parseIdentifier(typed: string): Identifier {
  const value = toLatinDigits(typed).trim();
  if (value.includes("@")) return { kind: "email", email: value.toLowerCase() };
  return { kind: "employeeNumber", employeeNumber: value.replace(/\s+/g, "") };
}

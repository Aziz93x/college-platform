import { z } from "zod";
import { toLatinDigits } from "./digits.ts";

// A server action's input as the object its schema reads. A <form action> sends FormData, before
// the page's JavaScript has loaded and after; a direct call sends the object itself.
export function formFields<T extends z.ZodType>(schema: T) {
  return z.preprocess(
    (value) => (value instanceof FormData ? Object.fromEntries(value) : value),
    schema,
  );
}

// A checkbox's field: present ("on") when checked, absent when not.
export const checkboxField = z
  .literal("on")
  .optional()
  .transform((value) => value === "on");

// Wraps an input schema so Arabic-Indic digits typed by the user are read, and stored, as Latin ones.
export function latinDigits<T extends z.ZodType>(schema: T) {
  return z.preprocess(
    (value) => (typeof value === "string" ? toLatinDigits(value) : value),
    schema,
  );
}

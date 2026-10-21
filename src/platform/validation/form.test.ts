import { describe, expect, it } from "vitest";
import { z } from "zod";
import { checkboxField, formFields, latinDigits } from "./form.ts";

const schema = formFields(
  z.object({ name: z.string(), remember: checkboxField }),
);

it("reads a form's fields, before or after the page's JavaScript, the same as an object", () => {
  const form = new FormData();
  form.set("name", "Sara");
  form.set("remember", "on");
  expect(schema.parse(form)).toEqual({ name: "Sara", remember: true });
  expect(schema.parse({ name: "Sara" })).toEqual({
    name: "Sara",
    remember: false,
  });
});

it("refuses a checkbox value a checkbox never sends", () => {
  expect(schema.safeParse({ name: "Sara", remember: "yes" }).success).toBe(
    false,
  );
});

describe("latinDigits", () => {
  it("lets a number schema read Arabic-Indic digits", () => {
    expect(latinDigits(z.coerce.number()).parse("١٢")).toBe(12);
  });

  it("lets a number schema read a decimal typed on an Arabic keyboard", () => {
    expect(latinDigits(z.coerce.number()).parse("٨٧٫٥")).toBe(87.5);
  });

  it("hands Latin digits to a string schema", () => {
    expect(latinDigits(z.string().regex(/^\d+$/)).parse("۲۰۲۶")).toBe("2026");
  });

  it("passes values that are not strings through unchanged", () => {
    const schema = latinDigits(z.unknown());
    const value = { week: "٧" };

    expect(schema.parse(7)).toBe(7);
    expect(schema.parse(value)).toBe(value);
    expect(schema.parse(null)).toBe(null);
  });
});

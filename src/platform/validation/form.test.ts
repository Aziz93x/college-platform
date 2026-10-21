import { expect, it } from "vitest";
import { z } from "zod";
import { checkboxField, formFields } from "./form.ts";

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

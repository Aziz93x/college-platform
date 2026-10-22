import { expect, it } from "vitest";
import { z } from "zod";
import { controlFor, settingControl } from "./controls.ts";

it.each([
  ["a yes or no", z.boolean(), { kind: "switch" }],
  [
    "a choice",
    z.enum(["sunday", "monday"]),
    { kind: "choice", options: ["sunday", "monday"] },
  ],
  [
    "a short count",
    z.int().min(3).max(20),
    { kind: "stepper", min: 3, max: 20 },
  ],
  [
    "a count of up to 100 steps",
    z.int().min(0).max(100),
    { kind: "stepper", min: 0, max: 100 },
  ],
  [
    "a wider count",
    z.int().min(1).max(1440),
    { kind: "number", min: 1, max: 1440 },
  ],
  [
    "a text",
    z.string().trim().max(40),
    { kind: "text", maxLength: 40, nullable: false },
  ],
  [
    "a text left empty for the default",
    z.string().max(80).nullable(),
    { kind: "text", maxLength: 80, nullable: true },
  ],
  ["a list of texts", z.array(z.string()).min(1), { kind: "list" }],
  [
    "a text for each field",
    z
      .object({ term: z.string().max(100), room: z.string().max(60) })
      .nullable(),
    { kind: "columns", fields: ["term", "room"], maxLength: 60 },
  ],
])("draws %s from its schema", (_name, schema, control) => {
  expect(controlFor(schema)).toEqual(control);
});

it("draws a percentage as a slider", () => {
  expect(controlFor(z.int().min(0).max(100), "percent")).toEqual({
    kind: "slider",
    min: 0,
    max: 100,
  });
});

it("draws no control for a map, which keeps its setting off the screen", () => {
  expect(controlFor(z.record(z.string(), z.array(z.string())))).toBeUndefined();
  expect(settingControl("navigation.order")).toBeUndefined();
});

it("reads each setting's own schema and unit", () => {
  expect(settingControl("auth.lockoutThreshold")).toEqual({
    kind: "stepper",
    min: 3,
    max: 20,
  });
  expect(settingControl("auth.lockoutMinutes")).toEqual({
    kind: "number",
    min: 1,
    max: 1440,
  });
  expect(settingControl("platform.name")).toEqual({
    kind: "text",
    maxLength: 80,
    nullable: true,
  });
  expect(settingControl("files.acceptedTypes")).toEqual({ kind: "list" });
});

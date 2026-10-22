import { expect, it } from "vitest";
import { readColumns, resettable, type SettingView } from "./setting-view.ts";

const fields = ["term", "department", "traineeStatus"];

it("reads a column map's headers on one line each, and names what is missing or repeated", () => {
  expect(
    readColumns(fields, {
      term: " Term  name ",
      department: "Department",
      traineeStatus: "Status",
    }),
  ).toEqual({
    value: {
      term: "Term name",
      department: "Department",
      traineeStatus: "Status",
    },
  });
  expect(
    readColumns(fields, { term: "Term", department: " ", traineeStatus: "S" }),
  ).toEqual({ error: "columnsEmpty" });
  expect(readColumns(fields, { term: "Term", department: "Dept" })).toEqual({
    error: "columnsEmpty",
  });
  expect(
    readColumns(fields, {
      term: "Status",
      department: "Department",
      traineeStatus: " STATUS",
    }),
  ).toEqual({ error: "columnsRepeated" });
});

const view = (key: SettingView["key"], defaultValue: unknown): SettingView => ({
  key,
  group: "rayat",
  control: { kind: "switch" },
  value: null,
  defaultValue,
  needsPassword: false,
});

it("offers a reset only where there is a default to go back to", () => {
  expect(resettable(view("rayat.columns.sf01", null))).toBe(false);
  expect(resettable(view("platform.name", null))).toBe(true);
  expect(resettable(view("review.weeklyCap", 30))).toBe(true);
});

import { expect, it } from "vitest";
import {
  readColumns,
  readListItem,
  resettable,
  type SettingView,
} from "./setting-view.ts";

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

it("reads a file extension in Latin letters and digits, without its dot", () => {
  const control = { kind: "list", item: "extension" } as const;
  expect(readListItem(control, " .PDF ", [])).toEqual({ item: "pdf" });
  expect(readListItem(control, "mp٤", [])).toEqual({ item: "mp4" });
  expect(readListItem(control, "p d f", [])).toEqual({ problem: "format" });
  expect(readListItem(control, "pdf", ["pdf"])).toEqual({
    problem: "duplicate",
  });
  expect(readListItem(control, "  ", [])).toBeUndefined();
});

it("reads a catalog's word on one line, once in any case of its Latin letters", () => {
  const control = { kind: "list", item: "word", maxLength: 12 } as const;
  expect(readListItem(control, "  Case   study ", [])).toEqual({
    item: "Case study",
  });
  expect(readListItem(control, "case STUDY", ["Case study"])).toEqual({
    problem: "duplicate",
  });
  expect(readListItem(control, "x".repeat(13), [])).toEqual({
    problem: "tooLong",
  });
  expect(readListItem(control, " ", [])).toBeUndefined();
});

it("reads a whole percentage in the list's range, in either digits, its sign optional", () => {
  const control = { kind: "list", item: "percent", min: 1, max: 99 } as const;
  expect(readListItem(control, "60", [])).toEqual({ item: "60" });
  expect(readListItem(control, "٨٥٪", [])).toEqual({ item: "85" });
  expect(readListItem(control, "75 %", [])).toEqual({ item: "75" });
  for (const typed of ["0", "100", "60.5", "sixty"]) {
    expect(readListItem(control, typed, []), typed).toEqual({
      problem: "range",
    });
  }
  expect(readListItem(control, "60", ["60"])).toEqual({ problem: "duplicate" });
});

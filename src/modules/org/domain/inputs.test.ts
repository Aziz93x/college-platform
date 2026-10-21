import { expect, it } from "vitest";
import { collegeInput, departmentInput } from "./inputs.ts";

const department = (overrides: Record<string, unknown> = {}) => ({
  name: "Electrical",
  shortName: "Elec",
  rayatValues: ["Electrical"],
  active: true,
  ...overrides,
});

it("keeps what was typed, trimmed and with each run of spaces made one", () => {
  expect(
    departmentInput.parse(
      department({
        name: "  Electrical   Technology ",
        rayatValues: [" Electrical\tTechnology ", "Elec"],
      }),
    ),
  ).toEqual(
    department({
      name: "Electrical Technology",
      rayatValues: ["Electrical Technology", "Elec"],
    }),
  );
  expect(
    collegeInput.parse({ name: " Oasis  College ", shortName: "Oasis" }),
  ).toEqual({
    name: "Oasis College",
    shortName: "Oasis",
  });
});

it("refuses an empty name or short name, no Rayat value, and the same value twice", () => {
  for (const refused of [
    department({ name: "   " }),
    department({ shortName: "" }),
    department({ rayatValues: [] }),
    department({ rayatValues: [" "] }),
    // The same once trimmed.
    department({ rayatValues: ["Elec", " Elec "] }),
  ]) {
    expect(
      departmentInput.safeParse(refused).success,
      JSON.stringify(refused),
    ).toBe(false);
  }
});

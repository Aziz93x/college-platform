import { describe, expect, it } from "vitest";
import { quickRequestInput, targetsFit } from "./input.ts";

const ID = "0199b2a4-6c1e-7d3a-9f00-000000000001";
const OTHER = "0199b2a4-6c1e-7d3a-9f00-000000000002";
const request = {
  termId: ID,
  departmentId: ID,
  title: "  تسليم   كشوف الحضور  ",
  axisId: ID,
  dueOn: "2026-11-05",
  targets: { type: "everyone" },
  evidence: true,
};

describe("quickRequestInput", () => {
  it("takes a request's title on one line", () => {
    expect(quickRequestInput.parse(request).title).toBe("تسليم كشوف الحضور");
  });

  it.each([
    ["an empty title", { title: "   " }],
    ["a day that is no date", { dueOn: "2026-13-01" }],
    ["no one chosen", { targets: { type: "people", people: [] } }],
    [
      "someone chosen twice",
      {
        targets: {
          type: "people",
          people: [
            { userId: ID, departmentId: ID },
            { userId: ID, departmentId: OTHER },
          ],
        },
      },
    ],
  ])("refuses %s", (_, change) => {
    expect(quickRequestInput.safeParse({ ...request, ...change }).success).toBe(
      false,
    );
  });
});

describe("targetsFit", () => {
  const people = (departmentId: string) => ({
    type: "people" as const,
    people: [{ userId: ID, departmentId }],
  });

  it("keeps a department's chosen people to the department, and the whole college's to any", () => {
    expect(targetsFit(people(ID), ID)).toBe(true);
    expect(targetsFit(people(OTHER), ID)).toBe(false);
    expect(targetsFit(people(OTHER), null)).toBe(true);
    expect(targetsFit({ type: "everyone" }, ID)).toBe(true);
  });
});

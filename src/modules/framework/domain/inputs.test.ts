import { expect, it } from "vitest";
import { frameworkItemInput, planItemInput } from "./inputs.ts";

const item = {
  title: "Exam copy",
  axisId: "0199b2a4-0000-7000-8000-000000000001",
  kind: "exam_copy",
  due: { type: "week", week: 7 },
  evidence: {
    required: true,
    types: ["pdf"],
    maxFiles: 2,
    requiresApproval: true,
  },
  notes: "",
};
const role = { type: "role", roleId: "0199b2a4-0000-7000-8000-000000000002" };

it("lets a framework item reach a role's holders, each section's trainers or each course's", () => {
  for (const appliesTo of [
    role,
    { type: "eachSection" },
    { type: "eachCourse" },
  ]) {
    expect(frameworkItemInput.safeParse({ ...item, appliesTo }).success).toBe(
      true,
    );
  }
});

it("lets a department plan's item reach a role's holders, each section's or each course's trainers, or one person, and a framework item no one person (Step 19)", () => {
  const person = {
    type: "person",
    userId: "0199b2a4-0000-7000-8000-000000000003",
  };
  for (const appliesTo of [
    role,
    { type: "eachSection" },
    { type: "eachCourse" },
    person,
  ]) {
    expect(planItemInput.safeParse({ ...item, appliesTo }).success).toBe(true);
  }
  expect(
    frameworkItemInput.safeParse({ ...item, appliesTo: person }).success,
  ).toBe(false);
  expect(
    planItemInput.safeParse({
      ...item,
      appliesTo: { type: "person", userId: "someone" },
    }).success,
  ).toBe(false);
  expect(planItemInput.safeParse(item).success).toBe(false);
});

it("anchors a rule to one exam-period type or more, each once, before or after its periods", () => {
  const anchored = (due: object) =>
    frameworkItemInput.safeParse({
      ...item,
      appliesTo: { type: "eachCourse" },
      due: { type: "examPeriods", ...due },
    }).success;
  expect(
    anchored({ periodTypes: ["first-periodic"], side: "before", weeks: 1 }),
  ).toBe(true);
  expect(anchored({ periodTypes: ["final"], side: "after", weeks: 0 })).toBe(
    true,
  );
  expect(anchored({ periodTypes: [], side: "before", weeks: 1 })).toBe(false);
  expect(
    anchored({ periodTypes: ["final", "final"], side: "after", weeks: 1 }),
  ).toBe(false);
  expect(anchored({ periodTypes: ["final"], side: "during", weeks: 1 })).toBe(
    false,
  );
  // The rule it replaced (the owner's notes, 21 October 2026).
  expect(
    frameworkItemInput.safeParse({
      ...item,
      appliesTo: { type: "eachCourse" },
      due: { type: "afterEvent", eventKind: "exam", weeks: 1 },
    }).success,
  ).toBe(false);
});

import { expect, it } from "vitest";
import { frameworkItemInput, sectionTemplateInput } from "./inputs.ts";

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

it("lets a section template reach each section's or each course's trainers, never a role, and asks which", () => {
  for (const appliesTo of [{ type: "eachSection" }, { type: "eachCourse" }]) {
    expect(sectionTemplateInput.safeParse({ ...item, appliesTo }).success).toBe(
      true,
    );
  }
  expect(
    sectionTemplateInput.safeParse({ ...item, appliesTo: role }).success,
  ).toBe(false);
  expect(sectionTemplateInput.safeParse(item).success).toBe(false);
});

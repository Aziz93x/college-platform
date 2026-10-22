import { expect, it } from "vitest";
import { draftOf } from "./item-sheet.tsx";

const option = (value: string) => ({ value, label: value.toUpperCase() });
const options = {
  axes: [option("0199b2a4-0000-7000-8000-000000000001")],
  kinds: [option("general")],
  roles: [],
  eventKinds: [option("exam")],
  evidenceTypes: [option("pdf"), option("docx")],
  dueTypes: [option("week")],
};

it("opens an item with only the file types the college still accepts, and a new one with the first (Audit 5)", () => {
  const item = {
    title: "ملف المقرر",
    axisId: options.axes[0].value,
    kind: "general" as const,
    appliesTo: { type: "eachSection" as const },
    due: { type: "weekly" as const },
    evidence: {
      required: true,
      types: ["pptx", "pdf"],
      maxFiles: 1,
      requiresApproval: false,
    },
    notes: "",
  };
  expect(draftOf(item, options).types).toEqual(["pdf"]);
  expect(draftOf(undefined, options).types).toEqual(["pdf"]);
});

it("opens an item for each course's trainers on that reach, and a new one on each section's", () => {
  const item = {
    title: "نسخة الاختبار",
    axisId: options.axes[0].value,
    kind: "general" as const,
    appliesTo: { type: "eachCourse" as const },
    due: { type: "weekly" as const },
    evidence: {
      required: true,
      types: ["pdf"],
      maxFiles: 1,
      requiresApproval: false,
    },
    notes: "",
  };
  expect(draftOf(item, options).applies).toBe("eachCourse");
  expect(draftOf(undefined, options).applies).toBe("eachSection");
});

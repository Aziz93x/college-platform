import { describe, expect, it } from "vitest";
import { type TaskKind, taskKinds } from "./inputs.ts";
import {
  type Catalogs,
  fromCatalogs,
  gradeBands,
  kindFields,
  type Payload,
  payloadLimits,
  payloadSchema,
} from "./payloads.ts";

const catalogs: Catalogs = {
  examTypes: ["Midterm", "Final"],
  trainingMethods: ["Project", "Case study"],
  developmentTypes: ["Workshop"],
  gradeBands: [90, 80, 70, 60],
};
const bands = [
  { from: 90, count: 4 },
  { from: 80, count: 7 },
  { from: 70, count: 6 },
  { from: 60, count: 3 },
  { from: 0, count: 2 },
];

// A payload of each kind as a trainer fills it in.
const filled: Record<TaskKind, Payload> = {
  general: { notes: "" },
  exam_copy: { examType: "Midterm", examOn: "2026-11-15" },
  grade_analysis: {
    examType: "Midterm",
    bands,
    passRate: 90.9,
    average: 78.5,
    actions: "A make-up session for the two below the pass mark.",
  },
  homework: { title: "Wiring a three-way switch", week: 4 },
  e_learning: { courseShell: true, content: true, activities: false },
  training_practice: {
    methods: ["Project", "Case study"],
    description: "Each group wired a panel from its drawing.",
  },
  advising_log: {
    sessions: [{ on: "2026-10-05", notes: "Attendance and its rules." }],
  },
  meeting_minutes: { meetingOn: "2026-10-12", summary: "The midterm plan." },
  initiative: { title: "A safety day", description: "With the workshops." },
  professional_development: {
    developmentType: "Workshop",
    title: "Smart meters",
    provider: "",
    on: "2026-09-30",
  },
  profile_section: { text: "Twelve years in power distribution." },
};

describe("payloadSchema", () => {
  it.each(taskKinds)("accepts a filled %s", (kind) => {
    expect(payloadSchema(kind).safeParse(filled[kind]).success).toBe(true);
  });

  it.each(
    taskKinds,
  )("refuses a %s missing a field or with one of its own", (kind) => {
    const schema = payloadSchema(kind);
    for (const { name } of kindFields[kind]) {
      const { [name]: _, ...missing } = filled[kind];
      expect(schema.safeParse(missing).success, name).toBe(false);
    }
    expect(
      schema.safeParse({ ...filled[kind], traineeName: "x" }).success,
    ).toBe(false);
  });

  // Each field of each kind given what its type refuses.
  const refused: Record<string, unknown[]> = {
    line: ["", " ", "x".repeat(payloadLimits.line + 1), 7],
    paragraph: ["", "\n \n", "x".repeat(payloadLimits.paragraph + 1)],
    day: ["2026-13-01", "15/11/2026", ""],
    week: [0, 53, 2.5, "4"],
    percent: [-1, 100.5, "90"],
    check: ["yes", 1],
    choice: ["", "x".repeat(payloadLimits.word + 1)],
    choices: [
      [],
      ["Project", "project"],
      Array.from({ length: payloadLimits.choices + 1 }, (_, i) => `m${i}`),
    ],
    bands: [
      [],
      bands.map((band) => ({ ...band, count: 0 })),
      [...bands, { from: 90, count: 1 }],
      [{ from: 100, count: 1 }],
      [{ from: 90, count: -1 }],
    ],
    sessions: [[], [{ on: "2026-10-05", notes: "" }], [{ notes: "x" }]],
  };
  it.each(taskKinds)("refuses what each field of a %s cannot hold", (kind) => {
    const schema = payloadSchema(kind);
    for (const field of kindFields[kind]) {
      const values = refused[field.type].filter(
        (value) =>
          !("optional" in field && typeof value === "string" && !value.trim()),
      );
      for (const value of values) {
        expect(
          schema.safeParse({ ...filled[kind], [field.name]: value }).success,
          `${field.name}: ${JSON.stringify(value)}`,
        ).toBe(false);
      }
    }
  });

  it("keeps a line on one line and a paragraph's lines, each tidied", () => {
    expect(
      payloadSchema("homework").parse({ title: "  Ohm's   law ", week: 2 }),
    ).toEqual({ title: "Ohm's law", week: 2 });
    expect(
      payloadSchema("profile_section").parse({
        text: " First  line \r\n\n\n\n second line ",
      }),
    ).toEqual({ text: "First line\n\nsecond line" });
  });

  it("lets an optional text stay empty", () => {
    expect(
      payloadSchema("professional_development").parse({
        ...filled.professional_development,
        provider: "  ",
      }).provider,
    ).toBe("");
  });
});

describe("gradeBands", () => {
  it("runs from each bound to the one above, the highest to 100 and the lowest from 0", () => {
    expect(gradeBands([90, 80, 70, 60])).toEqual([
      { from: 90, to: 100 },
      { from: 80, to: 90 },
      { from: 70, to: 80 },
      { from: 60, to: 70 },
      { from: 0, to: 60 },
    ]);
  });

  it("reads bounds in any order, once each, and only above 0 and below 100", () => {
    expect(gradeBands([60, 85, 60, 0, 100])).toEqual([
      { from: 85, to: 100 },
      { from: 60, to: 85 },
      { from: 0, to: 60 },
    ]);
  });
});

describe("fromCatalogs", () => {
  it.each(
    taskKinds,
  )("accepts a %s that chooses from the college's catalogs", (kind) => {
    expect(fromCatalogs(kind, filled[kind], catalogs)).toBe(true);
  });

  it("refuses a type, a method or a development type the catalogs no longer offer", () => {
    expect(
      fromCatalogs(
        "exam_copy",
        { ...filled.exam_copy, examType: "Quiz" },
        catalogs,
      ),
    ).toBe(false);
    expect(
      fromCatalogs(
        "training_practice",
        { ...filled.training_practice, methods: ["Project", "Flipped"] },
        catalogs,
      ),
    ).toBe(false);
    expect(
      fromCatalogs(
        "professional_development",
        { ...filled.professional_development, developmentType: "Course" },
        catalogs,
      ),
    ).toBe(false);
  });

  it("refuses an analysis whose bands are not the college's, or not all of them", () => {
    for (const changed of [
      bands.slice(1),
      bands.map((band) => (band.from === 60 ? { ...band, from: 50 } : band)),
    ]) {
      expect(
        fromCatalogs(
          "grade_analysis",
          { ...filled.grade_analysis, bands: changed },
          catalogs,
        ),
      ).toBe(false);
    }
  });
});

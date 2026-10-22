import { describe, expect, it } from "vitest";
import { type TaskKind, taskKinds } from "./inputs.ts";
import {
  kindFields,
  type Payload,
  payloadLimits,
  payloadSchema,
} from "./payloads.ts";

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
    words: [
      [],
      ["Project", "project"],
      [""],
      ["x".repeat(payloadLimits.word + 1)],
      Array.from({ length: payloadLimits.words + 1 }, (_, i) => `m${i}`),
    ],
    bands: [
      [],
      bands.map((band) => ({ ...band, count: 0 })),
      [...bands, { from: 90, count: 1 }],
      [{ from: 100, count: 1 }],
      [{ from: 90, count: -1 }],
      Array.from({ length: payloadLimits.bands + 1 }, (_, i) => ({
        from: i * 9,
        count: 1,
      })),
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

it("keeps what the trainer writes, tidied, and the bands they give a section's analysis", () => {
  expect(
    payloadSchema("training_practice").parse({
      methods: ["  Case   study ", "Project"],
      description: "Groups.",
    }).methods,
  ).toEqual(["Case study", "Project"]);
  const own = [
    { from: 85, count: 9 },
    { from: 50, count: 12 },
    { from: 0, count: 1 },
  ];
  expect(
    payloadSchema("grade_analysis").parse({
      ...filled.grade_analysis,
      examType: "  Practical   exam ",
      bands: own,
    }),
  ).toMatchObject({ examType: "Practical exam", bands: own });
});

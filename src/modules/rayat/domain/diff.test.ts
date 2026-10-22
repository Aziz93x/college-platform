import { describe, expect, it } from "vitest";
import type { RayatSection } from "./check.ts";
import { DIFF_SAMPLES, diffRecords } from "./diff.ts";

const section: RayatSection = {
  departmentId: "electrical",
  courseCode: "ELC 101",
  courseName: "Circuits",
  creditHours: 3,
  sectionRef: "30111",
  deliveryMode: "In person",
  capacity: 30,
  enrolled: 28,
  meetings: [{ day: "Sunday", time: "08:00", building: "B1", room: "12" }],
  trainerNumbers: ["200101"],
};

describe("diffRecords", () => {
  it("counts the records added, removed, changed and left as they were, by key, with the fields that changed", () => {
    const before = [
      section,
      { ...section, sectionRef: "30112" },
      { ...section, sectionRef: "30113" },
    ];
    const after = [
      // A meeting read back from a jsonb column keeps its keys in another order.
      {
        ...section,
        meetings: [
          { room: "12", building: "B1", time: "08:00", day: "Sunday" },
        ],
      },
      { ...section, sectionRef: "30112", enrolled: 29, trainerNumbers: [] },
      { ...section, sectionRef: "30114" },
    ];
    expect(diffRecords("ss01", before, after)).toEqual({
      added: 1,
      removed: 1,
      changed: 1,
      unchanged: 1,
      samples: {
        added: [["30114"]],
        removed: [["30113"]],
        changed: [{ key: ["30112"], fields: ["enrolled", "trainerNumbers"] }],
      },
    });
  });

  it("matches keys in any case and names at most so many records of each change", () => {
    const enrollment = {
      departmentId: "electrical",
      courseCode: "ELC 101",
      sectionRef: "A1",
      traineeNumber: "441100001",
      registrationStatus: "Registered",
      traineeStatus: "Active",
    };
    const after = Array.from({ length: DIFF_SAMPLES + 5 }, (_, at) => ({
      ...enrollment,
      traineeNumber: String(at),
    }));
    const diff = diffRecords(
      "sf01",
      [{ ...enrollment, sectionRef: "a1", traineeNumber: "0" }],
      after,
    );
    expect(diff).toMatchObject({ added: DIFF_SAMPLES + 4, unchanged: 1 });
    expect(diff.samples.added).toHaveLength(DIFF_SAMPLES);
    expect(diff.samples.added[0]).toEqual(["A1", "1"]);
  });
});

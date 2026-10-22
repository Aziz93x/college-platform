import { describe, expect, it } from "vitest";
import { checkRayatRows, type RayatPlace } from "./check.ts";
import type { RayatRow } from "./read.ts";
import type { RayatField, RayatKind } from "./reports.ts";

const place: RayatPlace = {
  term: "Fall 1448",
  departments: [
    { id: "electrical", active: true, rayatValues: ["Electrical", "ELEC"] },
    { id: "old", active: false, rayatValues: ["Mechanical"] },
  ],
};

const section = {
  term: "Fall 1448",
  department: "Electrical",
  courseCode: "ELC 101",
  courseName: "Circuits",
  creditHours: "3",
  sectionRef: "30111",
  deliveryMode: "In person",
  day: "Sunday",
  time: "08:00-09:40",
  building: "B1",
  room: "12",
  capacity: "30",
  enrolled: "28",
  remaining: "2",
  trainerNumber: "200101",
};
const enrollment = {
  term: "Fall 1448",
  department: "Electrical",
  courseCode: "ELC 101",
  sectionRef: "30111",
  traineeNumber: "441100001",
  registrationStatus: "Registered",
  traineeStatus: "Active",
};
const absence = {
  termCode: "144810",
  term: "Fall 1448",
  department: "Electrical",
  subjectCode: "ELC",
  courseNumber: "101",
  traineeNumber: "441100001",
  courseStatus: "",
  absencePercent: "12.5",
  absenceHours: "6",
};

// Rows from the third line on, each its kind's values with the changes given.
function rows<K extends RayatKind>(
  base: Record<RayatField<K>, string>,
  changes: Partial<Record<RayatField<K>, string>>[],
): RayatRow<K>[] {
  return changes.map((change, at) => ({
    line: at + 3,
    values: { ...base, ...change },
  }));
}

describe("checkRayatRows", () => {
  it("merges SS01's meeting rows into one section, with each meeting and trainer once and in one order", () => {
    const check = checkRayatRows(
      "ss01",
      rows(section, [
        { day: "Tuesday", trainerNumber: "200102" },
        { courseName: "", creditHours: "" },
        { day: "Tuesday", trainerNumber: "200102" },
        {
          sectionRef: "30112",
          capacity: "25",
          enrolled: "27",
          remaining: "-2",
        },
      ]),
      place,
    );
    expect(check).toEqual({
      status: "valid",
      records: [
        {
          departmentId: "electrical",
          courseCode: "ELC 101",
          courseName: "Circuits",
          creditHours: 3,
          sectionRef: "30111",
          deliveryMode: "In person",
          capacity: 30,
          enrolled: 28,
          meetings: [
            { day: "Sunday", time: "08:00-09:40", building: "B1", room: "12" },
            { day: "Tuesday", time: "08:00-09:40", building: "B1", room: "12" },
          ],
          trainerNumbers: ["200101", "200102"],
        },
        expect.objectContaining({
          sectionRef: "30112",
          capacity: 25,
          enrolled: 27,
        }),
      ],
    });
  });

  it("refuses a file of two terms, of another term, or of two term codes", () => {
    expect(
      checkRayatRows(
        "sf01",
        rows(enrollment, [{}, { term: "Spring 1448" }]),
        place,
      ),
    ).toEqual({ status: "termsMixed", terms: ["Fall 1448", "Spring 1448"] });
    expect(
      checkRayatRows(
        "sf01",
        rows(enrollment, [{ term: "Spring 1448" }]),
        place,
      ),
    ).toEqual({ status: "otherTerm", term: "Spring 1448" });
    expect(
      checkRayatRows(
        "so01",
        rows(absence, [{}, { termCode: "144820", traineeNumber: "2" }]),
        place,
      ),
    ).toEqual({ status: "termCodesMixed", codes: ["144810", "144820"] });
  });

  it("matches departments by their Rayat values in any case, and names a value that matches none or a department set aside", () => {
    expect(
      checkRayatRows(
        "sf01",
        rows(enrollment, [
          { department: " elec " },
          { department: "Civil", traineeNumber: "2" },
          { department: "Mechanical", traineeNumber: "3" },
        ]),
        place,
      ),
    ).toEqual({
      status: "invalid",
      problems: [
        { line: 4, problem: "department", value: "Civil" },
        { line: 5, problem: "departmentInactive", value: "Mechanical" },
      ],
    });
  });

  it("reads numbers in either set of digits and checks that a section's capacity is its enrolled plus its remaining", () => {
    const check = checkRayatRows(
      "ss01",
      rows(section, [
        { capacity: "٣٠" },
        { sectionRef: "30112", enrolled: "many" },
        { sectionRef: "30113", remaining: "5" },
      ]),
      place,
    );
    expect(check).toEqual({
      status: "invalid",
      problems: [
        { line: 4, problem: "number", field: "enrolled", value: "many" },
        {
          line: 5,
          problem: "capacity",
          capacity: 30,
          enrolled: 28,
          remaining: 5,
        },
      ],
    });
  });

  it("reads an absence percentage with its sign or without, up to a hundred", () => {
    const check = checkRayatRows(
      "so01",
      rows(absence, [
        { absencePercent: "12.5%", absenceHours: "" },
        { traineeNumber: "2", absencePercent: "120" },
      ]),
      place,
    );
    expect(check).toEqual({
      status: "invalid",
      problems: [
        { line: 4, problem: "number", field: "absencePercent", value: "120" },
      ],
    });
    expect(
      checkRayatRows(
        "so01",
        rows(absence, [{ absencePercent: "12.5%", absenceHours: "" }]),
        place,
      ),
    ).toEqual({
      status: "valid",
      records: [
        {
          departmentId: "electrical",
          subjectCode: "ELC",
          courseNumber: "101",
          traineeNumber: "441100001",
          courseStatus: "",
          absencePercent: 12.5,
          absenceHours: null,
        },
      ],
    });
  });

  it("finds a registration or an absence given twice, in any case of its key", () => {
    expect(
      checkRayatRows(
        "sf01",
        rows(enrollment, [{}, { traineeNumber: "441100002" }, {}]),
        place,
      ),
    ).toEqual({
      status: "invalid",
      problems: [{ line: 5, problem: "duplicate", first: 3 }],
    });
    expect(
      checkRayatRows(
        "so01",
        rows(absence, [{}, { subjectCode: "elc" }]),
        place,
      ),
    ).toEqual({
      status: "invalid",
      problems: [{ line: 4, problem: "duplicate", first: 3 }],
    });
  });

  it("names the field where two rows of one section differ, and the empty fields a row needs", () => {
    expect(
      checkRayatRows(
        "ss01",
        rows(section, [{}, { capacity: "35", remaining: "7" }]),
        place,
      ),
    ).toEqual({
      status: "invalid",
      problems: [
        { line: 4, problem: "sectionConflict", field: "capacity", first: 3 },
        { line: 4, problem: "sectionConflict", field: "remaining", first: 3 },
      ],
    });
    expect(
      checkRayatRows(
        "sf01",
        rows(enrollment, [{ courseCode: "", traineeNumber: "" }]),
        place,
      ),
    ).toEqual({
      status: "invalid",
      problems: [
        {
          line: 3,
          problem: "required",
          fields: ["courseCode", "traineeNumber"],
        },
      ],
    });
    expect(
      checkRayatRows("ss01", rows(section, [{ sectionRef: "" }]), place),
    ).toEqual({
      status: "invalid",
      problems: [{ line: 3, problem: "required", fields: ["sectionRef"] }],
    });
  });
});

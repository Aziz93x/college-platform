import { describe, expect, it } from "vitest";
import { readRayatFile } from "./read.ts";
import { type RayatField, rayatFields } from "./reports.ts";

// A column map as another college might set it: each field's header is its own name.
const columns = Object.fromEntries(
  rayatFields.sf01.map((field) => [field, field]),
) as Record<RayatField<"sf01">, string>;

const header = [
  "unit",
  "TERM",
  "  department ",
  "courseCode",
  "sectionRef",
  "traineeNumber",
  "traineeName",
  "mobile",
  "registrationStatus",
  "traineeStatus",
  "grade",
];

describe("readRayatFile", () => {
  it("reads the rows under a header row that a title pushes down, keeping only the mapped columns", () => {
    const read = readRayatFile(
      "sf01",
      [
        ["Trainee registration report"],
        ["Printed on", "2026-10-22"],
        header,
        [
          "Main",
          " Fall  1448 ",
          "Electrical",
          "ELC 101",
          "30111",
          "441100001",
          "Trainee A",
          "0500000001",
          "Registered",
          "Active",
          "95",
        ],
        ["", "", "", "", "", "", "", "", "", "", ""],
        [
          "Main",
          "Fall 1448",
          "Electrical",
          "ELC 101",
          "30111",
          "441100002",
          "Trainee B",
          "0500000002",
          "Deleted",
          "Active",
          "",
        ],
      ],
      columns,
    );
    expect(read).toEqual({
      status: "read",
      rows: [
        {
          line: 4,
          values: {
            term: "Fall 1448",
            department: "Electrical",
            courseCode: "ELC 101",
            sectionRef: "30111",
            traineeNumber: "441100001",
            registrationStatus: "Registered",
            traineeStatus: "Active",
          },
        },
        {
          line: 6,
          values: {
            term: "Fall 1448",
            department: "Electrical",
            courseCode: "ELC 101",
            sectionRef: "30111",
            traineeNumber: "441100002",
            registrationStatus: "Deleted",
            traineeStatus: "Active",
          },
        },
      ],
    });
    // The name, the mobile number and the grade never leave the reader.
    expect(JSON.stringify(read)).not.toMatch(/Trainee A|0500000001|95/);
  });

  it("names the mapped columns the header row lacks", () => {
    expect(
      readRayatFile(
        "sf01",
        [header.filter((cell) => cell !== "traineeStatus")],
        columns,
      ),
    ).toEqual({ status: "missingColumns", missing: ["traineeStatus"] });
    expect(
      readRayatFile(
        "sf01",
        [
          ["a", "b"],
          ["1", "2"],
        ],
        columns,
      ),
    ).toEqual({
      status: "missingColumns",
      missing: [...rayatFields.sf01],
    });
  });

  it("finds nothing to read in a file with a header row only, or with nothing at all", () => {
    expect(readRayatFile("sf01", [header, [" ", ""]], columns)).toEqual({
      status: "empty",
    });
    expect(readRayatFile("sf01", [["", " "]], columns)).toEqual({
      status: "empty",
    });
  });
});

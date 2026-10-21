import { describe, expect, it } from "vitest";
import {
  MAX_PEOPLE_ROWS,
  type PeopleColumn,
  readPeopleFile,
} from "./people-file.ts";

// Each column's label, as a catalog in another language would give it, and its own name.
const names: Record<PeopleColumn, string[]> = {
  employeeNumber: ["Employee number", "employeeNumber"],
  name: ["Name", "name"],
  email: ["Email", "email"],
  department: ["Department", "department"],
  role: ["Role", "role"],
};

describe("readPeopleFile", () => {
  it("reads each row under the first filled row's headers, by label or name, in any case and spacing", () => {
    expect(
      readPeopleFile(
        [
          ["", ""],
          ["  EMPLOYEE   number", "Notes", "name", "E-mail?", "email", "ROLE"],
          [
            "200101",
            "kept out",
            " Sara  Ali ",
            "x",
            "s@oasis.example",
            "Trainer",
          ],
          ["", "  ", "", "", "", ""],
          ["200102", "", "Khalid", "", "k@oasis.example"],
        ],
        names,
      ),
    ).toEqual({
      status: "read",
      rows: [
        {
          line: 3,
          employeeNumber: "200101",
          name: "Sara Ali",
          email: "s@oasis.example",
          department: "",
          role: "Trainer",
        },
        {
          line: 5,
          employeeNumber: "200102",
          name: "Khalid",
          email: "k@oasis.example",
          department: "",
          role: "",
        },
      ],
    });
  });

  it("names the columns a file needs and lacks", () => {
    expect(
      readPeopleFile(
        [
          ["Name", "Department"],
          ["Sara", "x"],
        ],
        names,
      ),
    ).toEqual({
      status: "missingColumns",
      missing: ["employeeNumber", "email"],
    });
  });

  it("is empty with no rows, or headers alone", () => {
    expect(readPeopleFile([], names)).toEqual({ status: "empty" });
    expect(
      readPeopleFile([["employeeNumber", "name", "email"], [" "]], names),
    ).toEqual({ status: "empty" });
  });

  it("stops at more rows than any college has staff", () => {
    const row = ["1", "A", "a@oasis.example"];
    const header = ["employeeNumber", "name", "email"];
    expect(
      readPeopleFile([header, ...Array(MAX_PEOPLE_ROWS).fill(row)], names)
        .status,
    ).toBe("read");
    expect(
      readPeopleFile([header, ...Array(MAX_PEOPLE_ROWS + 1).fill(row)], names),
    ).toEqual({ status: "tooManyRows", limit: MAX_PEOPLE_ROWS });
  });
});

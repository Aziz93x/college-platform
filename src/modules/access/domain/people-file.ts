import { foldCase, oneLine } from "../../../platform/validation/text.ts";

// The columns of a people file (docs/PLAN.md, Step 10), in the order its template lists them.
export const peopleColumns = [
  "employeeNumber",
  "name",
  "email",
  "department",
  "role",
] as const;

export type PeopleColumn = (typeof peopleColumns)[number];

// A file may leave out the department and the role: a person with neither holds no role yet.
const REQUIRED: readonly PeopleColumn[] = ["employeeNumber", "name", "email"];

// More rows than any college has staff, so a wrong file, such as a list of trainees, stops here
// rather than making thousands of accounts. A guard, not a policy anyone sets.
export const MAX_PEOPLE_ROWS = 2000;

export type PeopleRow = Record<PeopleColumn, string> & { line: number };

export type PeopleFile =
  | { status: "read"; rows: PeopleRow[] }
  | { status: "empty" }
  | { status: "missingColumns"; missing: PeopleColumn[] }
  | { status: "tooManyRows"; limit: number };

const key = (text: string) => foldCase(oneLine(text));

// A people file's rows under its header row, the first row with anything in it. A header names a
// column by one of the names given for it (its label in the catalog, or the column's own name), in
// any case and spacing; other columns are left out. Rows with nothing in them are skipped, and
// each row keeps its line in the file, so that its errors point to it.
export function readPeopleFile(
  table: readonly (readonly string[])[],
  names: Record<PeopleColumn, readonly string[]>,
): PeopleFile {
  const filled = (row: readonly string[]) =>
    row.some((cell) => cell.trim() !== "");
  const start = table.findIndex(filled);
  if (start < 0) return { status: "empty" };
  const header = table[start].map(key);
  const index = Object.fromEntries(
    peopleColumns.map((column) => {
      const accepted = names[column].map(key);
      return [column, header.findIndex((cell) => accepted.includes(cell))];
    }),
  ) as Record<PeopleColumn, number>;
  const missing = REQUIRED.filter((column) => index[column] < 0);
  if (missing.length > 0) return { status: "missingColumns", missing };

  const rows: PeopleRow[] = [];
  for (const [offset, cells] of table.slice(start + 1).entries()) {
    if (!filled(cells)) continue;
    if (rows.length === MAX_PEOPLE_ROWS) {
      return { status: "tooManyRows", limit: MAX_PEOPLE_ROWS };
    }
    const row = { line: start + offset + 2 } as PeopleRow;
    for (const column of peopleColumns) {
      row[column] =
        index[column] < 0 ? "" : oneLine(cells[index[column]] ?? "");
    }
    rows.push(row);
  }
  return rows.length === 0 ? { status: "empty" } : { status: "read", rows };
}

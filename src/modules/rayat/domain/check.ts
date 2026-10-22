import { toLatinDigits } from "../../../platform/validation/digits.ts";
import { foldCase, oneLine } from "../../../platform/validation/text.ts";
import type { RayatRow } from "./read.ts";
import { type RayatField, type RayatKind, requiredFields } from "./reports.ts";

// What a report is checked against: the term it is uploaded for, by its name as Rayat writes it,
// and the college's departments with the values Rayat writes for them (docs/PLAN.md, the notes
// under Step 16).
export type RayatPlace = {
  term: string;
  departments: readonly {
    id: string;
    active: boolean;
    rayatValues: readonly string[];
  }[];
};

// The records each report gives, as the platform keeps them.
export type RayatSection = {
  departmentId: string;
  courseCode: string;
  courseName: string;
  creditHours: number | null;
  sectionRef: string;
  deliveryMode: string;
  capacity: number;
  enrolled: number;
  // A section's meetings, one row of SS01 each, and the trainers they name.
  meetings: { day: string; time: string; building: string; room: string }[];
  trainerNumbers: string[];
};
export type RayatEnrollment = {
  departmentId: string;
  courseCode: string;
  sectionRef: string;
  traineeNumber: string;
  registrationStatus: string;
  traineeStatus: string;
};
export type RayatAbsence = {
  departmentId: string;
  subjectCode: string;
  courseNumber: string;
  traineeNumber: string;
  courseStatus: string;
  absencePercent: number | null;
  absenceHours: number | null;
};
export type RayatRecords = {
  ss01: RayatSection;
  sf01: RayatEnrollment;
  so01: RayatAbsence;
};

// What is wrong with a row, by its line in the file.
export type RowProblem = { line: number } & (
  | { problem: "required"; fields: string[] }
  | { problem: "department" | "departmentInactive"; value: string }
  | { problem: "number"; field: string; value: string }
  | {
      problem: "capacity";
      capacity: number;
      enrolled: number;
      remaining: number;
    }
  | { problem: "duplicate"; first: number }
  | { problem: "sectionConflict"; field: string; first: number }
);

export type RayatCheck<K extends RayatKind> =
  | { status: "termsMixed"; terms: string[] }
  | { status: "otherTerm"; term: string }
  | { status: "termCodesMixed"; codes: string[] }
  | { status: "invalid"; problems: RowProblem[] }
  | { status: "valid"; records: RayatRecords[K][] };

const key = (text: string) => foldCase(oneLine(text));

// The numbers Rayat writes: a count; the seats left, below zero in a section given more trainees
// than its seats; hours, with any decimals; and a percentage, with its sign or without.
const NUMBER = {
  count: /^\d{1,9}$/,
  remaining: /^-?\d{1,9}$/,
  decimal: /^\d{1,9}(\.\d+)?$/,
  percent: /^\d{1,9}(\.\d+)?%?$/,
};

// A number in either set of digits, null for an empty cell, and undefined for anything else.
function numberOf(text: string, shape: keyof typeof NUMBER) {
  const latin = toLatinDigits(text.trim());
  if (latin === "") return null;
  return NUMBER[shape].test(latin) ? Number(latin.replace("%", "")) : undefined;
}

// The distinct texts of a field, in the case and spacing of their first row.
function distinct(rows: readonly { values: object }[], field: string) {
  const seen = new Map<string, string>();
  for (const { values } of rows) {
    const text = (values as Record<string, string>)[field];
    if (text && !seen.has(key(text))) seen.set(key(text), text);
  }
  return [...seen.values()];
}

// A report's rows checked against the college: one term per file (and one term code in SO01), the
// term it is uploaded for, every row's department matched by its Rayat values, its numbers
// numbers, nothing twice, and SS01's meeting rows merged by section reference. The records come
// back only when no row has a problem: an import is applied whole or not at all.
export function checkRayatRows<K extends RayatKind>(
  kind: K,
  rows: readonly RayatRow<K>[],
  place: RayatPlace,
): RayatCheck<K> {
  const terms = distinct(rows, "term");
  if (terms.length > 1) return { status: "termsMixed", terms };
  if (kind === "so01") {
    const codes = distinct(rows, "termCode");
    if (codes.length > 1) return { status: "termCodesMixed", codes };
  }
  const [named] = terms;
  if (named === undefined) {
    return {
      status: "invalid",
      problems: rows.map(({ line }) => ({
        line,
        problem: "required",
        fields: ["term"],
      })),
    };
  }
  if (key(named) !== key(place.term))
    return { status: "otherTerm", term: named };

  const byValue = new Map(
    place.departments.flatMap((department) =>
      department.rayatValues.map((value) => [key(value), department] as const),
    ),
  );
  const problems: RowProblem[] = [];
  // The department a row's value names, or a problem with it.
  const departmentOf = (line: number, value: string) => {
    const department = byValue.get(key(value));
    if (!department) {
      problems.push({ line, problem: "department", value });
    } else if (!department.active) {
      problems.push({ line, problem: "departmentInactive", value });
    } else return department.id;
    return undefined;
  };
  const records = (
    kind === "ss01"
      ? sections(rows as readonly RayatRow<"ss01">[], departmentOf, problems)
      : kind === "sf01"
        ? enrollments(
            rows as readonly RayatRow<"sf01">[],
            departmentOf,
            problems,
          )
        : absences(rows as readonly RayatRow<"so01">[], departmentOf, problems)
  ) as RayatRecords[K][];
  return problems.length > 0
    ? {
        status: "invalid",
        problems: problems.sort((a, b) => a.line - b.line),
      }
    : { status: "valid", records };
}

// The fields a row leaves empty that its kind cannot do without.
function missing<K extends RayatKind>(
  kind: K,
  values: Record<RayatField<K>, string>,
) {
  return requiredFields[kind].filter((field) => !values[field]);
}

type DepartmentOf = (line: number, value: string) => string | undefined;

// SS01's sections, one per section reference. A section's other fields come from the first of its
// rows that has them, and two rows that give a field different values conflict; each row adds its
// meeting and its trainer. Capacity is checked once the rows are merged.
function sections(
  rows: readonly RayatRow<"ss01">[],
  departmentOf: DepartmentOf,
  problems: RowProblem[],
) {
  const shared = [
    "department",
    "courseCode",
    "courseName",
    "creditHours",
    "deliveryMode",
    "capacity",
    "enrolled",
    "remaining",
  ] as const;
  const groups = new Map<
    string,
    { line: number; values: Record<RayatField<"ss01">, string> }[]
  >();
  for (const row of rows) {
    if (!row.values.sectionRef) {
      problems.push({
        line: row.line,
        problem: "required",
        fields: ["sectionRef"],
      });
      continue;
    }
    const group = groups.get(key(row.values.sectionRef)) ?? [];
    group.push(row);
    groups.set(key(row.values.sectionRef), group);
  }
  const result: RayatSection[] = [];
  for (const group of groups.values()) {
    const [first] = group;
    const merged = { ...first.values };
    let conflict = false;
    for (const row of group.slice(1)) {
      for (const field of shared) {
        const value = row.values[field];
        if (!value) continue;
        if (!merged[field]) merged[field] = value;
        else if (key(merged[field]) !== key(value)) {
          problems.push({
            line: row.line,
            problem: "sectionConflict",
            field,
            first: first.line,
          });
          conflict = true;
        }
      }
    }
    if (conflict) continue;
    const lacking = missing("ss01", merged);
    if (lacking.length > 0) {
      problems.push({ line: first.line, problem: "required", fields: lacking });
      continue;
    }
    const departmentId = departmentOf(first.line, merged.department);
    const numbers = {
      capacity: numberOf(merged.capacity, "count"),
      enrolled: numberOf(merged.enrolled, "count"),
      remaining: numberOf(merged.remaining, "remaining"),
      creditHours: numberOf(merged.creditHours, "decimal"),
    };
    const bad = (Object.keys(numbers) as (keyof typeof numbers)[]).filter(
      (field) => numbers[field] === undefined,
    );
    for (const field of bad) {
      problems.push({
        line: first.line,
        problem: "number",
        field,
        value: merged[field],
      });
    }
    const { capacity, enrolled, remaining, creditHours } = numbers;
    if (
      bad.length > 0 ||
      !departmentId ||
      capacity == null ||
      enrolled == null ||
      remaining == null ||
      creditHours === undefined
    ) {
      continue;
    }
    if (capacity !== enrolled + remaining) {
      problems.push({
        line: first.line,
        problem: "capacity",
        capacity,
        enrolled,
        remaining,
      });
      continue;
    }
    result.push({
      departmentId,
      courseCode: merged.courseCode,
      courseName: merged.courseName,
      creditHours,
      sectionRef: merged.sectionRef,
      deliveryMode: merged.deliveryMode,
      capacity,
      enrolled,
      meetings: meetingsOf(group),
      trainerNumbers: [
        ...new Set(
          group.map(({ values }) => values.trainerNumber).filter(Boolean),
        ),
      ].sort(),
    });
  }
  return result;
}

// A section's meetings, each once and in one order, so that a file listing its rows in another
// order gives the same section.
function meetingsOf(group: readonly RayatRow<"ss01">[]) {
  const meetings = new Map<string, RayatSection["meetings"][number]>();
  for (const { values } of group) {
    const { day, time, building, room } = values;
    if (!day && !time && !building && !room) continue;
    const parts = [day, time, building, room];
    meetings.set(parts.map(key).join("\u0000"), { day, time, building, room });
  }
  return [...meetings.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, meeting]) => meeting);
}

// The first line of each record's key, so a second row with the same key points to it.
function once(
  firstLines: Map<string, number>,
  line: number,
  id: string,
  problems: RowProblem[],
) {
  const first = firstLines.get(id);
  if (first !== undefined) {
    problems.push({ line, problem: "duplicate", first });
    return false;
  }
  firstLines.set(id, line);
  return true;
}

// SF01's registrations, one per trainee in a section.
function enrollments(
  rows: readonly RayatRow<"sf01">[],
  departmentOf: DepartmentOf,
  problems: RowProblem[],
) {
  const firstLines = new Map<string, number>();
  const result: RayatEnrollment[] = [];
  for (const row of rows) {
    const { values } = row;
    const lacking = missing("sf01", values);
    if (lacking.length > 0) {
      problems.push({ line: row.line, problem: "required", fields: lacking });
      continue;
    }
    const departmentId = departmentOf(row.line, values.department);
    const unique = once(
      firstLines,
      row.line,
      identity("sf01", values),
      problems,
    );
    if (!departmentId || !unique) continue;
    result.push({
      departmentId,
      courseCode: values.courseCode,
      sectionRef: values.sectionRef,
      traineeNumber: values.traineeNumber,
      registrationStatus: values.registrationStatus,
      traineeStatus: values.traineeStatus,
    });
  }
  return result;
}

// SO01's absences, one per trainee in a course.
function absences(
  rows: readonly RayatRow<"so01">[],
  departmentOf: DepartmentOf,
  problems: RowProblem[],
) {
  const firstLines = new Map<string, number>();
  const result: RayatAbsence[] = [];
  for (const row of rows) {
    const { values } = row;
    const lacking = missing("so01", values);
    if (lacking.length > 0) {
      problems.push({ line: row.line, problem: "required", fields: lacking });
      continue;
    }
    const departmentId = departmentOf(row.line, values.department);
    const percent = numberOf(values.absencePercent, "percent");
    const hours = numberOf(values.absenceHours, "decimal");
    if (percent === undefined || (percent !== null && percent > 100)) {
      problems.push({
        line: row.line,
        problem: "number",
        field: "absencePercent",
        value: values.absencePercent,
      });
    }
    if (hours === undefined) {
      problems.push({
        line: row.line,
        problem: "number",
        field: "absenceHours",
        value: values.absenceHours,
      });
    }
    const unique = once(
      firstLines,
      row.line,
      identity("so01", values),
      problems,
    );
    if (
      !departmentId ||
      !unique ||
      percent === undefined ||
      (percent !== null && percent > 100) ||
      hours === undefined
    ) {
      continue;
    }
    result.push({
      departmentId,
      subjectCode: values.subjectCode,
      courseNumber: values.courseNumber,
      traineeNumber: values.traineeNumber,
      courseStatus: values.courseStatus,
      absencePercent: percent,
      absenceHours: hours,
    });
  }
  return result;
}

// What names a record of each report: a section by its reference, a registration by its section
// and trainee, an absence by its course and trainee.
export const recordKeys = {
  ss01: ["sectionRef"],
  sf01: ["sectionRef", "traineeNumber"],
  so01: ["subjectCode", "courseNumber", "traineeNumber"],
} as const satisfies { [K in RayatKind]: readonly (keyof RayatRecords[K])[] };

// A record's key as its file writes it, and as one text that two spellings of it share.
export function recordKey(kind: RayatKind, record: object) {
  return recordKeys[kind].map((field) =>
    String((record as Record<string, unknown>)[field]),
  );
}
export const identity = (kind: RayatKind, record: object) =>
  recordKey(kind, record).map(key).join("\u0000");

import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "../../identity/index.ts";
import { colleges, departments } from "../../org/index.ts";
import { terms } from "../../terms/index.ts";
import type { RayatSection } from "../domain/check.ts";
import type { RayatDiff } from "../domain/diff.ts";
import type { RayatKind } from "../domain/reports.ts";

export type RayatImportStatus = "pending" | "applied" | "rolledBack";

// A Rayat report uploaded for a term (Step 16): checked and diffed against the version in force,
// then waiting to be applied, applied, or rolled back. A term's version of a report is its import
// applied last and not rolled back; the raw file is never kept, only the records below. A report
// has one upload waiting at most, and none once the version its diff was taken against is rolled
// back, so the diff an upload shows is the change applying it makes.
export const rayatImports = pgTable(
  "rayat_imports",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    collegeId: uuid("college_id")
      .notNull()
      .references(() => colleges.id),
    termId: uuid("term_id").notNull(),
    kind: text().$type<RayatKind>().notNull(),
    status: text().$type<RayatImportStatus>().notNull().default("pending"),
    // The version of the column map that read the file (settings rayat.columns.<kind>).
    mappingVersion: integer("mapping_version").notNull(),
    rowCount: integer("row_count").notNull(),
    recordCount: integer("record_count").notNull(),
    diff: jsonb().$type<RayatDiff>().notNull(),
    uploadedBy: uuid("uploaded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    appliedBy: uuid("applied_by").references(() => users.id, {
      onDelete: "set null",
    }),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    rolledBackBy: uuid("rolled_back_by").references(() => users.id, {
      onDelete: "set null",
    }),
    rolledBackAt: timestamp("rolled_back_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      name: "rayat_imports_term_fk",
      columns: [table.collegeId, table.termId],
      foreignColumns: [terms.collegeId, terms.id],
    }),
    unique("rayat_imports_college_id_id_unique").on(table.collegeId, table.id),
    index("rayat_imports_term_kind_idx").on(table.termId, table.kind),
    uniqueIndex("rayat_imports_one_pending_idx")
      .on(table.termId, table.kind)
      .where(sql`${table.status} = 'pending'`),
    check("rayat_imports_kind", sql`${table.kind} in ('ss01', 'sf01', 'so01')`),
    check(
      "rayat_imports_status",
      sql`${table.status} in ('pending', 'applied', 'rolledBack')`,
    ),
  ],
);

// The columns every kept record has: its import, and the department its row named.
const kept = () => ({
  id: uuid().primaryKey().default(sql`uuidv7()`),
  collegeId: uuid("college_id").notNull(),
  importId: uuid("import_id").notNull(),
  departmentId: uuid("department_id").notNull(),
});

function keptKeys(
  name: string,
  table: Record<"collegeId" | "importId" | "departmentId", AnyPgColumn>,
) {
  return [
    foreignKey({
      name: `${name}_import_fk`,
      columns: [table.collegeId, table.importId],
      foreignColumns: [rayatImports.collegeId, rayatImports.id],
    }).onDelete("cascade"),
    foreignKey({
      name: `${name}_department_fk`,
      columns: [table.collegeId, table.departmentId],
      foreignColumns: [departments.collegeId, departments.id],
    }),
    index(`${name}_import_id_idx`).on(table.importId),
  ];
}

// SS01's sections, one per section reference, with their meetings and the trainers they name.
export const rayatSections = pgTable(
  "rayat_sections",
  {
    ...kept(),
    courseCode: text("course_code").notNull(),
    courseName: text("course_name").notNull(),
    creditHours: doublePrecision("credit_hours"),
    sectionRef: text("section_ref").notNull(),
    deliveryMode: text("delivery_mode").notNull(),
    capacity: integer().notNull(),
    enrolled: integer().notNull(),
    meetings: jsonb().$type<RayatSection["meetings"]>().notNull(),
    trainerNumbers: text("trainer_numbers").array().notNull(),
  },
  (table) => keptKeys("rayat_sections", table),
);

// SF01's registrations: a trainee by number in a section, and their statuses. Never a name, a mobile
// number or a grade.
export const rayatEnrollments = pgTable(
  "rayat_enrollments",
  {
    ...kept(),
    courseCode: text("course_code").notNull(),
    sectionRef: text("section_ref").notNull(),
    traineeNumber: text("trainee_number").notNull(),
    registrationStatus: text("registration_status").notNull(),
    traineeStatus: text("trainee_status").notNull(),
  },
  (table) => keptKeys("rayat_enrollments", table),
);

// SO01's absences: a trainee's unexcused absence in a course.
export const rayatAbsences = pgTable(
  "rayat_absences",
  {
    ...kept(),
    subjectCode: text("subject_code").notNull(),
    courseNumber: text("course_number").notNull(),
    traineeNumber: text("trainee_number").notNull(),
    courseStatus: text("course_status").notNull(),
    absencePercent: doublePrecision("absence_percent"),
    absenceHours: doublePrecision("absence_hours"),
  },
  (table) => keptKeys("rayat_absences", table),
);

import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const colleges = pgTable("colleges", {
  id: uuid().primaryKey().default(sql`uuidv7()`),
  name: text().notNull(),
  shortName: text("short_name").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// A department of the college. Its names are data: none appears in code or in the base seed. A
// department is deactivated, never deleted: plans, sections and portfolios will point at it.
export const departments = pgTable(
  "departments",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    collegeId: uuid("college_id")
      .notNull()
      .references(() => colleges.id),
    name: text().notNull(),
    shortName: text("short_name").notNull(),
    active: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("departments_name_unique").on(table.collegeId, table.name),
    unique("departments_short_name_unique").on(
      table.collegeId,
      table.shortName,
    ),
  ],
);

// What Rayat's exports write in their department column for a department. A Rayat row belongs to
// the department one of these values names, so a value names one department of the college.
export const departmentRayatValues = pgTable(
  "department_rayat_values",
  {
    collegeId: uuid("college_id")
      .notNull()
      .references(() => colleges.id),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),
    value: text().notNull(),
  },
  (table) => [
    primaryKey({
      name: "department_rayat_values_pkey",
      columns: [table.collegeId, table.value],
    }),
    index("department_rayat_values_department_id_index").on(table.departmentId),
  ],
);

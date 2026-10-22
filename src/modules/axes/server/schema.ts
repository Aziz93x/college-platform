import { sql } from "drizzle-orm";
import {
  foreignKey,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { colleges } from "../../org/index.ts";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// The portfolio's axes in the groups the administration gives them (Step 14). They are data, seeded
// by the base seed; the code finds an axis by its code, and the admin corrects its title.
export const axisGroups = pgTable(
  "axis_groups",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    collegeId: uuid("college_id")
      .notNull()
      .references(() => colleges.id),
    code: text().notNull(),
    title: text().notNull(),
    position: integer().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("axis_groups_college_id_id_unique").on(table.collegeId, table.id),
    unique("axis_groups_code_unique").on(table.collegeId, table.code),
  ],
);

// An axis of the portfolio, in a group of its college.
export const axes = pgTable(
  "axes",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    collegeId: uuid("college_id").notNull(),
    groupId: uuid("group_id").notNull(),
    code: text().notNull(),
    title: text().notNull(),
    description: text().notNull().default(""),
    position: integer().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    foreignKey({
      name: "axes_group_fk",
      columns: [table.collegeId, table.groupId],
      foreignColumns: [axisGroups.collegeId, axisGroups.id],
    }),
    unique("axes_college_id_id_unique").on(table.collegeId, table.id),
    unique("axes_code_unique").on(table.collegeId, table.code),
  ],
);

import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "../../identity/index.ts";
import { colleges, departments } from "../../org/index.ts";
import { terms } from "../../terms/index.ts";

// A head's transfer of a section of a term from one trainer to another, from a week on (Step 17).
// The section is Rayat's, by its reference in the term; the trainer replaced is named by the
// employee number the section names them with, who may not be on the platform. A cancelled transfer
// is deleted: the log keeps it.
export const sectionTransfers = pgTable(
  "section_transfers",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    collegeId: uuid("college_id")
      .notNull()
      .references(() => colleges.id),
    termId: uuid("term_id").notNull(),
    // The section's department when it was transferred, where the key is checked.
    departmentId: uuid("department_id").notNull(),
    sectionRef: text("section_ref").notNull(),
    fromNumber: text("from_number").notNull(),
    toUserId: uuid("to_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    week: integer().notNull(),
    reason: text().notNull(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // When the head last kept it against a version of SS01 in conflict with it.
    keptAt: timestamp("kept_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      name: "section_transfers_term_fk",
      columns: [table.collegeId, table.termId],
      foreignColumns: [terms.collegeId, terms.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "section_transfers_department_fk",
      columns: [table.collegeId, table.departmentId],
      foreignColumns: [departments.collegeId, departments.id],
    }),
    index("section_transfers_term_idx").on(table.termId, table.sectionRef),
    check("section_transfers_week", sql`${table.week} >= 1`),
  ],
);

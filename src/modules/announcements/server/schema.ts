import { sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "../../identity/index.ts";
import { colleges, departments } from "../../org/index.ts";

// What someone announced to a department of the college, or to the whole college (ADR-0017). Each
// person it reached has it as a notification; a withdrawn one keeps its row for the log's sake.
export const announcements = pgTable(
  "announcements",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    collegeId: uuid("college_id")
      .notNull()
      .references(() => colleges.id),
    // Null: the whole college. Otherwise one of the college's departments (the key below).
    departmentId: uuid("department_id"),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text().notNull(),
    body: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      name: "announcements_department_fk",
      columns: [table.collegeId, table.departmentId],
      foreignColumns: [departments.collegeId, departments.id],
    }),
    // The page lists a college's live announcements newest first, in desc()'s order (lead review B).
    index("announcements_live_idx")
      .on(
        table.collegeId,
        table.createdAt.desc().nullsFirst(),
        table.id.desc().nullsFirst(),
      )
      .where(sql`${table.withdrawnAt} is null`),
  ],
);

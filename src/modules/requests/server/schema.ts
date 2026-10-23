import { sql } from "drizzle-orm";
import {
  date,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { axes } from "../../axes/index.ts";
import type { EvidencePolicy } from "../../framework/index.ts";
import { users } from "../../identity/index.ts";
import { colleges, departments } from "../../org/index.ts";
import { terms } from "../../terms/index.ts";
import type { RequestTargets } from "../domain/input.ts";

// An urgent request a head sends their department, or the vice-dean or the dean one department or
// the whole college, without the plan editor (Step 22): its words, the axis its tasks count under,
// the day they are due, whom it reaches, and the evidence it asks for, fixed when it was sent. Its
// id names its tasks in the generation engine, a source of their own (ADR-0025).
export const quickRequests = pgTable(
  "quick_requests",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    collegeId: uuid("college_id")
      .notNull()
      .references(() => colleges.id),
    termId: uuid("term_id").notNull(),
    departmentId: uuid("department_id"),
    title: text().notNull(),
    axisId: uuid("axis_id").notNull(),
    dueOn: date("due_on", { mode: "string" }).notNull(),
    targets: jsonb().$type<RequestTargets>().notNull(),
    evidence: jsonb().$type<EvidencePolicy>().notNull(),
    sentBy: uuid("sent_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      name: "quick_requests_term_fk",
      columns: [table.collegeId, table.termId],
      foreignColumns: [terms.collegeId, terms.id],
    }),
    foreignKey({
      name: "quick_requests_department_fk",
      columns: [table.collegeId, table.departmentId],
      foreignColumns: [departments.collegeId, departments.id],
    }),
    foreignKey({
      name: "quick_requests_axis_fk",
      columns: [table.collegeId, table.axisId],
      foreignColumns: [axes.collegeId, axes.id],
    }),
    index("quick_requests_term_idx").on(table.termId, table.createdAt),
  ],
);

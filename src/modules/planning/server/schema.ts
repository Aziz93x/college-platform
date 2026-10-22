import { sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { axes } from "../../axes/index.ts";
import type {
  DueRule,
  EvidencePolicy,
  SectionTemplateInput,
  TaskKind,
} from "../../framework/index.ts";
import { colleges, departments } from "../../org/index.ts";
import { terms } from "../../terms/index.ts";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// A head's section template for a term (Step 18): an item of the department's plan that reaches the
// trainers of its sections, once per section or once per course of theirs, in the order the head
// gave it. The framework's items for those trainers are the college's; these are the department's
// own. They are its drafts until Step 19 publishes the plan, and the next term starts with a copy.
export const sectionTemplates = pgTable(
  "section_templates",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    collegeId: uuid("college_id")
      .notNull()
      .references(() => colleges.id),
    termId: uuid("term_id").notNull(),
    departmentId: uuid("department_id").notNull(),
    position: integer().notNull(),
    title: text().notNull(),
    axisId: uuid("axis_id").notNull(),
    kind: text().$type<TaskKind>().notNull(),
    appliesTo: jsonb("applies_to")
      .$type<SectionTemplateInput["appliesTo"]>()
      .notNull(),
    due: jsonb().$type<DueRule>().notNull(),
    evidence: jsonb().$type<EvidencePolicy>().notNull(),
    notes: text().notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    foreignKey({
      name: "section_templates_term_fk",
      columns: [table.collegeId, table.termId],
      foreignColumns: [terms.collegeId, terms.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "section_templates_department_fk",
      columns: [table.collegeId, table.departmentId],
      foreignColumns: [departments.collegeId, departments.id],
    }),
    foreignKey({
      name: "section_templates_axis_fk",
      columns: [table.collegeId, table.axisId],
      foreignColumns: [axes.collegeId, axes.id],
    }),
    index("section_templates_term_idx").on(
      table.termId,
      table.departmentId,
      table.position,
    ),
  ],
);

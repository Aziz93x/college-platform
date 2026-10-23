import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { memberships, roles } from "../../access/index.ts";
import { axes } from "../../axes/index.ts";
import type { EvidencePolicy, TaskKind } from "../../framework/index.ts";
import { users } from "../../identity/index.ts";
import { colleges, departments } from "../../org/index.ts";
import { terms } from "../../terms/index.ts";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// A responsibility a head gives trainers beside their teaching (Step 21), such as the department's
// secretary, and the axis its tasks go under. Without a department it is every department's: the
// base seed gives the six of today's app by their keys, which heads assign but do not change. With
// one, it is that department's own, which its head adds, such as an inventory officer. A template
// may grant a role in the department while it is assigned, as the secretary's grants the
// secretary's keys; only the seed sets one.
export const assignmentTemplates = pgTable(
  "assignment_templates",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    collegeId: uuid("college_id")
      .notNull()
      .references(() => colleges.id),
    departmentId: uuid("department_id"),
    key: text(),
    title: text().notNull(),
    axisId: uuid("axis_id").notNull(),
    grantsRoleId: uuid("grants_role_id").references(() => roles.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    foreignKey({
      name: "assignment_templates_department_fk",
      columns: [table.collegeId, table.departmentId],
      foreignColumns: [departments.collegeId, departments.id],
    }),
    foreignKey({
      name: "assignment_templates_axis_fk",
      columns: [table.collegeId, table.axisId],
      foreignColumns: [axes.collegeId, axes.id],
    }),
    unique("assignment_templates_college_id_id_unique").on(
      table.collegeId,
      table.id,
    ),
    unique("assignment_templates_key_unique").on(table.collegeId, table.key),
  ],
);

// An item of a template, in the order it was entered: a task for each person the template is
// assigned to, due at the assignment's end (the owner's answers, 23 October 2026). Its id names
// those tasks in the generation engine, as a framework item's origin names its own.
export const assignmentTemplateItems = pgTable(
  "assignment_template_items",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    collegeId: uuid("college_id").notNull(),
    templateId: uuid("template_id").notNull(),
    position: integer().notNull(),
    title: text().notNull(),
    kind: text().$type<TaskKind>().notNull(),
    evidence: jsonb().$type<EvidencePolicy>().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    foreignKey({
      name: "assignment_template_items_template_fk",
      columns: [table.collegeId, table.templateId],
      foreignColumns: [assignmentTemplates.collegeId, assignmentTemplates.id],
    }).onDelete("cascade"),
    index("assignment_template_items_template_idx").on(
      table.templateId,
      table.position,
    ),
  ],
);

// A template given to one person in a department for one term, the whole of it or from a week to a
// week (the owner's answers, 23 October 2026): its items' tasks are due in its last week, and the
// role its template grants is theirs in the department for the term, by the membership the
// assignment added, until the head revokes it, which deletes the row. A person holds a template once
// in a department and term.
export const assignments = pgTable(
  "assignments",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    collegeId: uuid("college_id")
      .notNull()
      .references(() => colleges.id),
    termId: uuid("term_id").notNull(),
    departmentId: uuid("department_id").notNull(),
    templateId: uuid("template_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fromWeek: integer("from_week"),
    toWeek: integer("to_week"),
    membershipId: uuid("membership_id").references(() => memberships.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (table) => [
    foreignKey({
      name: "assignments_term_fk",
      columns: [table.collegeId, table.termId],
      foreignColumns: [terms.collegeId, terms.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "assignments_department_fk",
      columns: [table.collegeId, table.departmentId],
      foreignColumns: [departments.collegeId, departments.id],
    }),
    foreignKey({
      name: "assignments_template_fk",
      columns: [table.collegeId, table.templateId],
      foreignColumns: [assignmentTemplates.collegeId, assignmentTemplates.id],
    }),
    unique("assignments_holder_unique").on(
      table.termId,
      table.departmentId,
      table.templateId,
      table.userId,
    ),
    // The whole term, or a range of its weeks.
    check(
      "assignments_weeks",
      sql`(${table.fromWeek} is null and ${table.toWeek} is null) or (1 <= ${table.fromWeek} and ${table.fromWeek} <= ${table.toWeek})`,
    ),
  ],
);

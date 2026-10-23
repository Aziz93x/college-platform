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
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { axes } from "../../axes/index.ts";
import type {
  DueRule,
  EvidencePolicy,
  PlanReach,
  TaskKind,
} from "../../framework/index.ts";
import { colleges, departments } from "../../org/index.ts";
import { terms } from "../../terms/index.ts";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// A department's plan for a term (Step 19), version by version: a draft until its head publishes
// it, after which it never changes. A department has one draft at most, and its latest published
// version is what its trainers' tasks come from, beside the framework's.
export const plans = pgTable(
  "plans",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    collegeId: uuid("college_id")
      .notNull()
      .references(() => colleges.id),
    termId: uuid("term_id").notNull(),
    departmentId: uuid("department_id").notNull(),
    version: integer().notNull(),
    status: text().$type<"draft" | "published">().notNull().default("draft"),
    publishedBy: uuid("published_by"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    foreignKey({
      name: "plans_term_fk",
      columns: [table.collegeId, table.termId],
      foreignColumns: [terms.collegeId, terms.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "plans_department_fk",
      columns: [table.collegeId, table.departmentId],
      foreignColumns: [departments.collegeId, departments.id],
    }),
    unique("plans_college_id_id_unique").on(table.collegeId, table.id),
    unique("plans_version_unique").on(
      table.termId,
      table.departmentId,
      table.version,
    ),
    uniqueIndex("plans_one_draft_idx")
      .on(table.termId, table.departmentId)
      .where(sql`${table.status} = 'draft'`),
    check("plans_status", sql`${table.status} in ('draft', 'published')`),
  ],
);

// An item of a plan's version, in the order its head gave it: the department's own work, reaching
// one person of it, the holders of a role in it, or each trainer of its sections or its courses,
// as the section templates of Step 18 did. An item copied into a new version knows the item it
// copies, as it was first entered: its tasks are the same in every version (Step 20).
export const planItems = pgTable(
  "plan_items",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    collegeId: uuid("college_id").notNull(),
    planId: uuid("plan_id").notNull(),
    originId: uuid("origin_id"),
    position: integer().notNull(),
    title: text().notNull(),
    axisId: uuid("axis_id").notNull(),
    kind: text().$type<TaskKind>().notNull(),
    appliesTo: jsonb("applies_to").$type<PlanReach>().notNull(),
    due: jsonb().$type<DueRule>().notNull(),
    evidence: jsonb().$type<EvidencePolicy>().notNull(),
    notes: text().notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    foreignKey({
      name: "plan_items_plan_fk",
      columns: [table.collegeId, table.planId],
      foreignColumns: [plans.collegeId, plans.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "plan_items_axis_fk",
      columns: [table.collegeId, table.axisId],
      foreignColumns: [axes.collegeId, axes.id],
    }),
    index("plan_items_plan_idx").on(table.planId, table.position),
  ],
);

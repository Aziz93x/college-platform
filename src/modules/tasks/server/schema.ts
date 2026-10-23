import { sql } from "drizzle-orm";
import {
  check,
  date,
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
import { axes } from "../../axes/index.ts";
import type { EvidencePolicy, TaskKind } from "../../framework/index.ts";
import { users } from "../../identity/index.ts";
import { colleges, departments } from "../../org/index.ts";
import { terms } from "../../terms/index.ts";
import type { TaskSource } from "../domain/generate.ts";
import type {
  GenerationReason,
  GenerationStatus,
  TaskStatus,
} from "../domain/status.ts";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// A piece of work for one person (docs/PLAN.md, section 3), generated from what a role filled in
// (Step 20). Its slot is its key, and generating again never adds a second task for a slot: the
// source item, by the item it was first entered as, so that a new version of the framework reaches
// the same tasks; the occurrence of the item's due rule; the department; and either a section and a
// place in it, named by the trainer Rayat gave the place at the term's start, which a transfer gives
// to someone else; or a course, by Rayat's code, and a place in it, one for each trainer its
// sections started the term with (Step 18); or the person whose role the item reaches. A task waits
// for a trainer not on the platform by their employee number. A task its source no longer calls for
// is cancelled, not deleted.
export const tasks = pgTable(
  "tasks",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    collegeId: uuid("college_id")
      .notNull()
      .references(() => colleges.id),
    termId: uuid("term_id").notNull(),
    departmentId: uuid("department_id").notNull(),
    source: text().$type<TaskSource>().notNull(),
    sourceItemId: uuid("source_item_id").notNull(),
    occurrence: integer().notNull(),
    sectionRef: text("section_ref").notNull().default(""),
    courseCode: text("course_code").notNull().default(""),
    place: text().notNull().default(""),
    holderId: uuid("holder_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    assigneeId: uuid("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    assigneeNumber: text("assignee_number"),
    title: text().notNull(),
    axisId: uuid("axis_id").notNull(),
    kind: text().$type<TaskKind>().notNull(),
    week: integer().notNull(),
    dueOn: date("due_on").notNull(),
    status: text().$type<TaskStatus>().notNull().default("notStarted"),
    // The evidence the item asked for when the task was generated or last moved.
    policy: jsonb().$type<EvidencePolicy>().notNull(),
    payload: jsonb()
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    foreignKey({
      name: "tasks_term_fk",
      columns: [table.collegeId, table.termId],
      foreignColumns: [terms.collegeId, terms.id],
    }),
    foreignKey({
      name: "tasks_department_fk",
      columns: [table.collegeId, table.departmentId],
      foreignColumns: [departments.collegeId, departments.id],
    }),
    foreignKey({
      name: "tasks_axis_fk",
      columns: [table.collegeId, table.axisId],
      foreignColumns: [axes.collegeId, axes.id],
    }),
    unique("tasks_slot_unique")
      .on(
        table.termId,
        table.source,
        table.sourceItemId,
        table.occurrence,
        table.departmentId,
        table.sectionRef,
        table.courseCode,
        table.place,
        table.holderId,
      )
      .nullsNotDistinct(),
    index("tasks_term_department_idx").on(table.termId, table.departmentId),
    index("tasks_assignee_idx").on(table.assigneeId, table.dueOn),
    check(
      "tasks_source",
      sql`${table.source} in ('framework', 'plan', 'assignment', 'request')`,
    ),
    check(
      "tasks_status",
      sql`${table.status} in ('notStarted', 'inProgress', 'submitted', 'done', 'returned', 'notApplicable')`,
    ),
    check("tasks_occurrence", sql`${table.occurrence} >= 1`),
    // A task reaches a place in a section, a place in a course, or a holder of a role: one of them.
    check(
      "tasks_reach",
      sql`(${table.sectionRef} = '' and ${table.courseCode} = '' and ${table.place} = '' and ${table.holderId} is not null) or (${table.sectionRef} <> '' and ${table.courseCode} = '' and ${table.place} <> '' and ${table.holderId} is null) or (${table.sectionRef} = '' and ${table.courseCode} <> '' and ${table.place} <> '' and ${table.holderId} is null)`,
    ),
  ],
);

// A pass of the engine over a term's tasks (Step 20): queued by what changes them, then run by the
// worker, which writes how far it has got, what it did, and why it failed if it did.
export const generationRuns = pgTable(
  "generation_runs",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    collegeId: uuid("college_id")
      .notNull()
      .references(() => colleges.id),
    termId: uuid("term_id").notNull(),
    reason: text().$type<GenerationReason>().notNull(),
    status: text().$type<GenerationStatus>().notNull().default("queued"),
    // How many tasks the term's sources call for, once counted, and how many of them it has gone
    // through.
    total: integer(),
    done: integer().notNull().default(0),
    created: integer().notNull().default(0),
    updated: integer().notNull().default(0),
    reassigned: integer().notNull().default(0),
    cancelled: integer().notNull().default(0),
    error: text(),
    queuedAt: timestamp("queued_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      name: "generation_runs_term_fk",
      columns: [table.collegeId, table.termId],
      foreignColumns: [terms.collegeId, terms.id],
    }),
    index("generation_runs_term_idx").on(table.termId, table.queuedAt),
    index("generation_runs_waiting_idx")
      .on(table.queuedAt)
      .where(sql`${table.status} in ('queued', 'running')`),
    check(
      "generation_runs_reason",
      sql`${table.reason} in ('framework', 'plan', 'assignment', 'request', 'ss01', 'transfer', 'periods', 'daily', 'admin')`,
    ),
    check(
      "generation_runs_status",
      sql`${table.status} in ('queued', 'running', 'done', 'failed')`,
    ),
  ],
);

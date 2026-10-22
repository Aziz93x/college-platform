import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
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
import { users } from "../../identity/index.ts";
import { colleges } from "../../org/index.ts";
import { terms } from "../../terms/index.ts";
import type {
  AppliesTo,
  DueRule,
  EvidencePolicy,
  TaskKind,
} from "../domain/inputs.ts";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// The term's general framework (Step 15), a version at a time: the vice-dean's draft, endorsed by
// the dean where the college asks for it, then published, after which it never changes. A term has
// one draft at most; the next draft starts from the latest published version.
export const frameworks = pgTable(
  "frameworks",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    collegeId: uuid("college_id")
      .notNull()
      .references(() => colleges.id),
    termId: uuid("term_id").notNull(),
    version: integer().notNull(),
    status: text().$type<"draft" | "published">().notNull().default("draft"),
    endorsedBy: uuid("endorsed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    endorsedAt: timestamp("endorsed_at", { withTimezone: true }),
    publishedBy: uuid("published_by").references(() => users.id, {
      onDelete: "set null",
    }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    foreignKey({
      name: "frameworks_term_fk",
      columns: [table.collegeId, table.termId],
      foreignColumns: [terms.collegeId, terms.id],
    }),
    unique("frameworks_college_id_id_unique").on(table.collegeId, table.id),
    unique("frameworks_version_unique").on(table.termId, table.version),
    uniqueIndex("frameworks_one_draft_idx")
      .on(table.termId)
      .where(sql`${table.status} = 'draft'`),
    check("frameworks_status", sql`${table.status} in ('draft', 'published')`),
  ],
);

// A college-wide item of a framework version, in the order the vice-dean gave it.
export const frameworkItems = pgTable(
  "framework_items",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    collegeId: uuid("college_id").notNull(),
    frameworkId: uuid("framework_id").notNull(),
    position: integer().notNull(),
    title: text().notNull(),
    axisId: uuid("axis_id").notNull(),
    kind: text().$type<TaskKind>().notNull(),
    appliesTo: jsonb("applies_to").$type<AppliesTo>().notNull(),
    due: jsonb().$type<DueRule>().notNull(),
    evidence: jsonb().$type<EvidencePolicy>().notNull(),
    notes: text().notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    foreignKey({
      name: "framework_items_framework_fk",
      columns: [table.collegeId, table.frameworkId],
      foreignColumns: [frameworks.collegeId, frameworks.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "framework_items_axis_fk",
      columns: [table.collegeId, table.axisId],
      foreignColumns: [axes.collegeId, axes.id],
    }),
  ],
);

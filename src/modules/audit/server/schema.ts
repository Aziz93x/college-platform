import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// The colleges table as far as the foreign key below needs it: its name and its key. The org module
// owns the table and records its own changes here, so importing the table from it would make the
// two modules import each other. Not exported: drizzle-kit reads only org's definition.
const colleges = pgTable("colleges", { id: uuid().primaryKey() });

// Append-only: rows are inserted, never updated or deleted by the app.
export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    collegeId: uuid("college_id")
      .notNull()
      .references(() => colleges.id),
    // Null means the system acted, not a person.
    actorId: text("actor_id"),
    action: text().notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    diff: jsonb(),
    ip: text(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // The log pages newest first by (created_at, id), whole, by person or by action, and an entity's
  // history reads its own events (Step 11). Each index keeps desc()'s order, nulls first, as the
  // queries ask: with nulls last, no ORDER BY could use it (lead review B).
  (table) => [
    index("audit_events_college_time_idx").on(
      table.collegeId,
      table.createdAt.desc().nullsFirst(),
      table.id.desc().nullsFirst(),
    ),
    index("audit_events_actor_idx").on(
      table.collegeId,
      table.actorId,
      table.createdAt.desc().nullsFirst(),
      table.id.desc().nullsFirst(),
    ),
    index("audit_events_action_idx").on(
      table.collegeId,
      table.action,
      table.createdAt.desc().nullsFirst(),
      table.id.desc().nullsFirst(),
    ),
    index("audit_events_entity_idx").on(
      table.collegeId,
      table.entityType,
      table.entityId,
      table.createdAt.desc().nullsFirst(),
      table.id.desc().nullsFirst(),
    ),
  ],
);

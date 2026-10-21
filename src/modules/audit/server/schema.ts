import { sql } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// The colleges table as far as the foreign key below needs it: its name and its key. The org module
// owns the table and records its own changes here, so importing the table from it would make the
// two modules import each other. Not exported: drizzle-kit reads only org's definition.
const colleges = pgTable("colleges", { id: uuid().primaryKey() });

// Append-only: rows are inserted, never updated or deleted by the app.
export const auditEvents = pgTable("audit_events", {
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
});

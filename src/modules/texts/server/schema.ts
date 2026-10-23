import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "../../identity/index.ts";
import { colleges } from "../../org/index.ts";

// A college's own wording of one message of the catalog, by its key (ADR-0029). The request's
// messages lay it over the catalog's; deleting it puts the default back.
export const textOverrides = pgTable(
  "text_overrides",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    collegeId: uuid("college_id")
      .notNull()
      .references(() => colleges.id),
    key: text().notNull(),
    value: text().notNull(),
    updatedBy: uuid("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique("text_overrides_key").on(table.collegeId, table.key)],
);

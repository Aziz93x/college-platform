import {
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { colleges } from "../../org/index.ts";

// One stored value per college and key; a key without a row uses its registered default.
export const settings = pgTable(
  "settings",
  {
    collegeId: uuid("college_id")
      .notNull()
      .references(() => colleges.id),
    key: text().notNull(),
    value: jsonb().notNull(),
    version: integer().notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.collegeId, table.key] })],
);

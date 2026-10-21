import { sql } from "drizzle-orm";
import {
  boolean,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "../../identity/index.ts";
import { colleges } from "../../org/index.ts";

// Roles are data: each college names its own, and the permission keys in code are what they hold.
export const roles = pgTable(
  "roles",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    collegeId: uuid("college_id")
      .notNull()
      .references(() => colleges.id),
    key: text().notNull(),
    // The role's name in each language, keyed by language code.
    labels: jsonb().$type<Record<string, string>>().notNull(),
    // The system role holds every permission key, including keys added after it was created.
    system: boolean().notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique().on(table.collegeId, table.key)],
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permission: text().notNull(),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permission] })],
);

// Who holds which role. College-wide for now; Step 9 adds department scopes and terms.
export const memberships = pgTable(
  "memberships",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    collegeId: uuid("college_id")
      .notNull()
      .references(() => colleges.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique().on(table.userId, table.roleId, table.collegeId)],
);

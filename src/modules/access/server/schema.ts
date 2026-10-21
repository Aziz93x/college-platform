import { sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "../../identity/index.ts";
import { colleges, departments } from "../../org/index.ts";

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

// Who holds which role, and where: across the college, or in one of its departments. A person
// holds a role once in each scope. The optional term arrives with terms (Step 13).
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
    // Null: the whole college. Otherwise one of the college's departments (the key below).
    departmentId: uuid("department_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("memberships_scope_unique")
      .on(table.userId, table.roleId, table.departmentId)
      .nullsNotDistinct(),
    // A role's members: the grid's list, the last-admin rule and the first admin's check.
    index("memberships_role_id_index").on(table.roleId),
    foreignKey({
      name: "memberships_department_fk",
      columns: [table.collegeId, table.departmentId],
      foreignColumns: [departments.collegeId, departments.id],
    }),
  ],
);

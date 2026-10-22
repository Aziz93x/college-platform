import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "../../identity/index.ts";
import { colleges } from "../../org/index.ts";

// What the platform told each person, in the platform: the kind and what its message is filled
// with, rendered by the reader's catalog (src/modules/notifications/domain/kinds.ts).
export const notifications = pgTable(
  "notifications",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    collegeId: uuid("college_id")
      .notNull()
      .references(() => colleges.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text().notNull(),
    params: jsonb().$type<Record<string, unknown>>().notNull(),
    // Set on a notification a person gets once only, such as a week's digest: a second one with
    // the same key is not added.
    onceKey: text("once_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  // A person's notifications page newest first by (created_at, id); the bell counts the unread.
  // Each index keeps desc()'s order, nulls first, as the queries ask (lead review B).
  (table) => [
    index("notifications_user_time_idx").on(
      table.userId,
      table.createdAt.desc().nullsFirst(),
      table.id.desc().nullsFirst(),
    ),
    index("notifications_unread_idx")
      .on(
        table.userId,
        table.createdAt.desc().nullsFirst(),
        table.id.desc().nullsFirst(),
      )
      .where(sql`${table.readAt} is null`),
    uniqueIndex("notifications_once_idx").on(table.userId, table.onceKey),
    // An announcement's notifications, which its read counts and its withdrawal look up (lead
    // review C).
    index("notifications_announcement_idx")
      .on(sql`(${table.params} ->> 'announcementId')`)
      .where(sql`${table.kind} = 'announcement'`),
  ],
);

// Whether each kind reaches a person on a channel, as they chose; a kind they never chose for does.
export const notificationPrefs = pgTable(
  "notification_prefs",
  {
    collegeId: uuid("college_id")
      .notNull()
      .references(() => colleges.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text().notNull(),
    // In the platform only until the hosting decision (ADR-0008).
    channel: text().notNull().default("inApp"),
    enabled: boolean().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.kind, table.channel] }),
    check("notification_prefs_channel", sql`${table.channel} in ('inApp')`),
  ],
);

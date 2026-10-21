import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { type Db, getDb } from "../../../platform/db/client.ts";
import { notifications } from "./schema.ts";

// Whose notifications: a person of a college. Every read keeps to both.
type Reader = { collegeId: string; userId: string };

// Where the next page starts: the last notification shown, newest first. Its time is the
// database's own text, to the microsecond, as the audit log's cursor (Step 11).
export type NotificationCursor = { at: string; id: string };

export type NotificationEntry = {
  id: string;
  kind: string;
  params: Record<string, unknown>;
  createdAt: Date;
  readAt: Date | null;
};

const columns = {
  id: notifications.id,
  kind: notifications.kind,
  params: notifications.params,
  createdAt: notifications.createdAt,
  readAt: notifications.readAt,
};

const theirs = ({ collegeId, userId }: Reader) =>
  and(eq(notifications.collegeId, collegeId), eq(notifications.userId, userId));

// How many of a person's notifications are unread: the bell's count.
export async function unreadCount(reader: Reader, db: Db = getDb()) {
  const [{ unread }] = await db
    .select({ unread: count() })
    .from(notifications)
    .where(and(theirs(reader), isNull(notifications.readAt)));
  return unread;
}

// A person's newest unread notifications, newest first: what the bell shows.
export function latestUnread(reader: Reader, limit: number, db: Db = getDb()) {
  return db
    .select(columns)
    .from(notifications)
    .where(and(theirs(reader), isNull(notifications.readAt)))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit);
}

// A page of a person's notifications, read or not, newest first by (created_at, id).
export async function listNotifications(
  reader: Reader,
  options: { after?: NotificationCursor; limit?: number } = {},
  db: Db = getDb(),
): Promise<{ notifications: NotificationEntry[]; next?: NotificationCursor }> {
  const limit = options.limit ?? 30;
  const { after } = options;
  // One more than asked says whether another page follows.
  const rows = await db
    .select({ ...columns, at: sql<string>`${notifications.createdAt}::text` })
    .from(notifications)
    .where(
      and(
        theirs(reader),
        after
          ? sql`(${notifications.createdAt}, ${notifications.id}) < (${after.at}::timestamptz, ${after.id}::uuid)`
          : undefined,
      ),
    )
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit + 1);
  const shown = rows.slice(0, limit);
  const last = shown.at(-1);
  return {
    notifications: shown.map(({ at: _at, ...entry }) => entry),
    next:
      rows.length > limit && last ? { at: last.at, id: last.id } : undefined,
  };
}

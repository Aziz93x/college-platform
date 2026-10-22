import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
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

// A person's unread announcements, newest first: what opens over the page until each is closed
// (ADR-0017).
export function unreadAnnouncements(
  reader: Reader,
  limit: number,
  db: Db = getDb(),
) {
  return db
    .select(columns)
    .from(notifications)
    .where(
      and(
        theirs(reader),
        isNull(notifications.readAt),
        eq(notifications.kind, "announcement"),
      ),
    )
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

// How many each announcement reached, and how many of them have read it (ADR-0017, decision 7): its
// notifications, counted by the announcement each names. An announcement none of them names, one
// withdrawn, is not in the map.
export async function announcementReads(
  collegeId: string,
  announcementIds: readonly string[],
  db: Db = getDb(),
) {
  if (announcementIds.length === 0) return new Map<string, Reads>();
  const announcementId = sql<string>`${notifications.params} ->> 'announcementId'`;
  const rows = await db
    .select({
      id: announcementId,
      reached: count(),
      read: count(notifications.readAt),
    })
    .from(notifications)
    .where(
      and(
        eq(notifications.collegeId, collegeId),
        // Written out, so the planner matches the partial index on announcements.
        sql`${notifications.kind} = 'announcement'`,
        inArray(announcementId, [...announcementIds]),
      ),
    )
    .groupBy(announcementId);
  return new Map<string, Reads>(
    rows.map(({ id, reached, read }) => [id, { reached, read }]),
  );
}

type Reads = { reached: number; read: number };

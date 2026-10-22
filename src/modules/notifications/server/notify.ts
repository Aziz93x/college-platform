import { and, eq, sql } from "drizzle-orm";
import { type Db, getDb, type Tx } from "../../../platform/db/client.ts";
import {
  isOptional,
  type NotificationKind,
  type NotificationParams,
} from "../domain/kinds.ts";
import { notificationPrefs, notifications } from "./schema.ts";

export type Notice<K extends NotificationKind> = {
  collegeId: string;
  userId: string;
  kind: K;
  params: NotificationParams[K];
  // A notification a person gets once only, such as a week's digest.
  onceKey?: string;
};

// Tells a person something in the platform, unless they turned its kind off. Inside a transaction,
// pass it, so the notification commits with what it tells of. A once key already sent sends nothing.
export async function notify<K extends NotificationKind>(
  notice: Notice<K>,
  db: Db | Tx = getDb(),
): Promise<"sent" | "muted" | "duplicate"> {
  const [muted] = await db
    .select({ kind: notificationPrefs.kind })
    .from(notificationPrefs)
    .where(
      and(
        eq(notificationPrefs.userId, notice.userId),
        eq(notificationPrefs.kind, notice.kind),
        eq(notificationPrefs.channel, "inApp"),
        eq(notificationPrefs.enabled, false),
      ),
    );
  if (muted) return "muted";
  const added = await db
    .insert(notifications)
    .values({
      collegeId: notice.collegeId,
      userId: notice.userId,
      kind: notice.kind,
      params: notice.params,
      onceKey: notice.onceKey,
    })
    .onConflictDoNothing()
    .returning({ id: notifications.id });
  return added.length > 0 ? "sent" : "duplicate";
}

// Tells each of these people the same thing of a kind no one turns off, such as an announcement,
// in one statement: inside a transaction, pass it. Returns how many it told.
export async function notifyAll<K extends NotificationKind>(
  notice: {
    collegeId: string;
    userIds: readonly string[];
    kind: K;
    params: NotificationParams[K];
  },
  db: Db | Tx = getDb(),
) {
  if (isOptional(notice.kind)) {
    throw new Error(`notifyAll: ${notice.kind} may be turned off; use notify()`);
  }
  if (notice.userIds.length === 0) return 0;
  const added = await db
    .insert(notifications)
    .values(
      notice.userIds.map((userId) => ({
        collegeId: notice.collegeId,
        userId,
        kind: notice.kind,
        params: notice.params,
      })),
    )
    .returning({ id: notifications.id });
  return added.length;
}

// Takes an announcement back from everyone it reached, read or not (ADR-0017). Returns how many.
export async function retractAnnouncement(
  collegeId: string,
  announcementId: string,
  db: Db | Tx = getDb(),
) {
  const removed = await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.collegeId, collegeId),
        eq(notifications.kind, "announcement"),
        sql`${notifications.params}->>'announcementId' = ${announcementId}`,
      ),
    )
    .returning({ id: notifications.id });
  return removed.length;
}

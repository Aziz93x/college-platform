import { and, eq } from "drizzle-orm";
import { type Db, getDb, type Tx } from "../../../platform/db/client.ts";
import type { NotificationKind, NotificationParams } from "../domain/kinds.ts";
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

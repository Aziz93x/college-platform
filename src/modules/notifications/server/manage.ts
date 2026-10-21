import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { type Db, getDb } from "../../../platform/db/client.ts";
import { writeAudit } from "../../audit/index.ts";
import {
  type NotificationKind,
  notificationKindKeys,
} from "../domain/kinds.ts";
import { notificationPrefs, notifications } from "./schema.ts";

// A person acting on their own notifications, for the audit event.
type Change = {
  collegeId: string;
  actorId: string;
  ip?: string | null;
  userAgent?: string | null;
};

// Marks a person's notifications read, those named or all they have unread, and records
// notification.read with how many. Already read, or not theirs, changes and writes nothing.
export async function markRead(
  which: { ids: readonly string[] } | "all",
  change: Change,
  db: Db = getDb(),
) {
  return db.transaction(async (tx) => {
    const marked = await tx
      .update(notifications)
      .set({ readAt: sql`now()` })
      .where(
        and(
          eq(notifications.collegeId, change.collegeId),
          eq(notifications.userId, change.actorId),
          isNull(notifications.readAt),
          which === "all"
            ? undefined
            : inArray(notifications.id, [...which.ids]),
        ),
      )
      .returning({ id: notifications.id });
    if (marked.length === 0) return 0;
    await writeAudit(
      {
        collegeId: change.collegeId,
        actorId: change.actorId,
        action: "notification.read",
        entityType: "user",
        entityId: change.actorId,
        diff: { count: marked.length },
        ip: change.ip,
        userAgent: change.userAgent,
      },
      tx,
    );
    return marked.length;
  });
}

// Whether each kind reaches a person in the platform: every kind, but those they turned off.
export async function notificationChoices(
  reader: { collegeId: string; userId: string },
  db: Db = getDb(),
): Promise<Record<NotificationKind, boolean>> {
  const rows = await db
    .select({
      kind: notificationPrefs.kind,
      enabled: notificationPrefs.enabled,
    })
    .from(notificationPrefs)
    .where(
      and(
        eq(notificationPrefs.collegeId, reader.collegeId),
        eq(notificationPrefs.userId, reader.userId),
        eq(notificationPrefs.channel, "inApp"),
      ),
    );
  const chosen = new Map(rows.map((row) => [row.kind, row.enabled]));
  return Object.fromEntries(
    notificationKindKeys.map((kind) => [kind, chosen.get(kind) ?? true]),
  ) as Record<NotificationKind, boolean>;
}

// Turns a kind on or off for the person acting and records notification.unmute or
// notification.mute. Choosing what already holds changes and writes nothing.
export async function chooseNotification(
  choice: { kind: NotificationKind; enabled: boolean },
  change: Change,
  db: Db = getDb(),
): Promise<{ status: "saved" | "unchanged" }> {
  return db.transaction(async (tx) => {
    const key = {
      userId: change.actorId,
      kind: choice.kind,
      channel: "inApp",
    } as const;
    const [current] = await tx
      .select({ enabled: notificationPrefs.enabled })
      .from(notificationPrefs)
      .where(
        and(
          eq(notificationPrefs.userId, key.userId),
          eq(notificationPrefs.kind, key.kind),
          eq(notificationPrefs.channel, key.channel),
        ),
      )
      .for("update");
    if ((current?.enabled ?? true) === choice.enabled) {
      return { status: "unchanged" };
    }
    await tx
      .insert(notificationPrefs)
      .values({
        ...key,
        collegeId: change.collegeId,
        enabled: choice.enabled,
      })
      .onConflictDoUpdate({
        target: [
          notificationPrefs.userId,
          notificationPrefs.kind,
          notificationPrefs.channel,
        ],
        set: { enabled: choice.enabled, updatedAt: sql`now()` },
      });
    await writeAudit(
      {
        collegeId: change.collegeId,
        actorId: change.actorId,
        action: choice.enabled ? "notification.unmute" : "notification.mute",
        entityType: "user",
        entityId: change.actorId,
        diff: { kind: choice.kind },
        ip: change.ip,
        userAgent: change.userAgent,
      },
      tx,
    );
    return { status: "saved" };
  });
}

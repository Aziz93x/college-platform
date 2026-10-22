import { and, desc, eq, gte, isNull, lt, ne } from "drizzle-orm";
import { type Db, getDb } from "../../../platform/db/client.ts";
import {
  type DigestMoment,
  digestKey,
  digestOf,
  digestWeek,
} from "../domain/digest.ts";
import { notify } from "./notify.ts";
import { notifications } from "./schema.ts";

// Sends a college's people their digest of the week that ended at the moment: what the seven days
// before it told them that they have not read. A person with nothing unread, or who turned the
// digest off, gets none. Each person gets one per week (its once key), so the job may run again.
// Returns how many it sent.
export async function sendWeeklyDigests(
  collegeId: string,
  moment: DigestMoment,
  db: Db = getDb(),
) {
  const week = digestWeek(moment);
  const unread = await db
    .select({
      id: notifications.id,
      userId: notifications.userId,
      kind: notifications.kind,
      params: notifications.params,
    })
    .from(notifications)
    .where(
      and(
        eq(notifications.collegeId, collegeId),
        isNull(notifications.readAt),
        ne(notifications.kind, "weeklyDigest"),
        gte(notifications.createdAt, week.from),
        lt(notifications.createdAt, week.to),
      ),
    )
    .orderBy(desc(notifications.createdAt), desc(notifications.id));
  const byPerson = new Map<string, typeof unread>();
  for (const notification of unread) {
    const theirs = byPerson.get(notification.userId) ?? [];
    theirs.push(notification);
    byPerson.set(notification.userId, theirs);
  }
  let sent = 0;
  for (const [userId, theirs] of byPerson) {
    const outcome = await notify(
      {
        collegeId,
        userId,
        kind: "weeklyDigest",
        params: digestOf(theirs),
        onceKey: digestKey(moment),
      },
      db,
    );
    if (outcome === "sent") sent += 1;
  }
  return sent;
}

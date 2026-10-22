import { and, desc, eq } from "drizzle-orm";
import { auditEvents } from "../../../src/modules/audit/index.ts";
import type { Db } from "../../../src/platform/db/client.ts";

// The device of a person's last sign-in in the log, as the actions would record it for their
// changes; nothing for one who has not signed in.
export async function deviceOf(db: Db, collegeId: string, userId: string) {
  const [last] = await db
    .select({ ip: auditEvents.ip, userAgent: auditEvents.userAgent })
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.collegeId, collegeId),
        eq(auditEvents.actorId, userId),
        eq(auditEvents.action, "session.signIn"),
      ),
    )
    .orderBy(desc(auditEvents.createdAt))
    .limit(1);
  return last ?? {};
}

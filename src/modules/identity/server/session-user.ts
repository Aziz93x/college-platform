import { eq } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "../../../platform/db/client.ts";
import { getSetting } from "../../settings/index.ts";
import { isLastSeenStale, sessionEnd } from "../domain/session-policy.ts";
import { getAuth } from "./auth.ts";
import { people, sessions } from "./schema.ts";

export type SessionUser = {
  userId: string;
  sessionId: string;
  collegeId: string;
  name: string;
  email: string;
  twoFactorEnabled: boolean;
  mustChangePassword: boolean;
};

async function sessionLimits(collegeId: string) {
  const [idleMinutes, sessionHours, rememberedDeviceDays] = await Promise.all([
    getSetting("auth.idleMinutes", { collegeId }),
    getSetting("auth.sessionHours", { collegeId }),
    getSetting("auth.rememberedDeviceDays", { collegeId }),
  ]);
  return { idleMinutes, sessionHours, rememberedDeviceDays };
}

// The signed-in person for this request, or null. A session past the college's limits is ended
// here (its row is deleted, so the stale cookie no longer signs anyone in). Read once per request.
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  // Imported on call: db/ scripts load this module with plain Node, which cannot resolve "next/headers".
  const { headers } = await import("next/headers");
  const result = await getAuth().api.getSession({ headers: await headers() });
  if (!result) return null;
  const { session, user } = result;
  const db = getDb();
  const [person] = await db
    .select({ collegeId: people.collegeId })
    .from(people)
    .where(eq(people.userId, user.id));
  // An account without a person is not part of any college, so it has nothing to open.
  if (!person) return null;

  const now = new Date();
  const lastSeenAt = session.lastSeenAt ?? session.createdAt;
  const ends = sessionEnd(
    {
      remembered: session.remembered ?? false,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      lastSeenAt,
    },
    await sessionLimits(person.collegeId),
  );
  if (now >= ends) {
    await db.delete(sessions).where(eq(sessions.id, session.id));
    return null;
  }
  if (isLastSeenStale(lastSeenAt, now)) {
    await db
      .update(sessions)
      .set({ lastSeenAt: now })
      .where(eq(sessions.id, session.id));
  }
  return {
    userId: user.id,
    sessionId: session.id,
    collegeId: person.collegeId,
    name: user.name,
    email: user.email,
    twoFactorEnabled: user.twoFactorEnabled ?? false,
    mustChangePassword: user.mustChangePassword ?? false,
  };
});

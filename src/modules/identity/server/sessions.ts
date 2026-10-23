import { and, count, desc, eq, gt, inArray, ne, sql } from "drizzle-orm";
import { type Db, getDb } from "../../../platform/db/client.ts";
import { writeAudit } from "../../audit/index.ts";
import { lockAccount } from "./manage.ts";
import { people, sessions, users } from "./schema.ts";

// Who ends someone's sessions, for the audit event. The caller has authorized them for this person
// (ADR-0029).
type Change = {
  collegeId: string;
  actorId: string;
  ip?: string | null;
  userAgent?: string | null;
};

const alive = gt(sessions.expiresAt, sql`now()`);

// A person's sessions still alive, the one last seen first: what their page lists (ADR-0029).
export async function listSessions(userId: string, db: Db = getDb()) {
  return db
    .select({
      id: sessions.id,
      userAgent: sessions.userAgent,
      ipAddress: sessions.ipAddress,
      createdAt: sessions.createdAt,
      lastSeenAt: sessions.lastSeenAt,
      remembered: sessions.remembered,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), alive))
    .orderBy(desc(sessions.lastSeenAt));
}

// How many sessions of the college's people are alive now: what the system page counts.
export async function countSessions(collegeId: string, db: Db = getDb()) {
  const [row] = await db
    .select({ count: count() })
    .from(sessions)
    .innerJoin(people, eq(people.userId, sessions.userId))
    .where(and(eq(people.collegeId, collegeId), alive));
  return row?.count ?? 0;
}

// Ends one of someone's sessions, which signs that device out at its next request, and records
// session.revoke with where it was.
export async function revokeSession(
  userId: string,
  sessionId: string,
  change: Change,
  db: Db = getDb(),
): Promise<"revoked" | "notFound"> {
  return db.transaction(async (tx) => {
    if (!(await lockAccount(tx, userId, change.collegeId))) return "notFound";
    const [ended] = await tx
      .delete(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
      .returning({
        ipAddress: sessions.ipAddress,
        userAgent: sessions.userAgent,
      });
    if (!ended) return "notFound";
    await writeAudit(
      {
        collegeId: change.collegeId,
        actorId: change.actorId,
        action: "session.revoke",
        entityType: "user",
        entityId: userId,
        diff: { address: ended.ipAddress, device: ended.userAgent },
        ip: change.ip,
        userAgent: change.userAgent,
      },
      tx,
    );
    return "revoked";
  });
}

// Ends every session of someone's, and records session.revokeAll with how many.
export async function revokeAllSessions(
  userId: string,
  change: Change,
  db: Db = getDb(),
): Promise<"revoked" | "none" | "notFound"> {
  return db.transaction(async (tx) => {
    if (!(await lockAccount(tx, userId, change.collegeId))) return "notFound";
    const ended = await tx
      .delete(sessions)
      .where(eq(sessions.userId, userId))
      .returning({ id: sessions.id });
    if (ended.length === 0) return "none";
    await writeAudit(
      {
        collegeId: change.collegeId,
        actorId: change.actorId,
        action: "session.revokeAll",
        entityType: "user",
        entityId: userId,
        diff: { sessions: ended.length },
        ip: change.ip,
        userAgent: change.userAgent,
      },
      tx,
    );
    return "revoked";
  });
}

// Requires a new password at the person's next request, which the shell asks for before anything
// else, and records account.requirePasswordChange.
export async function requirePasswordChange(
  userId: string,
  change: Change,
  db: Db = getDb(),
): Promise<"saved" | "unchanged" | "notFound"> {
  return db.transaction(async (tx) => {
    if (!(await lockAccount(tx, userId, change.collegeId))) return "notFound";
    const [updated] = await tx
      .update(users)
      .set({ mustChangePassword: true, updatedAt: new Date() })
      .where(and(eq(users.id, userId), eq(users.mustChangePassword, false)))
      .returning({ id: users.id });
    if (!updated) return "unchanged";
    await writeAudit(
      {
        collegeId: change.collegeId,
        actorId: change.actorId,
        action: "account.requirePasswordChange",
        entityType: "user",
        entityId: userId,
        ip: change.ip,
        userAgent: change.userAgent,
      },
      tx,
    );
    return "saved";
  });
}

// Ends every session of the college's people but the one the actor works in, and records
// session.revokeEveryone on the college with how many: after a breach, for one.
export async function revokeEveryone(
  exceptSessionId: string,
  change: Change,
  db: Db = getDb(),
) {
  return db.transaction(async (tx) => {
    const ended = await tx
      .delete(sessions)
      .where(
        and(
          inArray(
            sessions.userId,
            tx
              .select({ userId: people.userId })
              .from(people)
              .where(eq(people.collegeId, change.collegeId)),
          ),
          ne(sessions.id, exceptSessionId),
        ),
      )
      .returning({ id: sessions.id });
    await writeAudit(
      {
        collegeId: change.collegeId,
        actorId: change.actorId,
        action: "session.revokeEveryone",
        entityType: "college",
        entityId: change.collegeId,
        diff: { sessions: ended.length },
        ip: change.ip,
        userAgent: change.userAgent,
      },
      tx,
    );
    return ended.length;
  });
}

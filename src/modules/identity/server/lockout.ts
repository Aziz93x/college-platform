import { eq, lte, sql } from "drizzle-orm";
import type { Db, Tx } from "../../../platform/db/client.ts";
import { signInLockouts } from "./schema.ts";

const MINUTE_MS = 60_000;

type LockoutLimits = { lockoutThreshold: number; lockoutMinutes: number };

// Wrong passwords count against an account, or against what was typed when no account matches.
// Both follow this one path, so the answers never tell whether an account exists (ADR-0009).
export const accountSubject = (userId: string) => `user:${userId}`;

const lockEnds = (startedAt: Date, limits: LockoutLimits) =>
  new Date(startedAt.getTime() + limits.lockoutMinutes * MINUTE_MS);

// When the subject's lock ends, while it is locked.
export async function lockEnd(
  db: Db,
  subject: string,
  limits: LockoutLimits,
  now: Date,
) {
  const [row] = await db
    .select()
    .from(signInLockouts)
    .where(eq(signInLockouts.subject, subject));
  if (!row || row.failures < limits.lockoutThreshold) return null;
  const end = lockEnds(row.startedAt, limits);
  return end > now ? end : null;
}

// A wrong password. A count lasts the lockout's minutes from its first failure; when it reaches the
// threshold, the subject locks for that long from the failure that reached it. One statement, so
// attempts that race each other are all counted. Returns the lock's end.
export async function countFailure(
  db: Db,
  subject: string,
  limits: LockoutLimits,
  now: Date,
) {
  // Counts and locks that have ended hold nothing; removing them keeps the table to current ones.
  await db
    .delete(signInLockouts)
    .where(
      lte(
        signInLockouts.startedAt,
        new Date(now.getTime() - limits.lockoutMinutes * MINUTE_MS),
      ),
    );
  const reached = sql`${signInLockouts.failures} + 1 >= ${limits.lockoutThreshold}`;
  const [row] = await db
    .insert(signInLockouts)
    .values({ subject, failures: 1, startedAt: now })
    .onConflictDoUpdate({
      target: signInLockouts.subject,
      set: {
        failures: sql`${signInLockouts.failures} + 1`,
        startedAt: sql`case when ${reached} then ${now} else ${signInLockouts.startedAt} end`,
      },
    })
    .returning();
  return row.failures >= limits.lockoutThreshold
    ? lockEnds(row.startedAt, limits)
    : null;
}

// A sign-in clears the account's count, and an admin's reset lifts its lock.
export async function clearLockout(db: Db | Tx, subject: string) {
  await db.delete(signInLockouts).where(eq(signInLockouts.subject, subject));
}

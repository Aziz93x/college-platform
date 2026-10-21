import { isAPIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { getDb } from "../../../platform/db/client.ts";
import { writeAudit } from "../../audit/index.ts";
import { getSetting } from "../../settings/index.ts";
import { getAuth } from "./auth.ts";
import {
  accountSubjects,
  beginAttempt,
  clearLockouts,
  lockSubjects,
  minutesUntil,
} from "./lockout.ts";
import { people, sessions, users } from "./schema.ts";

type Retyped<T> =
  | { status: "right"; value: T }
  | { status: "wrong" }
  | { status: "locked"; minutes: number };

// A password typed again behind a session: to change it, to set up two-factor, and from Step 7 to
// confirm an admin's action. It counts against both of the account's identifiers before it is
// checked, as at sign-in, so a session left open is no way to guess the password. `check` returns
// a value when the password is right, nothing when it is wrong. The attempt that reaches the
// threshold locks both identifiers, ends every session of the account and writes account.lock, so
// the next try meets the sign-in lockout. A lock already in force refuses without a check and
// leaves the sessions, so someone guessing at the login page cannot sign the person out.
export async function checkRetypedPassword<T>(
  user: { userId: string; collegeId: string },
  check: () => Promise<T | undefined>,
  meta: { ip: string | null; userAgent: string | null },
  now = new Date(),
): Promise<Retyped<T>> {
  const db = getDb();
  const [lockoutThreshold, lockoutMinutes] = await Promise.all([
    getSetting("auth.lockoutThreshold", { collegeId: user.collegeId }),
    getSetting("auth.lockoutMinutes", { collegeId: user.collegeId }),
  ]);
  const limits = { lockoutThreshold, lockoutMinutes };
  const [identity] = await db
    .select({ email: users.email, employeeNumber: people.employeeNumber })
    .from(users)
    .innerJoin(people, eq(people.userId, users.id))
    .where(eq(users.id, user.userId));
  const subjects = accountSubjects(identity);
  const counts = await Promise.all(
    subjects.map((subject) => beginAttempt(db, subject, limits, now)),
  );

  const locked = counts.filter(({ place }) => place > lockoutThreshold);
  if (locked.length > 0) {
    const ends = Math.max(...locked.map(({ ends }) => ends.getTime()));
    return { status: "locked", minutes: minutesUntil(new Date(ends), now) };
  }
  const value = await check();
  if (value !== undefined) {
    await clearLockouts(db, subjects);
    return { status: "right", value };
  }
  if (Math.max(...counts.map(({ place }) => place)) < lockoutThreshold) {
    return { status: "wrong" };
  }

  // This attempt reached the threshold.
  const lockedUntil = new Date(now.getTime() + lockoutMinutes * 60_000);
  await db.transaction(async (tx) => {
    await lockSubjects(tx, subjects, limits, now);
    await tx.delete(sessions).where(eq(sessions.userId, user.userId));
    await writeAudit(
      {
        collegeId: user.collegeId,
        actorId: null,
        action: "account.lock",
        entityType: "user",
        entityId: user.userId,
        diff: { lockedUntil: lockedUntil.toISOString() },
        ...meta,
      },
      tx,
    );
  });
  return { status: "locked", minutes: lockoutMinutes };
}

// The check for a password typed again that changes nothing itself: true when it is the signed-in
// person's own, nothing when it is wrong.
export function passwordCheck(password: string, requestHeaders: Headers) {
  return async () => {
    try {
      await getAuth().api.verifyPassword({
        body: { password },
        headers: requestHeaders,
      });
      return true;
    } catch (error) {
      if (isAPIError(error) && error.body?.code === "INVALID_PASSWORD") {
        return undefined;
      }
      throw error;
    }
  };
}

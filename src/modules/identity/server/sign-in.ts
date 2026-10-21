import { isAPIError } from "better-auth/api";
import { hashPassword } from "better-auth/crypto";
import { and, eq, lt, sql } from "drizzle-orm";
import { type Db, getDb } from "../../../platform/db/client.ts";
import { writeAudit } from "../../audit/index.ts";
import { findCollegeId } from "../../org/index.ts";
import { getSetting } from "../../settings/index.ts";
import { type Identifier, parseIdentifier } from "../domain/identifier.ts";
import { getAuth } from "./auth.ts";
import {
  accountSubjects,
  beginAttempt,
  clearLockouts,
  subjectOf,
} from "./lockout.ts";
import { requestMeta } from "./request.ts";
import { people, sessions, signInAttempts, users } from "./schema.ts";

export type SignInInput = {
  identifier: string;
  password: string;
  remember: boolean;
};

type SignInResult =
  | { status: "signedIn" }
  | { status: "twoFactor" }
  | { status: "invalid" }
  | { status: "locked"; minutes: number }
  | { status: "throttled"; minutes: number };

const MINUTE_MS = 60_000;

async function signInLimits(collegeId: string) {
  const [attempts, windowMinutes, lockoutThreshold, lockoutMinutes] =
    await Promise.all([
      getSetting("auth.signInAttempts", { collegeId }),
      getSetting("auth.signInWindowMinutes", { collegeId }),
      getSetting("auth.lockoutThreshold", { collegeId }),
      getSetting("auth.lockoutMinutes", { collegeId }),
    ]);
  return { attempts, windowMinutes, lockoutThreshold, lockoutMinutes };
}

async function findAccount(db: Db, collegeId: string, identifier: Identifier) {
  const match =
    identifier.kind === "email"
      ? eq(users.email, identifier.email)
      : and(
          eq(people.collegeId, collegeId),
          eq(people.employeeNumber, identifier.employeeNumber),
        );
  const [account] = await db
    .select({
      userId: users.id,
      email: users.email,
      employeeNumber: people.employeeNumber,
    })
    .from(users)
    .innerJoin(people, eq(people.userId, users.id))
    .where(match);
  return account;
}

// Counts one attempt for this key in the current window, starting a new window when the last one
// has passed. Returns when the window ends if the attempts are used up. A successful sign-in clears
// the key, so only failures add up.
async function countAttempt(
  db: Db,
  key: string,
  limits: { attempts: number; windowMinutes: number },
  now: Date,
) {
  const windowStart = new Date(
    now.getTime() - limits.windowMinutes * MINUTE_MS,
  );
  // Windows that have passed hold no count; removing them keeps the table to the current window.
  await db
    .delete(signInAttempts)
    .where(lt(signInAttempts.windowStartedAt, windowStart));
  const [row] = await db
    .insert(signInAttempts)
    .values({ key, attempts: 1, windowStartedAt: now })
    .onConflictDoUpdate({
      target: signInAttempts.key,
      set: { attempts: sql`${signInAttempts.attempts} + 1` },
    })
    .returning();
  if (row.attempts <= limits.attempts) return null;
  return new Date(
    row.windowStartedAt.getTime() + limits.windowMinutes * MINUTE_MS,
  );
}

const minutesUntil = (end: Date, now: Date) =>
  Math.max(1, Math.ceil((end.getTime() - now.getTime()) / MINUTE_MS));

// Signs a person in with their employee number or email and their password. The answer never
// tells a wrong identifier from a wrong password. Limits apply per identifier and address, so a
// workshop behind one address does not block itself (ADR-0008). The threshold of attempts within
// the lockout's minutes of the first, from any address, locks what was typed, with or without an
// account (lockout.ts). Better Auth works on the shared database, so this does too.
export async function signIn(
  input: SignInInput,
  requestHeaders: Headers,
  now = new Date(),
): Promise<SignInResult> {
  const db = getDb();
  const collegeId = await findCollegeId(db);
  if (!collegeId) return { status: "invalid" };
  const limits = await signInLimits(collegeId);
  const meta = requestMeta(requestHeaders);
  const identifier = parseIdentifier(input.identifier);
  const account = await findAccount(db, collegeId, identifier);

  // What was typed, together with the address.
  const subject = subjectOf(identifier);
  const attemptKey = `${subject}|${meta.ip ?? "unknown"}`;
  const blockedUntil = await countAttempt(db, attemptKey, limits, now);
  if (blockedUntil) {
    return { status: "throttled", minutes: minutesUntil(blockedUntil, now) };
  }
  const lockout = await beginAttempt(db, subject, limits, now);
  if (lockout.place > limits.lockoutThreshold) {
    return { status: "locked", minutes: minutesUntil(lockout.ends, now) };
  }

  // A wrong password, or no account: the same count, lock and answer.
  const failed = async (): Promise<SignInResult> => {
    if (lockout.place < limits.lockoutThreshold) return { status: "invalid" };
    // This attempt reached the threshold, so its lock starts now.
    if (account) {
      await writeAudit(
        {
          collegeId,
          actorId: null,
          action: "account.lock",
          entityType: "user",
          entityId: account.userId,
          diff: { lockedUntil: lockout.ends.toISOString() },
          ...meta,
        },
        db,
      );
    }
    return { status: "locked", minutes: minutesUntil(lockout.ends, now) };
  };

  if (!account) {
    // As long as checking a password, so the time taken does not tell that no account matched.
    await hashPassword(input.password);
    return failed();
  }

  let result: Awaited<
    ReturnType<ReturnType<typeof getAuth>["api"]["signInEmail"]>
  >;
  try {
    result = await getAuth().api.signInEmail({
      body: {
        email: account.email,
        password: input.password,
        rememberMe: input.remember,
      },
      headers: requestHeaders,
    });
  } catch (error) {
    if (!isAPIError(error) || error.status !== "UNAUTHORIZED") throw error;
    return failed();
  }

  await clearLockouts(db, accountSubjects(account));
  await db.delete(signInAttempts).where(eq(signInAttempts.key, attemptKey));
  if ("twoFactorRedirect" in result) return { status: "twoFactor" };
  await db
    .update(sessions)
    .set({ remembered: input.remember })
    .where(eq(sessions.token, result.token));
  await writeAudit(
    {
      collegeId,
      actorId: account.userId,
      action: "session.signIn",
      entityType: "user",
      entityId: account.userId,
      ...meta,
    },
    db,
  );
  return { status: "signedIn" };
}

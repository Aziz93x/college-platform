import { inArray, lte, sql } from "drizzle-orm";
import type { Db, Tx } from "../../../platform/db/client.ts";
import type { Identifier } from "../domain/identifier.ts";
import { signInLockouts } from "./schema.ts";

const MINUTE_MS = 60_000;

type LockoutLimits = { lockoutThreshold: number; lockoutMinutes: number };

// Attempts count against what was typed, an email or an employee number, whether or not an account
// has it. An account's two identifiers count apart, exactly as two that no account has, so no
// answer tells whether an account exists or which identifiers belong together (ADR-0009).
export const subjectOf = (identifier: Identifier) =>
  `typed:${identifier.kind === "email" ? identifier.email : identifier.employeeNumber}`;

// Both of an account's identifiers, as sign-in counts them.
export const accountSubjects = (account: {
  email: string;
  employeeNumber: string;
}) => [
  subjectOf({ kind: "email", email: account.email }),
  subjectOf({ kind: "employeeNumber", employeeNumber: account.employeeNumber }),
];

// Counts an attempt before its password is checked, so attempts that race each other cannot get
// past the threshold. A count lasts the lockout's minutes from its first attempt. The attempt that
// reaches the threshold starts the lock, which lasts as long from then, and every attempt after it
// is refused unchecked. One statement, so racing attempts each get their own place. Returns the
// attempt's place in the count and when the count, or the lock, ends.
export async function beginAttempt(
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
  const [row] = await db
    .insert(signInLockouts)
    .values({ subject, attempts: 1, startedAt: now })
    .onConflictDoUpdate({
      target: signInLockouts.subject,
      set: {
        attempts: sql`${signInLockouts.attempts} + 1`,
        startedAt: sql`case when ${signInLockouts.attempts} + 1 = ${limits.lockoutThreshold} then ${now} else ${signInLockouts.startedAt} end`,
      },
    })
    .returning();
  return {
    place: row.attempts,
    ends: new Date(row.startedAt.getTime() + limits.lockoutMinutes * MINUTE_MS),
  };
}

// A sign-in clears its account's counts, and an admin's reset lifts its locks.
export async function clearLockouts(db: Db | Tx, subjects: string[]) {
  await db
    .delete(signInLockouts)
    .where(inArray(signInLockouts.subject, subjects));
}

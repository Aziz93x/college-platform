import { isAPIError } from "better-auth/api";
import { hashPassword } from "better-auth/crypto";
import { and, eq, ne } from "drizzle-orm";
import { type Db, getDb, type Tx } from "../../../platform/db/client.ts";
import { writeAudit } from "../../audit/index.ts";
import { getSetting } from "../../settings/index.ts";
import {
  newPasswordSchema,
  temporaryPassword,
} from "../domain/password-policy.ts";
import { getAuth } from "./auth.ts";
import { accountSubjects, clearLockouts } from "./lockout.ts";
import { requestMeta } from "./request.ts";
import { checkRetypedPassword } from "./retype.ts";
import { accounts, people, sessions, users } from "./schema.ts";

const CREDENTIAL_PROVIDER = "credential";

const randomBytes = (length: number) =>
  crypto.getRandomValues(new Uint8Array(length));

type ChangePasswordResult =
  | { status: "changed" }
  | { status: "wrongPassword" }
  | { status: "tooShort"; minLength: number }
  | { status: "unchanged" }
  | { status: "locked"; minutes: number };

// The signed-in person replaces their password, which ends their other sessions and, after a
// temporary password, lets them in.
export async function changePassword(
  input: { currentPassword: string; newPassword: string },
  user: { userId: string; sessionId: string; collegeId: string },
  requestHeaders: Headers,
): Promise<ChangePasswordResult> {
  const minLength = await getSetting("auth.passwordMinLength", {
    collegeId: user.collegeId,
  });
  if (!newPasswordSchema(minLength).safeParse(input.newPassword).success) {
    return { status: "tooShort", minLength };
  }
  if (input.newPassword === input.currentPassword)
    return { status: "unchanged" };
  // The current password counts toward the lockout, as at sign-in (retype.ts).
  const retyped = await checkRetypedPassword(
    user,
    async () => {
      try {
        // Better Auth's own revokeOtherSessions would replace this session with a new remembered
        // one; keeping it keeps the person's "remember this device" choice.
        await getAuth().api.changePassword({
          body: {
            currentPassword: input.currentPassword,
            newPassword: input.newPassword,
          },
          headers: requestHeaders,
        });
        return true;
      } catch (error) {
        if (isAPIError(error) && error.body?.code === "INVALID_PASSWORD") {
          return undefined;
        }
        throw error;
      }
    },
    requestMeta(requestHeaders),
  );
  if (retyped.status === "wrong") return { status: "wrongPassword" };
  if (retyped.status === "locked") return retyped;
  await getDb().transaction(async (tx) => {
    await tx
      .update(users)
      .set({ mustChangePassword: false })
      .where(eq(users.id, user.userId));
    await tx
      .delete(sessions)
      .where(
        and(eq(sessions.userId, user.userId), ne(sessions.id, user.sessionId)),
      );
    await writeAudit(
      {
        collegeId: user.collegeId,
        actorId: user.userId,
        action: "account.changePassword",
        entityType: "user",
        entityId: user.userId,
        ...requestMeta(requestHeaders),
      },
      tx,
    );
  });
  return { status: "changed" };
}

async function setPassword(tx: Tx, userId: string, password: string) {
  const hash = await hashPassword(password);
  const updated = await tx
    .update(accounts)
    .set({ password: hash, updatedAt: new Date() })
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.providerId, CREDENTIAL_PROVIDER),
      ),
    )
    .returning({ id: accounts.id });
  if (updated.length === 0) {
    await tx.insert(accounts).values({
      userId,
      accountId: userId,
      providerId: CREDENTIAL_PROVIDER,
      password: hash,
    });
  }
}

// An admin's password reset, without email: a temporary password to hand over, shown once. It
// signs the person out everywhere, lifts a lockout, and asks for a new password at the next
// sign-in. Always audited, never with the password.
export async function resetPassword(
  target: { userId: string; collegeId: string },
  actor: {
    userId: string | null;
    ip?: string | null;
    userAgent?: string | null;
  },
  db: Db = getDb(),
) {
  const password = temporaryPassword(randomBytes);
  await db.transaction(async (tx) => {
    await setPassword(tx, target.userId, password);
    await tx
      .update(users)
      .set({ mustChangePassword: true })
      .where(eq(users.id, target.userId));
    const [identity] = await tx
      .select({ email: users.email, employeeNumber: people.employeeNumber })
      .from(users)
      .innerJoin(people, eq(people.userId, users.id))
      .where(eq(users.id, target.userId));
    if (identity) await clearLockouts(tx, accountSubjects(identity));
    await tx.delete(sessions).where(eq(sessions.userId, target.userId));
    await writeAudit(
      {
        collegeId: target.collegeId,
        actorId: actor.userId,
        action: "account.resetPassword",
        entityType: "user",
        entityId: target.userId,
        ip: actor.ip,
        userAgent: actor.userAgent,
      },
      tx,
    );
  });
  return password;
}

export type NewAccount = {
  collegeId: string;
  name: string;
  email: string;
  employeeNumber: string;
};

// A person with a credential account. Without a password, a temporary one is made, returned
// once, and the person must replace it at their first sign-in.
export async function createAccount(
  account: NewAccount,
  tx: Tx,
  password?: string,
) {
  const [user] = await tx
    .insert(users)
    .values({
      name: account.name,
      email: account.email.toLowerCase(),
      mustChangePassword: password === undefined,
    })
    .returning({ id: users.id });
  const initial = password ?? temporaryPassword(randomBytes);
  await setPassword(tx, user.id, initial);
  await tx.insert(people).values({
    collegeId: account.collegeId,
    userId: user.id,
    employeeNumber: account.employeeNumber,
  });
  return { userId: user.id, password: initial };
}

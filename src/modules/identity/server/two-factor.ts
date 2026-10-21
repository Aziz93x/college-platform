import { isAPIError } from "better-auth/api";
import { and, eq, sql } from "drizzle-orm";
import { type Db, getDb } from "../../../platform/db/client.ts";
import { writeAudit } from "../../audit/index.ts";
import { getAuth } from "./auth.ts";
import { requestMeta } from "./request.ts";
import { checkRetypedPassword, passwordCheck } from "./retype.ts";
import { people, sessions, twoFactors, users } from "./schema.ts";

function errorCode(error: unknown) {
  return isAPIError(error)
    ? (error.body?.code as string | undefined)
    : undefined;
}

async function collegeOf(userId: string) {
  const [person] = await getDb()
    .select({ collegeId: people.collegeId })
    .from(people)
    .where(eq(people.userId, userId));
  return person?.collegeId;
}

type SignInCodeResult =
  | { status: "signedIn" }
  | { status: "invalid" }
  // Too many wrong codes: the account takes no codes for a while.
  | { status: "locked" }
  // The ten minutes after the password ran out, or too many wrong codes in this attempt: start again.
  | { status: "expired" };

// The second step of signing in: a code from the authenticator app, or a backup code.
export async function verifySignInCode(
  input: { code: string; backup: boolean },
  requestHeaders: Headers,
): Promise<SignInCodeResult> {
  const api = getAuth().api;
  const code = input.code.replace(/\s+/g, "");
  let result: { token?: string; user: { id: string } };
  try {
    result = input.backup
      ? await api.verifyBackupCode({ body: { code }, headers: requestHeaders })
      : await api.verifyTOTP({ body: { code }, headers: requestHeaders });
  } catch (error) {
    const reason = errorCode(error);
    if (reason === "INVALID_CODE" || reason === "INVALID_BACKUP_CODE") {
      return { status: "invalid" };
    }
    if (reason === "ACCOUNT_TEMPORARILY_LOCKED") return { status: "locked" };
    if (isAPIError(error)) return { status: "expired" };
    throw error;
  }
  // Better Auth gave the new session one day unless the password step asked to remember the device.
  if (result.token) {
    await getDb()
      .update(sessions)
      .set({
        remembered: sql`${sessions.expiresAt} - ${sessions.createdAt} > interval '2 days'`,
      })
      .where(eq(sessions.token, result.token));
  }
  const collegeId = await collegeOf(result.user.id);
  if (collegeId) {
    await writeAudit({
      collegeId,
      actorId: result.user.id,
      action: "session.signIn",
      entityType: "user",
      entityId: result.user.id,
      diff: { twoFactor: input.backup ? "backupCode" : "totp" },
      ...requestMeta(requestHeaders),
    });
  }
  return { status: "signedIn" };
}

type TwoFactorSetup =
  | {
      status: "started";
      uri: string;
      secret: string;
      backupCodes: string[];
    }
  | { status: "wrongPassword" }
  | { status: "locked"; minutes: number };

// Starts setting up two-factor for the signed-in person, after their password again: returns what
// the authenticator app scans, the secret to type instead, and the backup codes to keep. Nothing
// changes at sign-in until the first code confirms it.
export async function startTwoFactorSetup(
  input: { password: string; issuer: string },
  user: { userId: string; collegeId: string },
  requestHeaders: Headers,
): Promise<TwoFactorSetup> {
  // The password counts toward the lockout, as at sign-in (retype.ts).
  const retyped = await checkRetypedPassword(
    user,
    async () => {
      try {
        return await getAuth().api.enableTwoFactor({
          body: {
            password: input.password,
            issuer: input.issuer,
            method: "totp",
          },
          headers: requestHeaders,
        });
      } catch (error) {
        if (errorCode(error) === "INVALID_PASSWORD") return undefined;
        throw error;
      }
    },
    requestMeta(requestHeaders),
  );
  if (retyped.status === "wrong") return { status: "wrongPassword" };
  if (retyped.status === "locked") return retyped;
  const result = retyped.value;
  if (result.method !== "totp")
    throw new Error("two-factor setup did not return TOTP");
  await writeAudit({
    collegeId: user.collegeId,
    actorId: user.userId,
    action: "account.startTwoFactorSetup",
    entityType: "user",
    entityId: user.userId,
    ...requestMeta(requestHeaders),
  });
  return {
    status: "started",
    uri: result.totpURI,
    secret: new URL(result.totpURI).searchParams.get("secret") ?? "",
    backupCodes: result.backupCodes,
  };
}

// Finishes the setup with the first code from the app; from then on, signing in asks for a code.
export async function confirmTwoFactorSetup(
  code: string,
  user: { userId: string; collegeId: string },
  requestHeaders: Headers,
): Promise<{ status: "enabled" } | { status: "invalid" }> {
  try {
    await getAuth().api.verifyTOTP({
      body: { code: code.replace(/\s+/g, "") },
      headers: requestHeaders,
    });
  } catch (error) {
    if (errorCode(error) === "INVALID_CODE") return { status: "invalid" };
    throw error;
  }
  await writeAudit({
    collegeId: user.collegeId,
    actorId: user.userId,
    action: "account.enableTwoFactor",
    entityType: "user",
    entityId: user.userId,
    ...requestMeta(requestHeaders),
  });
  return { status: "enabled" };
}

// Who turns two-factor off, for the audit event: its owner, or an admin the caller has authorized
// for this person.
type Change = {
  collegeId: string;
  actorId: string;
  ip?: string | null;
  userAgent?: string | null;
};

// Turns a person's two-factor off (ADR-0014): signing in asks for the password alone, and the app's
// secret and backup codes are gone, so turning it on again starts from a new one. Their sessions
// stay. Records account.disableTwoFactor.
export async function turnOffTwoFactor(
  userId: string,
  change: Change,
  db: Db = getDb(),
): Promise<"off" | "notOn"> {
  return db.transaction(async (tx) => {
    const turned = await tx
      .update(users)
      .set({ twoFactorEnabled: false, updatedAt: new Date() })
      .where(and(eq(users.id, userId), eq(users.twoFactorEnabled, true)))
      .returning({ id: users.id });
    if (turned.length === 0) return "notOn";
    await tx.delete(twoFactors).where(eq(twoFactors.userId, userId));
    await writeAudit(
      {
        collegeId: change.collegeId,
        actorId: change.actorId,
        action: "account.disableTwoFactor",
        entityType: "user",
        entityId: userId,
        ip: change.ip,
        userAgent: change.userAgent,
      },
      tx,
    );
    return "off";
  });
}

type TurnOffOwn =
  | { status: "off" | "notOn" }
  | { status: "wrongPassword" }
  | { status: "locked"; minutes: number };

// The signed-in person turns their own two-factor off, after their password again, which counts
// toward the lockout as at sign-in (retype.ts). Whether the college lets them is the caller's.
export async function turnOffOwnTwoFactor(
  password: string,
  user: { userId: string; collegeId: string },
  requestHeaders: Headers,
): Promise<TurnOffOwn> {
  const meta = requestMeta(requestHeaders);
  const retyped = await checkRetypedPassword(
    user,
    passwordCheck(password, requestHeaders),
    meta,
  );
  if (retyped.status === "wrong") return { status: "wrongPassword" };
  if (retyped.status === "locked") return retyped;
  const status = await turnOffTwoFactor(user.userId, {
    collegeId: user.collegeId,
    actorId: user.userId,
    ...meta,
  });
  return { status };
}

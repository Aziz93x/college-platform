import { isAPIError } from "better-auth/api";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../../../platform/db/client.ts";
import { writeAudit } from "../../audit/index.ts";
import { getAuth } from "./auth.ts";
import { requestMeta } from "./request.ts";
import { people, sessions } from "./schema.ts";

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

export type SignInCodeResult =
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

export type TwoFactorSetup =
  | {
      status: "started";
      uri: string;
      secret: string;
      backupCodes: string[];
    }
  | { status: "wrongPassword" };

// Starts setting up two-factor for the signed-in person, after their password again: returns what
// the authenticator app scans, the secret to type instead, and the backup codes to keep.
export async function startTwoFactorSetup(
  input: { password: string; issuer: string },
  requestHeaders: Headers,
): Promise<TwoFactorSetup> {
  try {
    const result = await getAuth().api.enableTwoFactor({
      body: { password: input.password, issuer: input.issuer, method: "totp" },
      headers: requestHeaders,
    });
    if (result.method !== "totp")
      throw new Error("two-factor setup did not return TOTP");
    const secret = new URL(result.totpURI).searchParams.get("secret") ?? "";
    return {
      status: "started",
      uri: result.totpURI,
      secret,
      backupCodes: result.backupCodes,
    };
  } catch (error) {
    if (errorCode(error) === "INVALID_PASSWORD")
      return { status: "wrongPassword" };
    throw error;
  }
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

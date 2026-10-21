import { eq } from "drizzle-orm";
import { getDb } from "../../../platform/db/client.ts";
import { getSetting } from "../../settings/index.ts";
import { requestMeta } from "./request.ts";
import { checkRetypedPassword, passwordCheck } from "./retype.ts";
import { sessions } from "./schema.ts";

type Reauthentication =
  | { status: "confirmed" }
  | { status: "passwordRequired" }
  | { status: "wrongPassword" }
  | { status: "locked"; minutes: number };

// The step before a sensitive change (ADR-0009): a security setting here, the role grid and
// password resets from Steps 9 and 10. A password typed on this session within the last
// auth.reauthMinutes is enough; otherwise the change needs it again, typed now. That password is
// checked like any password typed behind a session (retype.ts), so it counts toward the lockout,
// and a right one starts the window again.
export async function reauthenticate(
  password: string | undefined,
  user: { userId: string; sessionId: string; collegeId: string },
  requestHeaders: Headers,
  now = new Date(),
): Promise<Reauthentication> {
  const db = getDb();
  const minutes = await getSetting("auth.reauthMinutes", {
    collegeId: user.collegeId,
  });
  const [session] = await db
    .select({ passwordEnteredAt: sessions.passwordEnteredAt })
    .from(sessions)
    .where(eq(sessions.id, user.sessionId));
  if (
    session &&
    now.getTime() - session.passwordEnteredAt.getTime() < minutes * 60_000
  ) {
    return { status: "confirmed" };
  }
  if (password === undefined) return { status: "passwordRequired" };

  const retyped = await checkRetypedPassword(
    user,
    passwordCheck(password, requestHeaders),
    requestMeta(requestHeaders),
    now,
  );
  if (retyped.status === "wrong") return { status: "wrongPassword" };
  if (retyped.status === "locked") return retyped;
  await db
    .update(sessions)
    .set({ passwordEnteredAt: now })
    .where(eq(sessions.id, user.sessionId));
  return { status: "confirmed" };
}

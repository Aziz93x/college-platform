import { randomBytes } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import messages from "../../../messages/ar.json" with { type: "json" };
import { people, sessions } from "../../../src/modules/identity/index.ts";
import { generationRuns } from "../../../src/modules/tasks/index.ts";
import { activeTerm } from "../../../src/modules/terms/index.ts";
import { type Catalog, setText } from "../../../src/modules/texts/index.ts";
import type { Db } from "../../../src/platform/db/client.ts";
import { demoAccounts } from "./accounts.ts";
import { deviceOf } from "./device.ts";

// The college's own wording of the sign-in page's help: where its people go for a new password.
export const demoSignInHelp =
  "نسيت كلمة المرور؟ راجع وحدة تقنية المعلومات في مبنى الإدارة، أو اطلب كلمة مرور مؤقتة ممن يصدرها في كليتك.";

// The head of Electrical's phone on the college's Wi-Fi, beside the desktop they last signed in on.
const HEAD_PHONE = {
  ip: "10.40.2.61",
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1",
};

// The trainer's phone on mobile data, whose address is IPv6, kept in full as sign-in keeps it: one
// long word on the person page (an address from the range kept for documentation).
const TRAINER_PHONE = {
  ip: "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
  userAgent: HEAD_PHONE.userAgent,
};

// The admin's control panel (ADR-0029): the admin's wording of the sign-in page's help; the head
// of Electrical signed in on their desktop and their phone, and the trainer on the device of their
// last sign-in and their phone, as the person pages list them; and the nightly pass of the generation engine the
// night before that failed when the database restarted, which the next pass made good. Written
// once: the text is unchanged on a re-run, and the sessions and the pass are added only when the
// head has none and the term has no failed pass.
export async function seedDemoControlPanel(
  { db }: { db: Db },
  collegeId: string,
) {
  const accounts = new Map(
    (
      await db
        .select({ number: people.employeeNumber, userId: people.userId })
        .from(people)
        .where(
          and(
            eq(people.collegeId, collegeId),
            inArray(people.employeeNumber, [
              demoAccounts.admin.employeeNumber,
              demoAccounts.head.employeeNumber,
              demoAccounts.trainer.employeeNumber,
            ]),
          ),
        )
    ).map(({ number, userId }) => [number, userId]),
  );
  const userOf = (account: { employeeNumber: string }) => {
    const userId = accounts.get(account.employeeNumber);
    if (!userId) throw new Error("seed:demo: a demo account is missing");
    return userId;
  };
  const admin = userOf(demoAccounts.admin);
  await setText(
    "auth.signIn.help",
    demoSignInHelp,
    messages as Catalog,
    { collegeId, actorId: admin, ...(await deviceOf(db, collegeId, admin)) },
    db,
  );

  const head = userOf(demoAccounts.head);
  const [signedIn] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.userId, head))
    .limit(1);
  if (!signedIn) {
    const trainer = userOf(demoAccounts.trainer);
    const [desk, trainerDevice] = await Promise.all([
      deviceOf(db, collegeId, head),
      deviceOf(db, collegeId, trainer),
    ]);
    const session = (
      userId: string,
      device: { ip?: string | null; userAgent?: string | null },
      hoursAgo: number,
    ) => ({
      userId,
      token: randomBytes(32).toString("base64url"),
      ipAddress: device.ip ?? null,
      userAgent: device.userAgent ?? null,
      createdAt: sql`now() - make_interval(hours => ${hoursAgo})`,
      passwordEnteredAt: sql`now() - make_interval(hours => ${hoursAgo})`,
      lastSeenAt: sql`now() - interval '20 minutes'`,
      expiresAt: sql`now() + interval '1 day'`,
    });
    await db
      .insert(sessions)
      .values([
        session(head, desk, 3),
        session(head, HEAD_PHONE, 1),
        session(trainer, trainerDevice, 2),
        session(trainer, TRAINER_PHONE, 5),
      ]);
  }

  const term = await activeTerm(collegeId, db);
  if (!term) return;
  const [failed] = await db
    .select({ id: generationRuns.id })
    .from(generationRuns)
    .where(
      and(
        eq(generationRuns.termId, term.id),
        eq(generationRuns.status, "failed"),
      ),
    )
    .limit(1);
  if (failed) return;
  await db.insert(generationRuns).values({
    collegeId,
    termId: term.id,
    reason: "daily",
    status: "failed",
    error: "Connection terminated unexpectedly",
    queuedAt: sql`now() - interval '1 day'`,
    startedAt: sql`now() - interval '1 day'`,
    finishedAt: sql`now() - interval '1 day' + interval '4 seconds'`,
  });
}

import { and, eq, gt, gte, inArray, ne } from "drizzle-orm";
import { type Db, getDb, type Tx } from "../../../platform/db/client.ts";
import { writeAudit } from "../../audit/index.ts";
import { getSetting } from "../../settings/index.ts";
import { accountSubjects } from "./lockout.ts";
import { people, sessions, signInLockouts, users } from "./schema.ts";

// Who changes someone's account, for the audit event. The caller has authorized them for this
// person.
type Change = {
  collegeId: string;
  actorId: string;
  ip?: string | null;
  userAgent?: string | null;
};

type Account = { userId: string; email: string; employeeNumber: string };

const MINUTE_MS = 60_000;

// The accounts among these that wrong passwords lock now: one of their two identifiers reached the
// lockout's threshold less than its minutes ago (lockout.ts).
export async function lockedAccounts(
  collegeId: string,
  accounts: Account[],
  db: Db = getDb(),
  now = new Date(),
) {
  const owners = new Map<string, string>();
  for (const account of accounts) {
    for (const subject of accountSubjects(account)) {
      owners.set(subject, account.userId);
    }
  }
  if (owners.size === 0) return new Set<string>();
  const [threshold, minutes] = await Promise.all([
    getSetting("auth.lockoutThreshold", { collegeId }),
    getSetting("auth.lockoutMinutes", { collegeId }),
  ]);
  const rows = await db
    .select({ subject: signInLockouts.subject })
    .from(signInLockouts)
    .where(
      and(
        inArray(signInLockouts.subject, [...owners.keys()]),
        gte(signInLockouts.attempts, threshold),
        gt(
          signInLockouts.startedAt,
          new Date(now.getTime() - minutes * MINUTE_MS),
        ),
      ),
    );
  return new Set(rows.map((row) => owners.get(row.subject) as string));
}

// The person's account row, locked while it changes: undefined for anyone outside the college.
async function lockAccount(tx: Tx, userId: string, collegeId: string) {
  const [account] = await tx
    .select({
      name: users.name,
      email: users.email,
      employeeNumber: people.employeeNumber,
      disabled: users.disabledAt,
    })
    .from(users)
    .innerJoin(people, eq(people.userId, users.id))
    .where(and(eq(users.id, userId), eq(people.collegeId, collegeId)))
    .for("update");
  return account;
}

// Corrects a person's name and the email they sign in with, and records person.update with each
// changed field before and after. An email another account has is refused.
export async function updatePerson(
  userId: string,
  input: { name: string; email: string },
  change: Change,
  db: Db = getDb(),
): Promise<{
  status: "saved" | "unchanged" | "notFound" | "emailTaken";
}> {
  return db.transaction(async (tx) => {
    const current = await lockAccount(tx, userId, change.collegeId);
    if (!current) return { status: "notFound" };
    const from: Record<string, string> = {};
    const to: Record<string, string> = {};
    for (const key of ["name", "email"] as const) {
      if (current[key] !== input[key]) {
        from[key] = current[key];
        to[key] = input[key];
      }
    }
    if (Object.keys(to).length === 0) return { status: "unchanged" };
    if (to.email) {
      const [taken] = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, input.email), ne(users.id, userId)));
      if (taken) return { status: "emailTaken" };
    }
    await tx
      .update(users)
      .set({ name: input.name, email: input.email, updatedAt: new Date() })
      .where(eq(users.id, userId));
    await writeAudit(
      {
        collegeId: change.collegeId,
        actorId: change.actorId,
        action: "person.update",
        entityType: "user",
        entityId: userId,
        diff: { from, to },
        ip: change.ip,
        userAgent: change.userAgent,
      },
      tx,
    );
    return { status: "saved" };
  });
}

// Links a person to the employee number Rayat's reports carry, which they sign in with too, and
// records person.linkEmployeeNumber with the number before and after. A number another person of
// the college has is refused.
export async function linkEmployeeNumber(
  userId: string,
  employeeNumber: string,
  change: Change,
  db: Db = getDb(),
): Promise<{ status: "saved" | "unchanged" | "notFound" | "taken" }> {
  return db.transaction(async (tx) => {
    const current = await lockAccount(tx, userId, change.collegeId);
    if (!current) return { status: "notFound" };
    if (current.employeeNumber === employeeNumber) {
      return { status: "unchanged" };
    }
    const [taken] = await tx
      .select({ userId: people.userId })
      .from(people)
      .where(
        and(
          eq(people.collegeId, change.collegeId),
          eq(people.employeeNumber, employeeNumber),
        ),
      );
    if (taken) return { status: "taken" };
    await tx
      .update(people)
      .set({ employeeNumber, updatedAt: new Date() })
      .where(eq(people.userId, userId));
    await writeAudit(
      {
        collegeId: change.collegeId,
        actorId: change.actorId,
        action: "person.linkEmployeeNumber",
        entityType: "user",
        entityId: userId,
        diff: {
          from: { employeeNumber: current.employeeNumber },
          to: { employeeNumber },
        },
        ip: change.ip,
        userAgent: change.userAgent,
      },
      tx,
    );
    return { status: "saved" };
  });
}

// Disables an account, or enables it again, inside the caller's transaction. A disabled account
// signs in nowhere: its sessions end with it, and sign-in and every request refuse it. Records
// account.disable or account.enable.
export async function setAccountDisabled(
  userId: string,
  disabled: boolean,
  change: Change,
  tx: Tx,
): Promise<"saved" | "unchanged" | "notFound"> {
  const current = await lockAccount(tx, userId, change.collegeId);
  if (!current) return "notFound";
  if ((current.disabled !== null) === disabled) return "unchanged";
  await tx
    .update(users)
    .set({ disabledAt: disabled ? new Date() : null, updatedAt: new Date() })
    .where(eq(users.id, userId));
  if (disabled) await tx.delete(sessions).where(eq(sessions.userId, userId));
  await writeAudit(
    {
      collegeId: change.collegeId,
      actorId: change.actorId,
      action: disabled ? "account.disable" : "account.enable",
      entityType: "user",
      entityId: userId,
      ip: change.ip,
      userAgent: change.userAgent,
    },
    tx,
  );
  return "saved";
}

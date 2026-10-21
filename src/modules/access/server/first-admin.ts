import { and, eq } from "drizzle-orm";
import { type Db, getDb } from "../../../platform/db/client.ts";
import { writeAudit } from "../../audit/index.ts";
import { createAccount, type NewAccount } from "../../identity/index.ts";
import { joinRole } from "./roles.ts";
import { memberships, roles } from "./schema.ts";

export type FirstAdminResult =
  | { status: "created"; userId: string; password: string }
  | { status: "adminExists" }
  | { status: "noSystemRole" };

// The college's first admin, made from the terminal: a person holding the system role, with a
// temporary password that is shown once and replaced at the first sign-in. Refuses once the role
// has a member, so the terminal never becomes a way around the admins.
export async function createFirstAdmin(
  account: NewAccount,
  db: Db = getDb(),
): Promise<FirstAdminResult> {
  return db.transaction(async (tx) => {
    // Locks the role, so two runs at once cannot both find it without a member.
    const [role] = await tx
      .select({ id: roles.id, key: roles.key })
      .from(roles)
      .where(
        and(eq(roles.collegeId, account.collegeId), eq(roles.system, true)),
      )
      .for("update");
    if (!role) return { status: "noSystemRole" };
    const [member] = await tx
      .select({ id: memberships.id })
      .from(memberships)
      .where(eq(memberships.roleId, role.id))
      .limit(1);
    if (member) return { status: "adminExists" };

    const { userId, password } = await createAccount(account, tx);
    await joinRole(
      { userId, collegeId: account.collegeId, role: { system: true } },
      tx,
    );
    await writeAudit(
      {
        collegeId: account.collegeId,
        actorId: null,
        action: "account.create",
        entityType: "user",
        entityId: userId,
        diff: { role: role.key },
      },
      tx,
    );
    return { status: "created", userId, password };
  });
}

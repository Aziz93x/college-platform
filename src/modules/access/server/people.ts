import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { type Db, getDb, type Tx } from "../../../platform/db/client.ts";
import {
  type AccountState,
  accountState,
  lockedAccounts,
  people,
  setAccountDisabled,
  users,
} from "../../identity/index.ts";
import { terms } from "../../terms/index.ts";
import {
  isPermissionKey,
  type PermissionKey,
  permissionKeys,
} from "../domain/permissions.ts";
import type { AccountHolder } from "../domain/reach.ts";
import { inForce } from "./members.ts";
import { memberships, rolePermissions, roles } from "./schema.ts";

type Change = {
  collegeId: string;
  actorId: string;
  ip?: string | null;
  userAgent?: string | null;
};

// A person of the college as the people list and their page show them: their account, its state,
// each role they hold and where, and every key those roles give (to see whose account a key reaches).
export type PersonEntry = {
  userId: string;
  name: string;
  email: string;
  employeeNumber: string;
  state: AccountState;
  // Signing in asks them for a code from their authenticator app.
  twoFactor: boolean;
  memberships: {
    id: string;
    roleId: string;
    roleLabels: Record<string, string>;
    system: boolean;
    departmentId: string | null;
  }[];
  permissions: AccountHolder["permissions"];
};

// Whom an announcement to a scope reaches (ADR-0017): the college's enabled accounts, or those of
// them who hold a role in force in the department, as access counts it.
export async function enabledPeopleIn(
  collegeId: string,
  departmentId: string | null,
  db: Db | Tx = getDb(),
) {
  const rows = await db
    .select({ userId: people.userId })
    .from(people)
    .innerJoin(users, eq(users.id, people.userId))
    .where(
      and(
        eq(people.collegeId, collegeId),
        isNull(users.disabledAt),
        departmentId === null
          ? undefined
          : inArray(
              people.userId,
              db
                .select({ userId: memberships.userId })
                .from(memberships)
                .leftJoin(terms, eq(terms.id, memberships.termId))
                .where(
                  and(
                    eq(memberships.collegeId, collegeId),
                    eq(memberships.departmentId, departmentId),
                    inForce,
                  ),
                ),
            ),
      ),
    );
  return rows.map(({ userId }) => userId);
}

// The college's people by name: everyone, the people who hold a role in one of these departments,
// or one person.
export async function listDirectory(
  collegeId: string,
  only: { departments?: readonly string[]; userId?: string } = {},
  db: Db = getDb(),
): Promise<PersonEntry[]> {
  const conditions = [eq(people.collegeId, collegeId)];
  if (only.userId) conditions.push(eq(people.userId, only.userId));
  if (only.departments) {
    conditions.push(
      inArray(
        people.userId,
        db
          .select({ userId: memberships.userId })
          .from(memberships)
          .where(
            and(
              eq(memberships.collegeId, collegeId),
              inArray(memberships.departmentId, [...only.departments]),
            ),
          ),
      ),
    );
  }
  const accounts = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      employeeNumber: people.employeeNumber,
      mustChangePassword: users.mustChangePassword,
      disabledAt: users.disabledAt,
      twoFactor: users.twoFactorEnabled,
    })
    .from(people)
    .innerJoin(users, eq(users.id, people.userId))
    .where(and(...conditions))
    .orderBy(asc(users.name));
  if (accounts.length === 0) return [];
  const userIds = accounts.map((account) => account.userId);
  const [held, locked] = await Promise.all([
    db
      .select({
        id: memberships.id,
        userId: memberships.userId,
        roleId: roles.id,
        roleLabels: roles.labels,
        system: roles.system,
        departmentId: memberships.departmentId,
      })
      .from(memberships)
      .innerJoin(roles, eq(roles.id, memberships.roleId))
      .where(inArray(memberships.userId, userIds)),
    lockedAccounts(collegeId, accounts, db),
  ]);
  const keys = await db
    .select({
      roleId: rolePermissions.roleId,
      permission: rolePermissions.permission,
    })
    .from(rolePermissions)
    .where(
      inArray(rolePermissions.roleId, [...new Set(held.map((m) => m.roleId))]),
    );
  const keysOf = (roleId: string, system: boolean): PermissionKey[] =>
    system
      ? permissionKeys
      : keys
          .filter((key) => key.roleId === roleId)
          .map((key) => key.permission)
          .filter(isPermissionKey);

  return accounts.map(({ mustChangePassword, disabledAt, ...account }) => {
    const own = held
      .filter((membership) => membership.userId === account.userId)
      .map(({ userId: _userId, ...membership }) => membership);
    return {
      ...account,
      state: accountState({
        disabled: disabledAt !== null,
        locked: locked.has(account.userId),
        mustChangePassword,
      }),
      memberships: own,
      permissions: new Set(
        own.flatMap((membership) =>
          keysOf(membership.roleId, membership.system),
        ),
      ),
    };
  });
}

// Disables someone's account, or enables it again (Step 10). No one disables their own account,
// and the college keeps an admin who can sign in: the system role's last enabled member stays so.
export async function disableAccount(
  userId: string,
  disabled: boolean,
  change: Change,
  db: Db = getDb(),
): Promise<{
  status: "saved" | "unchanged" | "notFound" | "self" | "lastAdmin";
}> {
  if (disabled && userId === change.actorId) return { status: "self" };
  return db.transaction(async (tx) => {
    if (disabled) {
      // Locks the system role, so two disables at once cannot both leave the other as its last.
      const [systemRole] = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(
          and(eq(roles.collegeId, change.collegeId), eq(roles.system, true)),
        )
        .for("update");
      const admins = systemRole
        ? await tx
            .select({ userId: memberships.userId })
            .from(memberships)
            .innerJoin(users, eq(users.id, memberships.userId))
            .where(
              and(
                eq(memberships.roleId, systemRole.id),
                isNull(users.disabledAt),
              ),
            )
        : [];
      if (admins.length === 1 && admins[0].userId === userId) {
        return { status: "lastAdmin" };
      }
    }
    return { status: await setAccountDisabled(userId, disabled, change, tx) };
  });
}

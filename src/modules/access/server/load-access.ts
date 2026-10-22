import { and, eq, isNull, or } from "drizzle-orm";
import { type Db, getDb } from "../../../platform/db/client.ts";
import { terms } from "../../terms/index.ts";
import type { Grant } from "../domain/authorize.ts";
import {
  isPermissionKey,
  type PermissionKey,
  permissionKeys,
} from "../domain/permissions.ts";
import { memberships, rolePermissions, roles } from "./schema.ts";

// The roles a person holds in a college and what they give: each key in its membership's scope
// (the grants that authorize() checks), and every key held anywhere (for the navigation and the
// two-factor rule). The system role gives every key in code; stored keys the code no longer knows
// give nothing. A role held in one term gives its keys while that term is the active one.
export async function loadAccess(
  userId: string,
  collegeId: string,
  db: Db = getDb(),
) {
  const rows = await db
    .select({
      roleKey: roles.key,
      system: roles.system,
      departmentId: memberships.departmentId,
      permission: rolePermissions.permission,
    })
    .from(memberships)
    .innerJoin(roles, eq(roles.id, memberships.roleId))
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .leftJoin(terms, eq(terms.id, memberships.termId))
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.collegeId, collegeId),
        or(isNull(memberships.termId), eq(terms.status, "active")),
      ),
    );
  const grants: Grant[] = [];
  for (const { system, departmentId, permission } of rows) {
    const keys: PermissionKey[] = system
      ? permissionKeys
      : permission && isPermissionKey(permission)
        ? [permission]
        : [];
    for (const key of keys) {
      if (
        !grants.some(
          (grant) =>
            grant.permission === key && grant.departmentId === departmentId,
        )
      ) {
        grants.push({ permission: key, departmentId });
      }
    }
  }
  const permissions = new Set(grants.map((grant) => grant.permission));
  const roleKeys = [...new Set(rows.map((row) => row.roleKey))];
  return { grants, permissions, roleKeys };
}

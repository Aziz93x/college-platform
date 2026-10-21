import { and, eq } from "drizzle-orm";
import { type Db, getDb } from "../../../platform/db/client.ts";
import {
  isPermissionKey,
  type PermissionKey,
  permissionKeys,
} from "../domain/permissions.ts";
import { memberships, rolePermissions, roles } from "./schema.ts";

// The roles a person holds in a college and the permissions those roles give them. The system
// role gives every key in code; stored keys the code no longer knows give nothing.
export async function loadAccess(
  userId: string,
  collegeId: string,
  db: Db = getDb(),
) {
  const rows = await db
    .select({
      roleKey: roles.key,
      system: roles.system,
      permission: rolePermissions.permission,
    })
    .from(memberships)
    .innerJoin(roles, eq(roles.id, memberships.roleId))
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .where(
      and(eq(memberships.userId, userId), eq(memberships.collegeId, collegeId)),
    );
  const permissions = new Set<PermissionKey>(
    rows.some((row) => row.system) ? permissionKeys : [],
  );
  for (const { permission } of rows) {
    if (permission && isPermissionKey(permission)) permissions.add(permission);
  }
  const roleKeys = [...new Set(rows.map((row) => row.roleKey))];
  return { permissions, roleKeys };
}

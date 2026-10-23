import { and, asc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { type Db, getDb, type Tx } from "../../../platform/db/client.ts";
import { people, users } from "../../identity/index.ts";
import { departments } from "../../org/index.ts";
import { terms } from "../../terms/index.ts";
import type { PermissionKey } from "../domain/permissions.ts";
import { memberships, rolePermissions } from "./schema.ts";

// A role in force: held for every term, or for the term that is active, as access counts it.
export const inForce = or(
  isNull(memberships.termId),
  eq(terms.status, "active"),
);

// Each enabled account that holds a role in an active department in a term, held for every term or
// for that one, once for each role and department: whom a framework's, a plan's or an assignment's
// items reach in that term, in the preview and in the generation engine alike (Steps 15, 20 and
// 21). A draft term that a head prepares counts its own holders, not the active term's (Audit 7).
export async function roleHolders(
  collegeId: string,
  termId: string,
  db: Db | Tx = getDb(),
) {
  const rows = await db
    .selectDistinct({
      departmentId: memberships.departmentId,
      roleId: memberships.roleId,
      userId: memberships.userId,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .innerJoin(departments, eq(departments.id, memberships.departmentId))
    .where(
      and(
        eq(memberships.collegeId, collegeId),
        isNotNull(memberships.departmentId),
        isNull(users.disabledAt),
        eq(departments.active, true),
        or(isNull(memberships.termId), eq(memberships.termId, termId)),
      ),
    );
  return rows.map(({ departmentId, ...row }) => ({
    ...row,
    departmentId: departmentId ?? "",
  }));
}

// The enabled people who hold a key through a role in force in each of these departments, by name:
// whom a department's work goes to, such as a section's trainers (Step 17), and who hears of it.
export async function holdersIn(
  collegeId: string,
  departmentIds: readonly string[],
  key: PermissionKey,
  db: Db | Tx = getDb(),
) {
  const held = new Map<
    string,
    { userId: string; name: string; employeeNumber: string }[]
  >(departmentIds.map((id) => [id, []]));
  if (departmentIds.length === 0) return held;
  const rows = await db
    .selectDistinct({
      departmentId: memberships.departmentId,
      userId: users.id,
      name: users.name,
      employeeNumber: people.employeeNumber,
    })
    .from(memberships)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, memberships.roleId))
    .innerJoin(users, eq(users.id, memberships.userId))
    .innerJoin(people, eq(people.userId, memberships.userId))
    .leftJoin(terms, eq(terms.id, memberships.termId))
    .where(
      and(
        eq(memberships.collegeId, collegeId),
        inArray(memberships.departmentId, [...departmentIds]),
        eq(rolePermissions.permission, key),
        isNull(users.disabledAt),
        inForce,
      ),
    )
    .orderBy(asc(users.name), asc(users.id));
  for (const { departmentId, ...person } of rows) {
    if (departmentId) held.get(departmentId)?.push(person);
  }
  return held;
}

// The enabled people who hold a key through a role in force across the college, by name: whom the
// readiness board names for what a key settles (Step 22). The system role holds every key in code,
// not through its role's keys, so its holders are not named for each.
export async function holdersAcross(
  collegeId: string,
  key: PermissionKey,
  db: Db | Tx = getDb(),
) {
  return db
    .selectDistinct({ userId: users.id, name: users.name })
    .from(memberships)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, memberships.roleId))
    .innerJoin(users, eq(users.id, memberships.userId))
    .leftJoin(terms, eq(terms.id, memberships.termId))
    .where(
      and(
        eq(memberships.collegeId, collegeId),
        isNull(memberships.departmentId),
        eq(rolePermissions.permission, key),
        isNull(users.disabledAt),
        inForce,
      ),
    )
    .orderBy(asc(users.name), asc(users.id));
}

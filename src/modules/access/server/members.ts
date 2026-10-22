import {
  and,
  asc,
  countDistinct,
  eq,
  inArray,
  isNotNull,
  isNull,
  or,
} from "drizzle-orm";
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

// How many enabled accounts hold each role in each active department, a role held for one term
// counting while that term is active: whom a framework's or a plan's items reach (Step 15). Someone
// who holds the role both for every term and for this one is one person (Audit 5).
export async function countMembers(collegeId: string, db: Db = getDb()) {
  const rows = await db
    .select({
      departmentId: memberships.departmentId,
      roleId: memberships.roleId,
      count: countDistinct(memberships.userId),
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .innerJoin(departments, eq(departments.id, memberships.departmentId))
    .leftJoin(terms, eq(terms.id, memberships.termId))
    .where(
      and(
        eq(memberships.collegeId, collegeId),
        isNotNull(memberships.departmentId),
        isNull(users.disabledAt),
        eq(departments.active, true),
        inForce,
      ),
    )
    .groupBy(memberships.departmentId, memberships.roleId);
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

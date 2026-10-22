import { and, countDistinct, eq, isNotNull, isNull, or } from "drizzle-orm";
import { type Db, getDb } from "../../../platform/db/client.ts";
import { users } from "../../identity/index.ts";
import { departments } from "../../org/index.ts";
import { terms } from "../../terms/index.ts";
import { memberships } from "./schema.ts";

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
        or(isNull(memberships.termId), eq(terms.status, "active")),
      ),
    )
    .groupBy(memberships.departmentId, memberships.roleId);
  return rows.map(({ departmentId, ...row }) => ({
    ...row,
    departmentId: departmentId ?? "",
  }));
}

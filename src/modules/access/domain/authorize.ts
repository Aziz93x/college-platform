import type { PermissionKey } from "./permissions.ts";

// A key a role gives in a membership's scope: across the whole college, or in one department.
export type Grant = { permission: PermissionKey; departmentId: string | null };

// Who acts: the keys their roles give them in their college, each with its scope.
export type Actor = {
  userId: string;
  collegeId: string;
  grants: readonly Grant[];
};

// What the action touches: the college, or one of its departments; and, for a key that covers only
// one's own records, whose record it is.
export type Scope = {
  collegeId: string;
  departmentId?: string;
  ownerId?: string;
};

// The one check every server action and page makes (docs/PLAN.md, principle 3): hiding a button
// is only cosmetic. A key held across the college reaches every department; a key held in one
// department reaches that department only, and nothing college-wide.
export function authorize(
  actor: Actor,
  permission: PermissionKey,
  scope: Scope,
) {
  if (actor.collegeId !== scope.collegeId) return false;
  if (scope.ownerId !== undefined && scope.ownerId !== actor.userId) {
    return false;
  }
  return actor.grants.some(
    (grant) =>
      grant.permission === permission &&
      (grant.departmentId === null ||
        grant.departmentId === scope.departmentId),
  );
}

// Where the actor holds a key, for a query to keep to: the whole college, or these departments
// (none when the actor does not hold it).
export function permittedDepartments(
  actor: Actor,
  permission: PermissionKey,
): "college" | string[] {
  const held = actor.grants.filter((grant) => grant.permission === permission);
  if (held.some((grant) => grant.departmentId === null)) return "college";
  return [...new Set(held.map((grant) => grant.departmentId as string))];
}

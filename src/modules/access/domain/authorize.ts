import type { PermissionKey } from "./permissions.ts";

// Who acts: the permissions their roles give them in their college.
export type Actor = {
  collegeId: string;
  permissions: ReadonlySet<PermissionKey>;
};

// What the action touches. College-wide for now; Step 9 adds departments and the actor's own records.
export type Scope = { collegeId: string };

// The one check every server action and page makes (docs/PLAN.md, principle 3): hiding a button
// is only cosmetic.
export function authorize(
  actor: Actor,
  permission: PermissionKey,
  scope: Scope,
) {
  return (
    actor.collegeId === scope.collegeId && actor.permissions.has(permission)
  );
}

import { type Actor, permittedDepartments } from "./authorize.ts";
import { type PermissionKey, requiresTwoFactor } from "./permissions.ts";

// Someone whose account an action touches: where each of their roles is held, and every key those
// roles give them.
export type AccountHolder = {
  memberships: readonly { departmentId: string | null }[];
  permissions: ReadonlySet<PermissionKey>;
};

// Whether an actor's key reaches someone's account (Step 10). Held across the college, it reaches
// everyone in the college. Held in some departments, it reaches the people who hold a role in one
// of them, none across the college, and no key that requires two-factor: a head helps their own
// trainers, never the dean, an admin or another head.
export function reachesAccount(
  actor: Actor,
  permission: PermissionKey,
  holder: AccountHolder,
) {
  const scope = permittedDepartments(actor, permission);
  if (scope === "college") return true;
  if (requiresTwoFactor(holder.permissions)) return false;
  return (
    holder.memberships.every(({ departmentId }) => departmentId !== null) &&
    holder.memberships.some(({ departmentId }) =>
      scope.includes(departmentId as string),
    )
  );
}

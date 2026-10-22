import { type Actor, permittedDepartments } from "./authorize.ts";
import { type PermissionKey, requiresTwoFactor } from "./permissions.ts";

// Someone whose account an action touches: where each of their roles is held, and every key those
// roles give them.
export type AccountHolder = {
  memberships: readonly { departmentId: string | null }[];
  permissions: ReadonlySet<PermissionKey>;
};

// Whether an actor's key reaches someone's account (Step 10), so that acting on it never gives the
// actor a power they lack (lead review B). Held across the college, it reaches someone when the
// actor holds across the college every key of theirs that requires two-factor and, for someone with
// a role across the college, every key of theirs: an admin reaches everyone, and a vice-dean given
// temporary passwords helps trainers and the dean, whose keys they hold, never an admin or a
// head. Held in some departments, it reaches the people who hold a role in one of them, none across
// the college, and no key that requires two-factor: a head helps their own trainers, never the
// dean, an admin or another head.
export function reachesAccount(
  actor: Actor,
  permission: PermissionKey,
  holder: AccountHolder,
) {
  const scope = permittedDepartments(actor, permission);
  if (scope === "college") {
    const held = new Set(
      actor.grants
        .filter(({ departmentId }) => departmentId === null)
        .map((grant) => grant.permission),
    );
    const acrossCollege = holder.memberships.some(
      ({ departmentId }) => departmentId === null,
    );
    return [...holder.permissions].every(
      (key) => held.has(key) || (!acrossCollege && !requiresTwoFactor([key])),
    );
  }
  if (requiresTwoFactor(holder.permissions)) return false;
  return (
    holder.memberships.every(({ departmentId }) => departmentId !== null) &&
    holder.memberships.some(({ departmentId }) =>
      scope.includes(departmentId as string),
    )
  );
}

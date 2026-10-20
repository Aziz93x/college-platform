// Every permission key the code checks: capabilities live in code, and roles (data) hold them.
// A key that lets someone act on other people's accounts or on the platform itself requires its
// holder to sign in with two-factor (docs/PLAN.md, Step 6).
export const permissions = {
  // The token and component catalog at /design.
  "design.view": { requiresTwoFactor: false },
  // Issue a temporary password for someone's account.
  "accounts.resetPassword": { requiresTwoFactor: true },
} as const satisfies Record<string, { requiresTwoFactor: boolean }>;

export type PermissionKey = keyof typeof permissions;

export const permissionKeys = Object.keys(permissions) as PermissionKey[];

export function isPermissionKey(value: string): value is PermissionKey {
  return Object.hasOwn(permissions, value);
}

// Two-factor is required of whoever holds a key that requires it.
export function requiresTwoFactor(held: Iterable<PermissionKey>) {
  for (const key of held) {
    if (permissions[key].requiresTwoFactor) return true;
  }
  return false;
}

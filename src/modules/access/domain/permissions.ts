// Every permission key the code checks: capabilities live in code, and roles (data) hold them.
// A key that lets someone act on other people's accounts or on the platform itself requires its
// holder to sign in with two-factor (docs/PLAN.md, Step 6). The area groups a key on the roles
// grid; a key's step is where its first check arrives.
const permissions = {
  // The token and component catalog at /design.
  "design.view": { area: "platform", requiresTwoFactor: false },
  // The audit log: every change, who made it and from where, and its export (Step 11).
  "audit.view": { area: "platform", requiresTwoFactor: true },
  // Change the platform's settings (src/modules/settings): the ones whose registry entry names it.
  "settings.manage": { area: "platform", requiresTwoFactor: true },
  // The college's own name and short name.
  "college.manage": { area: "organization", requiresTwoFactor: true },
  // The college's departments: their names, Rayat matching values and active state.
  "departments.manage": { area: "organization", requiresTwoFactor: true },
  // Roles, the keys each holds, who holds them and where, and each role's page order.
  "roles.manage": { area: "organization", requiresTwoFactor: true },
  // Add people one by one or from a file, correct their names and emails, and disable or enable
  // their accounts (Step 10).
  "people.manage": { area: "organization", requiresTwoFactor: true },
  // Issue a temporary password for someone's account.
  "accounts.resetPassword": { area: "organization", requiresTwoFactor: true },
  // Correct the employee number someone signs in with, the one Rayat's reports carry (Step 10).
  "accounts.linkEmployeeNumber": {
    area: "organization",
    requiresTwoFactor: true,
  },
  // Terms and their calendars (Step 13).
  "term.manage": { area: "term", requiresTwoFactor: false },
  // Publish the term's general framework (Step 15).
  "framework.publish": { area: "term", requiresTwoFactor: false },
  // Upload Rayat's reports (Step 16).
  "rayat.import": { area: "term", requiresTwoFactor: false },
  // Edit a department's plan, and publish it to generate its tasks (Steps 19 and 20).
  "plan.edit": { area: "planning", requiresTwoFactor: false },
  "plan.publish": { area: "planning", requiresTwoFactor: false },
  // Assignments and quick requests (Steps 21 and 22).
  "assignment.manage": { area: "planning", requiresTwoFactor: false },
  // Complete one's own tasks and attach their evidence (Step 26).
  "task.complete": { area: "work", requiresTwoFactor: false },
  // Accept or return the tasks under review (Step 29).
  "review.decide": { area: "work", requiresTwoFactor: false },
  // Approve trainers' portfolios (Step 30).
  "portfolio.approve": { area: "work", requiresTwoFactor: false },
  // The college's indicators across its departments (Step 35).
  "indicators.view.college": { area: "indicators", requiresTwoFactor: false },
} as const satisfies Record<
  string,
  { area: PermissionArea; requiresTwoFactor: boolean }
>;

export type PermissionArea =
  | "platform"
  | "organization"
  | "term"
  | "planning"
  | "work"
  | "indicators";

export type PermissionKey = keyof typeof permissions;

export const permissionKeys = Object.keys(permissions) as PermissionKey[];

export function isPermissionKey(value: string): value is PermissionKey {
  return Object.hasOwn(permissions, value);
}

export function permissionArea(key: PermissionKey): PermissionArea {
  return permissions[key].area;
}

// Two-factor is required of whoever holds a key that requires it.
export function requiresTwoFactor(held: Iterable<PermissionKey>) {
  for (const key of held) {
    if (permissions[key].requiresTwoFactor) return true;
  }
  return false;
}

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
  // Announce to everyone in a department, or held across the college, to the college, and
  // withdraw what was announced there (ADR-0017). It changes no one's access.
  "announcements.publish": { area: "organization", requiresTwoFactor: false },
  // The portfolio's axes, the administration's catalog: their titles and descriptions (Step 14).
  "axes.manage": { area: "organization", requiresTwoFactor: false },
  // Terms and their calendars (Step 13).
  "term.manage": { area: "term", requiresTwoFactor: false },
  // Edit and publish the term's general framework (Step 15).
  "framework.publish": { area: "term", requiresTwoFactor: false },
  // Endorse the framework's draft before it is published, where the college asks for it (Step 15).
  "framework.endorse": { area: "term", requiresTwoFactor: false },
  // Upload, apply and roll back Rayat's reports (Step 16). A file is the whole college's, so the key
  // held in a department does what it does held across the college (ADR-0019).
  "rayat.import": { area: "term", requiresTwoFactor: false },
  // Edit a department's plan for a term: its drafts and their items (Step 19).
  "plan.edit": { area: "planning", requiresTwoFactor: false },
  // Publish a department's plan, whose tasks are then generated (Step 19).
  "plan.publish": { area: "planning", requiresTwoFactor: false },
  // Assign a department's responsibilities to its people for a term and revoke them, and keep the
  // department's own templates (Step 21). Assigning a template that grants a role, as the
  // secretary's does, gives that role in the department for the term: the keys the admin gave it.
  "assignment.manage": { area: "planning", requiresTwoFactor: false },
  // Transfer a section of the term from one trainer to another, from a week on (Step 17).
  "sections.transfer": { area: "planning", requiresTwoFactor: false },
  // Complete one's own tasks and attach their evidence (Step 26). Step 17 already reads it: a
  // section moves only to someone who holds it, as trainers do.
  "task.complete": { area: "work", requiresTwoFactor: false },
} as const satisfies Record<
  string,
  { area: PermissionArea; requiresTwoFactor: boolean }
>;

export type PermissionArea =
  | "platform"
  | "organization"
  | "term"
  | "planning"
  | "work";

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

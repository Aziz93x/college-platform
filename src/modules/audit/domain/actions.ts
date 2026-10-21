// Every action the audit log records, as entity.verb, and the kinds of entity they are about. An
// action is written only from this list, so the log's viewer names each one (messages
// audit.actions.<action>) and offers it as a filter.
export const auditActions = [
  "account.create",
  "account.resetPassword",
  "account.changePassword",
  "account.startTwoFactorSetup",
  "account.enableTwoFactor",
  "account.lock",
  // Written by the database when Better Auth locks two-factor (migration 0010).
  "account.lockTwoFactor",
  "account.disable",
  "account.enable",
  "person.update",
  "person.linkEmployeeNumber",
  "session.signIn",
  "session.signOut",
  "college.update",
  "department.create",
  "department.update",
  "role.create",
  "role.update",
  "membership.create",
  "membership.delete",
  "setting.update",
  "setting.reset",
  "audit.export",
  "audit.purge",
] as const;

export type AuditAction = (typeof auditActions)[number];

export const auditEntities = [
  "user",
  "college",
  "department",
  "role",
  "membership",
  "setting",
] as const;

export type AuditEntity = (typeof auditEntities)[number];

export function isAuditAction(value: string): value is AuditAction {
  return (auditActions as readonly string[]).includes(value);
}

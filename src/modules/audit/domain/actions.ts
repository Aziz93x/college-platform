// Every action the audit log records, as entity.verb, and the kinds of entity they are about. An
// action is written only from this list, so the log's viewer names each one (messages
// audit.actions.<action>) and offers it as a filter.
export const auditActions = [
  "account.create",
  "account.resetPassword",
  "account.changePassword",
  "account.startTwoFactorSetup",
  "account.enableTwoFactor",
  // Two-factor turned off, by its owner or by an admin for them (ADR-0014).
  "account.disableTwoFactor",
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
  // A person reading their notifications, and turning a kind off or on (Step 12).
  "notification.read",
  "notification.mute",
  "notification.unmute",
  // An announcement to a department or the college, and its withdrawal (ADR-0017).
  "announcement.publish",
  "announcement.withdraw",
  // A term, its status and its calendar's days, the vice-dean's (Step 13).
  "term.create",
  "term.update",
  "term.activate",
  "term.close",
  "calendarEvent.create",
  "calendarEvent.update",
  "calendarEvent.delete",
  // A term's exam periods set by week number (the owner's notes, 21 October 2026).
  "examPeriods.update",
  // A year's holiday adjusted, or approved as estimated, by the vice-dean (ADR-0018).
  "holiday.update",
  "holiday.approve",
  // A portfolio axis's title or description corrected by the admin (Step 14).
  "axis.update",
  // The term's general framework: a version started, its items, the dean's endorsement and its
  // publication (Step 15).
  "framework.create",
  "frameworkItem.create",
  "frameworkItem.update",
  "frameworkItem.delete",
  "framework.endorse",
  "framework.publish",
  // A Rayat report uploaded for a term, then applied or discarded; a version rolled back (Step 16).
  "rayatImport.upload",
  "rayatImport.apply",
  "rayatImport.discard",
  "rayatImport.rollback",
  // A head's transfer of a section from one trainer to another, kept against a newer SS01 or
  // cancelled (Step 17).
  "sectionTransfer.create",
  "sectionTransfer.keep",
  "sectionTransfer.cancel",
  // A head's section templates for a term, and their copy into the next term, recorded on each
  // department's history (Step 18). Kept for the history they wrote: Step 19 made them a
  // department plan's items.
  "sectionTemplate.create",
  "sectionTemplate.update",
  "sectionTemplate.delete",
  "sectionTemplate.copy",
  // A department's plan for a term: a version started, or copied into the next term, its items, and
  // its publication (Step 19).
  "plan.create",
  "planItem.create",
  "planItem.update",
  "planItem.delete",
  "plan.publish",
  // A pass of the generation engine over a term's tasks that changed any, written by the system with
  // what it did (Step 20).
  "task.generate",
] as const;

export type AuditAction = (typeof auditActions)[number];

const auditEntities = [
  "user",
  "college",
  "department",
  "role",
  "membership",
  "setting",
  "announcement",
  "term",
  "holiday",
  "axis",
  "framework",
  "rayatImport",
  "sectionTransfer",
  "sectionTemplate",
  "plan",
] as const;

export type AuditEntity = (typeof auditEntities)[number];

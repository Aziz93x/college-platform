import { type Db, getDb, type Tx } from "../../../platform/db/client.ts";
import { auditEvents } from "./schema.ts";

type AuditEvent = {
  collegeId: string;
  // Null when the system acted rather than a person.
  actorId: string | null;
  // What happened, as entity.verb: "account.resetPassword".
  action: string;
  entityType: string;
  entityId: string;
  // What changed, never a secret: no password, hash, token or two-factor secret.
  diff?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
};

// Records one event; inside a transaction, pass it so the event commits with the change.
export async function writeAudit(event: AuditEvent, db: Db | Tx = getDb()) {
  await db.insert(auditEvents).values(event);
}

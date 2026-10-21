import { sql } from "drizzle-orm";
import { type Db, getDb } from "../../../platform/db/client.ts";
import { writeAudit } from "./write-audit.ts";

// Removes a college's events older than its retention, through the one function the append-only
// triggers let past (migration 0010), and records how many went, as the system. Returns the count.
export async function purgeAuditEvents(
  collegeId: string,
  months: number,
  db: Db = getDb(),
) {
  return db.transaction(async (tx) => {
    const { rows } = await tx.execute<{ removed: number }>(
      sql`select purge_audit_events(${collegeId}, ${months}) as removed`,
    );
    const removed = Number(rows[0].removed);
    if (removed > 0) {
      await writeAudit(
        {
          collegeId,
          actorId: null,
          action: "audit.purge",
          entityType: "college",
          entityId: collegeId,
          diff: { months, removed },
        },
        tx,
      );
    }
    return removed;
  });
}

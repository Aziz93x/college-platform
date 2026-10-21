import type { Logger } from "pino";
import { purgeAuditEvents } from "../../src/modules/audit/index.ts";
import { colleges } from "../../src/modules/org/index.ts";
import { getSetting } from "../../src/modules/settings/index.ts";
import type { Db } from "../../src/platform/db/client.ts";

// Once a day, each college's audit events older than its retention setting go.
export function auditRetention(logger: Logger, db: Db) {
  return async () => {
    for (const { id } of await db.select({ id: colleges.id }).from(colleges)) {
      const months = await getSetting(
        "audit.retentionMonths",
        { collegeId: id },
        db,
      );
      const removed = await purgeAuditEvents(id, months, db);
      logger.info({ collegeId: id, months, removed }, "audit retention");
    }
  };
}

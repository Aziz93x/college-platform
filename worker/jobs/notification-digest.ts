import type { Logger } from "pino";
import {
  isDigestDue,
  lastDigestMoment,
  sendWeeklyDigests,
} from "../../src/modules/notifications/index.ts";
import { colleges } from "../../src/modules/org/index.ts";
import { getSetting, weekdays } from "../../src/modules/settings/index.ts";
import type { Db } from "../../src/platform/db/client.ts";

// Every quarter of an hour, each college whose digest fell due within the day sends it: on its own
// day and hour, on its own clock, and once per person and week however often this runs.
export function notificationDigest(
  logger: Logger,
  db: Db,
  now: () => Date = () => new Date(),
) {
  return async () => {
    for (const { id } of await db.select({ id: colleges.id }).from(colleges)) {
      const scope = { collegeId: id };
      const [day, hour, timeZone] = await Promise.all([
        getSetting("reminders.digestDay", scope, db),
        getSetting("reminders.digestHour", scope, db),
        getSetting("locale.timeZone", scope, db),
      ]);
      const at = now();
      const moment = lastDigestMoment(at, {
        weekday: weekdays.indexOf(day),
        hour,
        timeZone,
      });
      if (!isDigestDue(at, moment)) continue;
      const sent = await sendWeeklyDigests(id, moment, db);
      if (sent > 0) {
        logger.info({ collegeId: id, week: moment.day, sent }, "weekly digest");
      }
    }
  };
}

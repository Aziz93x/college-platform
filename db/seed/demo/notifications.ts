import { and, asc, eq, inArray } from "drizzle-orm";
import { listRoles, roleLabel } from "../../../src/modules/access/index.ts";
import { auditEvents } from "../../../src/modules/audit/index.ts";
import {
  digestKey,
  digestOf,
  lastDigestMoment,
  notifications,
} from "../../../src/modules/notifications/index.ts";
import { listDepartments } from "../../../src/modules/org/index.ts";
import {
  settingsRegistry,
  weekdays,
} from "../../../src/modules/settings/index.ts";
import type { Db } from "../../../src/platform/db/client.ts";
import { demoSettings } from "./settings.ts";

// The demo college's notifications, so the bell and the notification center have a past (Step 12):
// each role the log shows the admin giving, told to its holder at that moment; each Sunday's digest
// of what the week before left unread, on the college's digest day, hour and clock; and each read
// at its holder's next sign-in in the log, or left for later. Drawn from the log, so the two agree,
// and written once, while the college has none, so a re-run adds nothing.

const MINUTE = 60_000;
const WEEK = 7 * 24 * 60 * MINUTE;

type Row = typeof notifications.$inferInsert;

export async function seedDemoNotifications(
  { db, random }: { db: Db; random: () => number },
  collegeId: string,
) {
  const [sent] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(eq(notifications.collegeId, collegeId))
    .limit(1);
  if (sent) return;

  const [log, roles, departments] = await Promise.all([
    db
      .select({
        action: auditEvents.action,
        actorId: auditEvents.actorId,
        diff: auditEvents.diff,
        createdAt: auditEvents.createdAt,
      })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.collegeId, collegeId),
          inArray(auditEvents.action, ["membership.create", "session.signIn"]),
        ),
      )
      .orderBy(asc(auditEvents.createdAt)),
    listRoles(collegeId, db),
    listDepartments(collegeId, db),
  ]);
  const language = demoSettings["locale.language"];

  // Each person's sign-ins, in order: a notification is read at the first one after it, or not yet.
  const signIns = new Map<string, number[]>();
  for (const event of log) {
    if (event.action !== "session.signIn" || !event.actorId) continue;
    signIns.set(event.actorId, [
      ...(signIns.get(event.actorId) ?? []),
      event.createdAt.getTime(),
    ]);
  }
  const readAt = (userId: string, time: number) => {
    const next = signIns.get(userId)?.find((signIn) => signIn > time);
    return next !== undefined && random() < 0.6
      ? new Date(next + 2 * MINUTE)
      : null;
  };

  const rows: Row[] = [];
  for (const event of log) {
    if (event.action !== "membership.create") continue;
    const to = (event.diff as { to: Record<string, string | null> }).to;
    const role = roles.find(({ key }) => key === to.role);
    const department = departments.find(({ id }) => id === to.departmentId);
    if (!role || !to.userId) continue;
    const label = roleLabel(role.labels, language);
    rows.push({
      collegeId,
      userId: to.userId,
      kind: "membershipAdded",
      params: department
        ? { role: label, scope: "department", department: department.name }
        : { role: label, scope: "college" },
      createdAt: event.createdAt,
      readAt: readAt(to.userId, event.createdAt.getTime()),
    });
  }

  // Each week's digest since the first notification, as the worker would have sent it.
  const schedule = {
    weekday: weekdays.indexOf(settingsRegistry["reminders.digestDay"].default),
    hour: settingsRegistry["reminders.digestHour"].default,
    timeZone: demoSettings["locale.timeZone"],
  };
  const first = Math.min(
    ...rows.map((row) => (row.createdAt as Date).getTime()),
  );
  const moments = [];
  for (
    let moment = lastDigestMoment(new Date(), schedule);
    moment.at.getTime() > first;
    moment = lastDigestMoment(new Date(moment.at.getTime() - 1), schedule)
  ) {
    moments.unshift(moment);
  }
  for (const moment of moments) {
    const at = moment.at.getTime();
    const unread = new Map<string, Row[]>();
    for (const row of [...rows].reverse()) {
      const time = (row.createdAt as Date).getTime();
      const read = row.readAt?.getTime();
      if (row.kind === "weeklyDigest" || time >= at || time < at - WEEK) {
        continue;
      }
      if (read !== undefined && read < at) continue;
      unread.set(row.userId, [...(unread.get(row.userId) ?? []), row]);
    }
    for (const [userId, theirs] of unread) {
      rows.push({
        collegeId,
        userId,
        kind: "weeklyDigest",
        params: digestOf(
          theirs.map(({ kind, params }) => ({
            kind,
            params: params as Record<string, unknown>,
          })),
        ),
        onceKey: digestKey(moment),
        createdAt: moment.at,
        readAt: readAt(userId, at),
      });
    }
  }

  for (let index = 0; index < rows.length; index += 500) {
    await db.insert(notifications).values(rows.slice(index, index + 500));
  }
}

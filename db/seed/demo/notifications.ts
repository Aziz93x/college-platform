import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { listRoles, roleLabel } from "../../../src/modules/access/index.ts";
import { auditEvents } from "../../../src/modules/audit/index.ts";
import { people } from "../../../src/modules/identity/index.ts";
import {
  digestKey,
  digestOf,
  lastDigestMoment,
  notificationPrefs,
  notifications,
} from "../../../src/modules/notifications/index.ts";
import { listDepartments } from "../../../src/modules/org/index.ts";
import {
  settingsRegistry,
  weekdays,
} from "../../../src/modules/settings/index.ts";
import type { Db } from "../../../src/platform/db/client.ts";
import { demoAccounts } from "./accounts.ts";
import { demoSettings } from "./settings.ts";

// The demo college's notifications, so the bell and the notification center have a past (Step 12):
// each role the log shows the admin giving, told to its holder at that moment; each Sunday's digest
// of what the week before left unread, on the college's digest day, hour and clock, but for the
// two trainers who turned the digest off; and each read at its holder's next sign-in in the log, or
// left for later, a digest with the last of what it counts if that comes first (ADR-0015). Drawn from the log, and each reading and each digest turned off writes its event
// there, so the two agree. The demo trainer, whom the end-to-end tests and the screenshots sign in
// as, has read everything, without a draw, whatever day the seed runs (Audit 4). Written once,
// while the college has none, so a re-run adds nothing.

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

  const [log, roles, departments, [trainer]] = await Promise.all([
    db
      .select({
        action: auditEvents.action,
        actorId: auditEvents.actorId,
        diff: auditEvents.diff,
        ip: auditEvents.ip,
        userAgent: auditEvents.userAgent,
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
    db
      .select({ userId: people.userId })
      .from(people)
      .where(
        and(
          eq(people.collegeId, collegeId),
          eq(people.employeeNumber, demoAccounts.trainer.employeeNumber),
        ),
      ),
  ]);
  const language = demoSettings["locale.language"];

  // Each person's sign-ins, in order: a notification is read at the first one after it, or not yet.
  type SignIn = (typeof log)[number];
  const signIns = new Map<string, SignIn[]>();
  for (const event of log) {
    if (event.action !== "session.signIn" || !event.actorId) continue;
    signIns.set(event.actorId, [...(signIns.get(event.actorId) ?? []), event]);
  }
  const nextSignIn = (userId: string, time: number) =>
    signIns.get(userId)?.find((signIn) => signIn.createdAt.getTime() > time);
  const readAt = (userId: string, time: number) => {
    const next = nextSignIn(userId, time)?.createdAt.getTime();
    // A moment after the next sign-in, or after it came, but never later than now.
    if (userId === trainer?.userId) {
      return new Date(Math.min((next ?? time) + 2 * MINUTE, Date.now()));
    }
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
      id: randomUUID(),
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

  // Two trainers turned the weekly digest off at their first sign-in after joining, the last two
  // the log names, not a draw: the worker sends them none from then on.
  const trainers = log.filter(
    (event) =>
      event.action === "membership.create" &&
      (event.diff as { to: Record<string, string | null> }).to.role ===
        "trainer",
  );
  const muted = new Map<string, number>();
  for (const event of trainers.toReversed()) {
    const userId = (event.diff as { to: Record<string, string> }).to.userId;
    const first = nextSignIn(userId, event.createdAt.getTime());
    if (muted.size === 2 || userId === trainer?.userId || !first) continue;
    muted.set(userId, first.createdAt.getTime() + 3 * MINUTE);
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
      const off = muted.get(userId);
      if (off !== undefined && off < at) continue;
      const own = readAt(userId, at);
      const reads = theirs.map((row) => row.readAt?.getTime());
      const last = reads.every((time) => time !== undefined)
        ? Math.max(...(reads as number[]))
        : undefined;
      rows.push({
        collegeId,
        userId,
        kind: "weeklyDigest",
        params: digestOf(
          theirs.map(({ id, kind, params }) => ({
            id: id as string,
            kind,
            params: params as Record<string, unknown>,
          })),
        ),
        onceKey: digestKey(moment),
        createdAt: moment.at,
        readAt:
          last !== undefined && (!own || last < own.getTime())
            ? new Date(last)
            : own,
      });
    }
  }

  for (let index = 0; index < rows.length; index += 500) {
    await db.insert(notifications).values(rows.slice(index, index + 500));
  }

  // What the readings and the choices wrote to the log, from the reader's device at the time: one
  // notification.read for each moment someone read, with how many, and a notification.mute for
  // each digest turned off.
  const device = (userId: string, time: number) => {
    const before = signIns
      .get(userId)
      ?.filter((signIn) => signIn.createdAt.getTime() <= time)
      .at(-1);
    return { ip: before?.ip ?? null, userAgent: before?.userAgent ?? null };
  };
  const readings = new Map<
    string,
    { userId: string; at: Date; count: number }
  >();
  for (const { userId, readAt: at } of rows) {
    if (!at) continue;
    const key = `${userId} ${at.getTime()}`;
    const reading = readings.get(key) ?? { userId, at, count: 0 };
    readings.set(key, { ...reading, count: reading.count + 1 });
  }
  const events: (typeof auditEvents.$inferInsert)[] = [
    ...[...readings.values()].map(({ userId, at, count }) => ({
      collegeId,
      actorId: userId,
      action: "notification.read" as const,
      entityType: "user",
      entityId: userId,
      diff: { count },
      ...device(userId, at.getTime()),
      createdAt: at,
    })),
    ...[...muted].map(([userId, time]) => ({
      collegeId,
      actorId: userId,
      action: "notification.mute" as const,
      entityType: "user",
      entityId: userId,
      diff: { kind: "weeklyDigest" },
      ...device(userId, time),
      createdAt: new Date(time),
    })),
  ];
  for (let index = 0; index < events.length; index += 500) {
    await db.insert(auditEvents).values(events.slice(index, index + 500));
  }
  if (muted.size > 0) {
    await db.insert(notificationPrefs).values(
      [...muted].map(([userId, time]) => ({
        collegeId,
        userId,
        kind: "weeklyDigest",
        enabled: false,
        updatedAt: new Date(time),
      })),
    );
  }
}

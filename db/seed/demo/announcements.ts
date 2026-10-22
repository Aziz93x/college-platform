import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { enabledPeopleIn } from "../../../src/modules/access/index.ts";
import { announcements } from "../../../src/modules/announcements/index.ts";
import { auditEvents } from "../../../src/modules/audit/index.ts";
import { users } from "../../../src/modules/identity/index.ts";
import { notifications } from "../../../src/modules/notifications/index.ts";
import { listDepartments } from "../../../src/modules/org/index.ts";
import type { Db } from "../../../src/platform/db/client.ts";
import { demoAccounts } from "./accounts.ts";
import { demoDepartments } from "./departments.ts";

// The demo college's announcements (ADR-0017): the head of Electrical's to the department, then the
// dean's to the college, a few days after the last role the log gives, each told to everyone
// enabled in its scope but its author. Each is read at its reader's next sign-in in the log, or left
// for later. The demo accounts the tests sign in as have read them, so no test's page opens under
// one; the invited trainer, who never signed in, meets the dean's at the first sign-in, which the
// production stack's smoke checks. Each publication and reading writes its event in the log.
// Written once, while the college has none, so a re-run adds nothing.

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

const [, electrical] = demoDepartments.map(({ name }) => name);

const said = [
  {
    author: demoAccounts.head,
    department: electrical,
    after: 2 * DAY,
    title: "اجتماع القسم يوم الأحد",
    body: "نجتمع يوم الأحد الساعة العاشرة صباحًا في قاعة القسم، لنراجع توزيع المهام لهذا الأسبوع.\n\nأحضروا ملاحظاتكم على الخطة.",
  },
  {
    author: demoAccounts.dean,
    department: null,
    after: 5 * DAY,
    title: "تحديث بيانات المنسوبين",
    body: "نرجو من الجميع مراجعة بياناتهم في الملف الشخصي قبل نهاية الأسبوع، وإبلاغ رئيس القسم بأي خطأ في الرقم الوظيفي أو البريد.",
  },
];

export async function seedDemoAnnouncements(
  { db, random }: { db: Db; random: () => number },
  collegeId: string,
) {
  const [made] = await db
    .select({ id: announcements.id })
    .from(announcements)
    .where(eq(announcements.collegeId, collegeId))
    .limit(1);
  if (made) return;

  const [log, departments, cast] = await Promise.all([
    db
      .select({
        action: auditEvents.action,
        actorId: auditEvents.actorId,
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
    listDepartments(collegeId, db),
    db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(
        inArray(
          users.email,
          Object.values(demoAccounts).map(({ email }) => email),
        ),
      ),
  ]);
  const byEmail = new Map(cast.map((user) => [user.email, user]));
  // The accounts the tests sign in as, all but the invited trainer, who never signed in.
  const tested = new Set(
    Object.values(demoAccounts)
      .filter((account) => account !== demoAccounts.invitedTrainer)
      .map(({ email }) => byEmail.get(email)?.id),
  );
  const lastRole = Math.max(
    ...log
      .filter(({ action }) => action === "membership.create")
      .map(({ createdAt }) => createdAt.getTime()),
  );
  const signIns = log.filter(({ action }) => action === "session.signIn");
  const nextSignIn = (userId: string, time: number) =>
    signIns.find(
      (event) => event.actorId === userId && event.createdAt.getTime() > time,
    );
  // From the device of their last sign-in before then, as the action would record it.
  const device = (userId: string, time: number) => {
    const before = signIns
      .filter(
        (event) =>
          event.actorId === userId && event.createdAt.getTime() <= time,
      )
      .at(-1);
    return { ip: before?.ip ?? null, userAgent: before?.userAgent ?? null };
  };

  for (const announcement of said) {
    const author = byEmail.get(announcement.author.email);
    const department = departments.find(
      ({ name }) => name === announcement.department,
    );
    if (!author || (announcement.department && !department)) {
      throw new Error("seed:demo: the announcements' authors are missing");
    }
    const at = Math.min(lastRole + announcement.after, Date.now() - DAY / 4);
    const id = randomUUID();
    await db.insert(announcements).values({
      id,
      collegeId,
      departmentId: department?.id ?? null,
      authorId: author.id,
      title: announcement.title,
      body: announcement.body,
      createdAt: new Date(at),
    });
    const recipients = (
      await enabledPeopleIn(collegeId, department?.id ?? null, db)
    ).filter((userId) => userId !== author.id);
    const readings = recipients.map((userId) => {
      const next = nextSignIn(userId, at)?.createdAt.getTime();
      if (tested.has(userId)) {
        return Math.min((next ?? at) + 2 * MINUTE, Date.now());
      }
      return next !== undefined && random() < 0.6
        ? next + 2 * MINUTE
        : undefined;
    });
    await db.insert(notifications).values(
      recipients.map((userId, index) => ({
        collegeId,
        userId,
        kind: "announcement",
        params: {
          announcementId: id,
          title: announcement.title,
          body: announcement.body,
          author: author.name,
          ...(department
            ? { scope: "department", department: department.name }
            : { scope: "college" }),
        },
        createdAt: new Date(at),
        readAt:
          readings[index] === undefined ? null : new Date(readings[index]),
      })),
    );
    await db.insert(auditEvents).values([
      {
        collegeId,
        actorId: author.id,
        action: "announcement.publish" as const,
        entityType: "announcement",
        entityId: id,
        diff: {
          to: {
            title: announcement.title,
            departmentId: department?.id ?? null,
            reached: recipients.length,
          },
        },
        ...device(author.id, at),
        createdAt: new Date(at),
      },
      ...recipients.flatMap((userId, index) => {
        const read = readings[index];
        return read === undefined
          ? []
          : [
              {
                collegeId,
                actorId: userId,
                action: "notification.read" as const,
                entityType: "user",
                entityId: userId,
                diff: { count: 1 },
                ...device(userId, read),
                createdAt: new Date(read),
              },
            ];
      }),
    ]);
  }
}

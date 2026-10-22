import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { type Db, getDb } from "../../../platform/db/client.ts";
import { enabledPeopleIn } from "../../access/index.ts";
import { writeAudit } from "../../audit/index.ts";
import { users } from "../../identity/index.ts";
import {
  announcementReads,
  notifyAll,
  retractAnnouncement,
} from "../../notifications/index.ts";
import { departments } from "../../org/index.ts";
import type { AnnouncementInput } from "../domain/inputs.ts";
import { announcements } from "./schema.ts";

// Someone announcing or withdrawing, for the audit event.
type Change = {
  collegeId: string;
  actorId: string;
  ip?: string | null;
  userAgent?: string | null;
};

// Announces to a department, or to the college with none (ADR-0017): every enabled account there
// but its author is told at once, in the same transaction, and announcement.publish records it
// with how many it reached. An unknown or inactive department is refused.
export async function publishAnnouncement(
  input: AnnouncementInput,
  change: Change,
  db: Db = getDb(),
): Promise<
  | { status: "published"; id: string; reached: number }
  | { status: "notFound" | "inactive" }
> {
  return db.transaction(async (tx) => {
    let department: string | undefined;
    if (input.departmentId) {
      const [found] = await tx
        .select({ name: departments.name, active: departments.active })
        .from(departments)
        .where(
          and(
            eq(departments.collegeId, change.collegeId),
            eq(departments.id, input.departmentId),
          ),
        );
      if (!found) return { status: "notFound" };
      if (!found.active) return { status: "inactive" };
      department = found.name;
    }
    const [author] = await tx
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, change.actorId));
    const [{ id }] = await tx
      .insert(announcements)
      .values({
        collegeId: change.collegeId,
        departmentId: input.departmentId,
        authorId: change.actorId,
        title: input.title,
        body: input.body,
      })
      .returning({ id: announcements.id });
    const reached = await notifyAll(
      {
        collegeId: change.collegeId,
        userIds: (
          await enabledPeopleIn(change.collegeId, input.departmentId, tx)
        ).filter((userId) => userId !== change.actorId),
        kind: "announcement",
        params: {
          announcementId: id,
          title: input.title,
          body: input.body,
          author: author?.name ?? "",
          ...(department === undefined
            ? { scope: "college" as const }
            : { scope: "department" as const, department }),
        },
      },
      tx,
    );
    await writeAudit(
      {
        collegeId: change.collegeId,
        actorId: change.actorId,
        action: "announcement.publish",
        entityType: "announcement",
        entityId: id,
        diff: {
          to: {
            title: input.title,
            departmentId: input.departmentId,
            reached,
          },
        },
        ip: change.ip,
        userAgent: change.userAgent,
      },
      tx,
    );
    return { status: "published", id, reached };
  });
}

// One live announcement of the college, with who made it and where: what withdrawing it asks.
export async function findAnnouncement(
  collegeId: string,
  id: string,
  db: Db = getDb(),
) {
  const [found] = await db
    .select({
      id: announcements.id,
      authorId: announcements.authorId,
      departmentId: announcements.departmentId,
    })
    .from(announcements)
    .where(
      and(
        eq(announcements.collegeId, collegeId),
        eq(announcements.id, id),
        isNull(announcements.withdrawnAt),
      ),
    );
  return found;
}

// Withdraws a live announcement of the college: it leaves every bell and center it reached, read
// or not, and announcement.withdraw records it with how many it was taken from. Already withdrawn,
// or not the college's: notFound.
export async function withdrawAnnouncement(
  id: string,
  change: Change,
  db: Db = getDb(),
): Promise<{ status: "withdrawn"; removed: number } | { status: "notFound" }> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(announcements)
      .set({ withdrawnAt: sql`now()` })
      .where(
        and(
          eq(announcements.collegeId, change.collegeId),
          eq(announcements.id, id),
          isNull(announcements.withdrawnAt),
        ),
      )
      .returning({
        title: announcements.title,
        departmentId: announcements.departmentId,
      });
    if (!row) return { status: "notFound" };
    const removed = await retractAnnouncement(change.collegeId, id, tx);
    await writeAudit(
      {
        collegeId: change.collegeId,
        actorId: change.actorId,
        action: "announcement.withdraw",
        entityType: "announcement",
        entityId: id,
        diff: { from: row, to: { retracted: removed } },
        ip: change.ip,
        userAgent: change.userAgent,
      },
      tx,
    );
    return { status: "withdrawn", removed };
  });
}

// The live announcements the page shows: all the college's, or those to these departments, newest
// first, the latest fifty; each with how many it reached and how many of them have read it.
export async function listAnnouncements(
  collegeId: string,
  scope: "college" | readonly string[],
  db: Db = getDb(),
) {
  const live = await db
    .select({
      id: announcements.id,
      title: announcements.title,
      body: announcements.body,
      departmentId: announcements.departmentId,
      department: departments.name,
      authorId: announcements.authorId,
      author: users.name,
      createdAt: announcements.createdAt,
    })
    .from(announcements)
    .innerJoin(users, eq(users.id, announcements.authorId))
    .leftJoin(departments, eq(departments.id, announcements.departmentId))
    .where(
      and(
        eq(announcements.collegeId, collegeId),
        isNull(announcements.withdrawnAt),
        scope === "college"
          ? undefined
          : inArray(announcements.departmentId, [...scope]),
      ),
    )
    .orderBy(desc(announcements.createdAt), desc(announcements.id))
    .limit(50);
  const reads = await announcementReads(
    collegeId,
    live.map(({ id }) => id),
    db,
  );
  return live.map((announcement) => ({
    ...announcement,
    reached: reads.get(announcement.id)?.reached ?? 0,
    read: reads.get(announcement.id)?.read ?? 0,
  }));
}

import {
  and,
  desc,
  eq,
  gte,
  inArray,
  lt,
  notInArray,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { type Db, getDb } from "../../../platform/db/client.ts";
import type { AuditAction } from "../domain/actions.ts";
import { auditEvents } from "./schema.ts";

// What the log's viewer narrows to: a period, from inclusive to exclusive; one action; and the
// people the search found, whose events are those they did or that were done to their account.
export type AuditFilters = {
  from?: Date;
  to?: Date;
  action?: AuditAction;
  people?: readonly string[];
};

// Where the next page starts: the last event shown, newest first. Its time is the database's own
// text, to the microsecond: a Date keeps milliseconds, and would skip events of the same one.
export type AuditCursor = { at: string; id: string };

export type AuditEntry = {
  id: string;
  createdAt: Date;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  diff: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
};

// An entity's own events, or the memberships that name a role, a person or a department in what
// they changed (diff.to or diff.from).
export type HistorySubject =
  | { entityType: string; entityId: string }
  | { membershipsOf: "role" | "userId" | "departmentId"; value: string };

const columns = {
  id: auditEvents.id,
  createdAt: auditEvents.createdAt,
  actorId: auditEvents.actorId,
  action: auditEvents.action,
  entityType: auditEvents.entityType,
  entityId: auditEvents.entityId,
  diff: auditEvents.diff,
  ip: auditEvents.ip,
  userAgent: auditEvents.userAgent,
};

// Newest first, (created_at, id) going down: the index pages any depth of the log alike.
function before(cursor: AuditCursor | undefined) {
  return cursor
    ? sql`(${auditEvents.createdAt}, ${auditEvents.id}) < (${cursor.at}::timestamptz, ${cursor.id}::uuid)`
    : undefined;
}

function matching(collegeId: string, filters: AuditFilters) {
  const conditions: (SQL | undefined)[] = [
    eq(auditEvents.collegeId, collegeId),
    filters.from ? gte(auditEvents.createdAt, filters.from) : undefined,
    filters.to ? lt(auditEvents.createdAt, filters.to) : undefined,
    filters.action ? eq(auditEvents.action, filters.action) : undefined,
  ];
  if (filters.people) {
    const people = [...filters.people];
    conditions.push(
      people.length === 0
        ? sql`false`
        : or(
            inArray(auditEvents.actorId, people),
            and(
              eq(auditEvents.entityType, "user"),
              inArray(auditEvents.entityId, people),
            ),
          ),
    );
  }
  return conditions;
}

async function page(
  where: (SQL | undefined)[],
  limit: number,
  db: Db,
): Promise<{ events: AuditEntry[]; next?: AuditCursor }> {
  // One more than asked says whether another page follows.
  const rows = await db
    .select({ ...columns, at: sql<string>`${auditEvents.createdAt}::text` })
    .from(auditEvents)
    .where(and(...where))
    .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
    .limit(limit + 1);
  const shown = rows.slice(0, limit);
  const last = shown.at(-1);
  return {
    events: shown.map(({ at: _at, ...event }) => event as AuditEntry),
    next:
      rows.length > limit && last ? { at: last.at, id: last.id } : undefined,
  };
}

/** A page of the college's log, newest first, narrowed by the filters. */
export function listAuditEvents(
  collegeId: string,
  filters: AuditFilters,
  options: { after?: AuditCursor; limit?: number } = {},
  db: Db = getDb(),
) {
  return page(
    [...matching(collegeId, filters), before(options.after)],
    options.limit ?? 50,
    db,
  );
}

/**
 * A page of what happened to an entity, newest first: its own events and the memberships naming it,
 * but for the actions it leaves out, such as an account's sign-ins.
 */
export function entityHistory(
  collegeId: string,
  subjects: readonly HistorySubject[],
  options: {
    after?: AuditCursor;
    limit?: number;
    except?: readonly AuditAction[];
  } = {},
  db: Db = getDb(),
) {
  const about = subjects.map((subject) =>
    "entityType" in subject
      ? and(
          eq(auditEvents.entityType, subject.entityType),
          eq(auditEvents.entityId, subject.entityId),
        )
      : and(
          eq(auditEvents.entityType, "membership"),
          or(
            sql`${auditEvents.diff}->'to'->>${subject.membershipsOf} = ${subject.value}`,
            sql`${auditEvents.diff}->'from'->>${subject.membershipsOf} = ${subject.value}`,
          ),
        ),
  );
  return page(
    [
      eq(auditEvents.collegeId, collegeId),
      or(...about),
      options.except?.length
        ? notInArray(auditEvents.action, [...options.except])
        : undefined,
      before(options.after),
    ],
    options.limit ?? 20,
    db,
  );
}

/** Every event the filters match, newest first, a batch at a time: the export's rows. */
export async function* allAuditEvents(
  collegeId: string,
  filters: AuditFilters,
  db: Db = getDb(),
) {
  let after: AuditCursor | undefined;
  do {
    const batch = await listAuditEvents(
      collegeId,
      filters,
      { after, limit: 1000 },
      db,
    );
    yield* batch.events;
    after = batch.next;
  } while (after);
}

import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { type Db, getDb, type Tx } from "../../../platform/db/client.ts";
import { wallClock } from "../../../platform/i18n/time-zone.ts";
import { roleHolders, roles } from "../../access/index.ts";
import { writeAudit } from "../../audit/index.ts";
import { axes } from "../../axes/index.ts";
import { users } from "../../identity/index.ts";
import { notifyEach } from "../../notifications/index.ts";
import { departments } from "../../org/index.ts";
import { getSetting } from "../../settings/index.ts";
import {
  calendarOf,
  calendarSettings,
  findTerm,
  termWeeks,
} from "../../terms/index.ts";
import { type QuickRequestInput, targetsFit } from "../domain/input.ts";
import { quickRequests } from "./schema.ts";

// Who sends a request, for its audit event. The caller has authorized them for its place.
type Change = {
  collegeId: string;
  actorId: string;
  ip?: string | null;
  userAgent?: string | null;
};

// Why a request is not sent: its term is gone or closed; its day is outside the term's counted
// weeks, or already past on the college's clock; its axis, department or role is not the
// college's; someone chosen holds no role in their department for the term; or chosen people of
// a department's request belong to another.
export type RequestRefusal =
  | "termNotFound"
  | "termClosed"
  | "dueOutside"
  | "duePast"
  | "axisNotFound"
  | "departmentNotFound"
  | "roleNotFound"
  | "notInDepartment"
  | "targetsMismatch";

// Sends a quick request (Step 22): checks it against the term, the college and its people, keeps
// it with the evidence it asks for under the college's accepted types, and records
// quickRequest.send. `queue` queues the pass that makes its tasks, in the same transaction, so no
// request is ever kept without one (lead review D, M2); it gives the pass's id, which the caller
// then runs.
export async function sendQuickRequest(
  input: QuickRequestInput,
  change: Change,
  queue: (tx: Tx) => Promise<string>,
  at = new Date(),
  db: Db = getDb(),
): Promise<
  { status: "sent"; id: string; runId: string } | { status: RequestRefusal }
> {
  const { collegeId } = change;
  if (!targetsFit(input.targets, input.departmentId)) {
    return { status: "targetsMismatch" };
  }
  const [term, settings, timeZone, types] = await Promise.all([
    findTerm(collegeId, input.termId, db),
    calendarSettings(collegeId, db),
    getSetting("locale.timeZone", { collegeId }, db),
    getSetting("files.acceptedTypes", { collegeId }, db),
  ]);
  if (!term) return { status: "termNotFound" };
  if (term.status === "closed") return { status: "termClosed" };
  const counted = termWeeks(
    calendarOf(term, term.events, settings, term.breaks),
  ).some(
    (week) =>
      week.number !== null &&
      week.startsOn <= input.dueOn &&
      input.dueOn <= week.endsOn,
  );
  if (!counted) return { status: "dueOutside" };
  if (input.dueOn < wallClock(at, timeZone).slice(0, 10)) {
    return { status: "duePast" };
  }
  const [axis] = await db
    .select({ id: axes.id })
    .from(axes)
    .where(and(eq(axes.collegeId, collegeId), eq(axes.id, input.axisId)));
  if (!axis) return { status: "axisNotFound" };
  if (input.departmentId !== null) {
    const [department] = await db
      .select({ id: departments.id })
      .from(departments)
      .where(
        and(
          eq(departments.collegeId, collegeId),
          eq(departments.id, input.departmentId),
          eq(departments.active, true),
        ),
      );
    if (!department) return { status: "departmentNotFound" };
  }
  const { targets } = input;
  if ("roleId" in targets) {
    const [role] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.collegeId, collegeId), eq(roles.id, targets.roleId)));
    if (!role) return { status: "roleNotFound" };
  }
  if ("people" in targets) {
    const held = new Set(
      (await roleHolders(collegeId, input.termId, db)).map(
        ({ departmentId, userId }) => `${departmentId}:${userId}`,
      ),
    );
    if (
      !targets.people.every(({ departmentId, userId }) =>
        held.has(`${departmentId}:${userId}`),
      )
    ) {
      return { status: "notInDepartment" };
    }
  }

  return db.transaction(async (tx) => {
    const [{ id }] = await tx
      .insert(quickRequests)
      .values({
        collegeId,
        termId: input.termId,
        departmentId: input.departmentId,
        title: input.title,
        axisId: input.axisId,
        dueOn: input.dueOn,
        targets,
        evidence: {
          required: input.evidence,
          types,
          maxFiles: 1,
          requiresApproval: false,
        },
        sentBy: change.actorId,
      })
      .returning({ id: quickRequests.id });
    await writeAudit(
      {
        collegeId,
        actorId: change.actorId,
        action: "quickRequest.send",
        entityType: "quickRequest",
        entityId: id,
        diff: {
          to: {
            title: input.title,
            termId: input.termId,
            departmentId: input.departmentId,
            axisId: input.axisId,
            dueOn: input.dueOn,
            targets,
            evidence: input.evidence,
          },
        },
        ip: change.ip,
        userAgent: change.userAgent,
      },
      tx,
    );
    return { status: "sent" as const, id, runId: await queue(tx) };
  });
}

// Tells each person a pass gave a task of a quick request, in the pass's transaction, once for each
// request, unless they turned such notices off: those it reached when it was sent, and anyone it
// reaches later, such as someone who joins its department after it was sent, even past its day (the
// owner's answer, 23 October 2026). The day is written in the college's language and digits.
export function tellReached(
  tx: Tx,
  collegeId: string,
  requests: readonly {
    id: string;
    title: string;
    dueOn: string;
    sender: string | null;
  }[],
  reached: readonly { requestId: string; userId: string }[],
  locale: string,
) {
  // A day of the calendar, read on UTC's clock so no time zone moves it.
  const words = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  const byId = new Map(requests.map((request) => [request.id, request]));
  const told = new Set<string>();
  return notifyEach(
    "quickRequest",
    reached.flatMap(({ requestId, userId }) => {
      const request = byId.get(requestId);
      if (!request || told.has(`${requestId}:${userId}`)) return [];
      told.add(`${requestId}:${userId}`);
      return [
        {
          collegeId,
          userId,
          params: {
            requestId,
            title: request.title,
            due: words.format(new Date(`${request.dueOn}T00:00:00Z`)),
            from: request.sender ?? "",
          },
          onceKey: `quickRequest:${requestId}`,
        },
      ];
    }),
    tx,
  );
}

// The term's quick requests, what the generation engine makes tasks of beside the framework's, the
// plans' and the assignments' (ADR-0025): each with whom it reaches, the day it is due, and who sent
// it, whom an "everyone" request leaves out and whose name its notice gives.
export function requestedItems(
  collegeId: string,
  termId: string,
  db: Db | Tx = getDb(),
) {
  return db
    .select({
      id: quickRequests.id,
      departmentId: quickRequests.departmentId,
      title: quickRequests.title,
      axisId: quickRequests.axisId,
      dueOn: quickRequests.dueOn,
      targets: quickRequests.targets,
      evidence: quickRequests.evidence,
      sentBy: quickRequests.sentBy,
      sender: users.name,
    })
    .from(quickRequests)
    .leftJoin(users, eq(users.id, quickRequests.sentBy))
    .where(
      and(
        eq(quickRequests.collegeId, collegeId),
        eq(quickRequests.termId, termId),
      ),
    );
}

// The term's quick requests a viewer reads, the latest first, with who sent each: the whole
// college's, and those of the departments they reach, or every one for whoever sends across the
// college.
export function termRequests(
  collegeId: string,
  termId: string,
  reach: "college" | readonly string[],
  db: Db = getDb(),
) {
  return db
    .select({
      id: quickRequests.id,
      departmentId: quickRequests.departmentId,
      title: quickRequests.title,
      axisId: quickRequests.axisId,
      dueOn: quickRequests.dueOn,
      targets: quickRequests.targets,
      evidence: quickRequests.evidence,
      sentBy: users.name,
      createdAt: quickRequests.createdAt,
    })
    .from(quickRequests)
    .leftJoin(users, eq(users.id, quickRequests.sentBy))
    .where(
      and(
        eq(quickRequests.collegeId, collegeId),
        eq(quickRequests.termId, termId),
        reach === "college"
          ? undefined
          : or(
              isNull(quickRequests.departmentId),
              reach.length > 0
                ? inArray(quickRequests.departmentId, [...reach])
                : undefined,
            ),
      ),
    )
    .orderBy(desc(quickRequests.createdAt), desc(quickRequests.id));
}

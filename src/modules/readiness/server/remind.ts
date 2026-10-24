import { eq } from "drizzle-orm";
import { type Db, getDb } from "../../../platform/db/client.ts";
import { wallClock } from "../../../platform/i18n/time-zone.ts";
import { writeAudit } from "../../audit/index.ts";
import { users } from "../../identity/index.ts";
import { notifyEach } from "../../notifications/index.ts";
import { getSetting } from "../../settings/index.ts";
import { findTerm } from "../../terms/index.ts";
import { type ReadinessRow, termReadiness } from "./board.ts";

// A row of the board by what tells it from the others: its id, and a plan's department.
export type RowKey =
  | { id: Exclude<ReadinessRow["id"], "plan"> }
  | { id: "plan"; departmentId: string };

// The row's key in its reminders' once key.
export const rowKeyOf = (row: RowKey) =>
  row.id === "plan" ? `plan:${row.departmentId}` : row.id;

// Who reminds, for the audit event. The caller has authorized them to see the row.
type Change = {
  collegeId: string;
  actorId: string;
  ip?: string | null;
  userAgent?: string | null;
};

// Why no one is reminded: the term, or the row in the sender's reach, is not there; the row is
// settled, a pass is at work on it, or its term is closed; or no one but the sender owns it.
type RemindRefusal = "notFound" | "notOpen" | "nobody";

// What the sender sees of the board: the plans of their departments or of the whole college, and a
// term before it starts only if they prepare terms.
type SenderView = { reach: "college" | readonly string[]; drafts: boolean };

// Reminds the owners of an open row of a term's readiness board, its sender aside, with a notice
// that names the term and opens the row's page on it (lead review D, proposal 5). The row is read again, as the board shows
// it to the sender, so a settled row reminds no one, a row they do not see is not found, and its
// owners are whoever owns it now. Each
// owner is reminded of a row once a day on the college's clock, by the notice's once key, unless
// they turned such reminders off. `words` names the row in the college's language, as the board
// does. Records readiness.remind when it reminded anyone; `count` may be 0.
export async function remindOwners(
  input: { termId: string; row: RowKey },
  view: SenderView,
  change: Change,
  words: (row: ReadinessRow) => { title: string; detail: string },
  at = new Date(),
  db: Db = getDb(),
): Promise<{ status: "reminded"; count: number } | { status: RemindRefusal }> {
  const { collegeId } = change;
  const term = await findTerm(collegeId, input.termId, db);
  if (!term || (term.status === "draft" && !view.drafts)) {
    return { status: "notFound" };
  }
  const key = rowKeyOf(input.row);
  const [rows, timeZone, [sender]] = await Promise.all([
    termReadiness(collegeId, term, view.reach, db, at),
    getSetting("locale.timeZone", { collegeId }, db),
    db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, change.actorId)),
  ]);
  const row = rows.find((each) => rowKeyOf(each) === key);
  if (!row) return { status: "notFound" };
  if (row.state !== "open" || term.status === "closed") {
    return { status: "notOpen" };
  }
  const owners = row.owners.filter(({ userId }) => userId !== change.actorId);
  if (owners.length === 0) return { status: "nobody" };

  const said = words(row);
  const day = wallClock(at, timeZone).slice(0, 10);
  return db.transaction(async (tx) => {
    const count = await notifyEach(
      "readinessReminder",
      owners.map(({ userId }) => ({
        collegeId,
        userId,
        params: {
          ...said,
          from: sender?.name ?? "",
          href: row.href,
          termId: term.id,
          term: term.name,
        },
        onceKey: `readiness:${term.id}:${key}:${day}`,
      })),
      tx,
    );
    if (count > 0) {
      await writeAudit(
        {
          collegeId,
          actorId: change.actorId,
          action: "readiness.remind",
          entityType: "term",
          entityId: term.id,
          diff: { title: said.title, reached: count },
          ip: change.ip,
          userAgent: change.userAgent,
        },
        tx,
      );
    }
    return { status: "reminded" as const, count };
  });
}

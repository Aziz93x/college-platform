import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { type Db, getDb, type Tx } from "../../../platform/db/client.ts";
import { wallClock } from "../../../platform/i18n/time-zone.ts";
import { sectionPlaces } from "../../academics/index.ts";
import { roleHolders } from "../../access/index.ts";
import { writeAudit } from "../../audit/index.ts";
import { dueWeeks, publishedItems } from "../../framework/index.ts";
import { people } from "../../identity/index.ts";
import { getSetting } from "../../settings/index.ts";
import {
  calendarOf,
  calendarSettings,
  dueDay,
  findTerm,
  termWeeks,
  weekReached,
} from "../../terms/index.ts";
import {
  type Changes,
  type Reach,
  reconcile,
  type Task,
  type TermNow,
  type Wanted,
  wantedTasks,
} from "../domain/generate.ts";
import type { GenerationReason } from "../domain/status.ts";
import { tasks } from "./schema.ts";

// What one pass changed.
export type Generated = {
  total: number;
  created: number;
  updated: number;
  reassigned: number;
  cancelled: number;
};

// A term's sources and what they reach, as the engine reads them on a day: the latest published
// framework's items, each with the weeks its rule is due; the holders of each role and the places of
// each section, by department; and the week the term has reached on the college's clock.
async function termInputs(collegeId: string, termId: string, at: Date, db: Db) {
  const [term, settings, published, holders, sections, numbers, timeZone] =
    await Promise.all([
      findTerm(collegeId, termId, db),
      calendarSettings(collegeId, db),
      publishedItems(collegeId, termId, db),
      roleHolders(collegeId, db),
      sectionPlaces(collegeId, termId, db),
      db
        .select({ number: people.employeeNumber, userId: people.userId })
        .from(people)
        .where(eq(people.collegeId, collegeId)),
      getSetting("locale.timeZone", { collegeId }, db),
    ]);
  if (!term) return undefined;
  const calendar = calendarOf(term, term.events, settings, term.breaks);
  const weeks = termWeeks(calendar);
  const shape = { weeks: term.weeks, periods: term.periods };

  const items = (published?.items ?? []).map((item) => ({
    origin: item.origin,
    title: item.title,
    axisId: item.axisId,
    kind: item.kind,
    appliesTo: item.appliesTo,
    weeks: dueWeeks(item.due, shape),
    evidence: item.evidence,
  }));

  const departments = new Map<
    string,
    {
      holders: Record<string, string[]>;
      sections: { ref: string; course: string; places: string[] }[];
    }
  >();
  const of = (id: string) => {
    const found = departments.get(id) ?? { holders: {}, sections: [] };
    departments.set(id, found);
    return found;
  };
  for (const { departmentId, roleId, userId } of holders) {
    const held = of(departmentId).holders;
    held[roleId] = [...(held[roleId] ?? []), userId];
  }
  for (const section of sections) {
    of(section.departmentId).sections.push({
      ref: section.ref,
      course: section.courseCode,
      places: section.places(0).map((place) => place.first),
    });
  }
  const reach: Reach[] = [...departments].map(([departmentId, held]) => ({
    departmentId,
    ...held,
  }));

  const places = new Map(sections.map((section) => [section.ref, section]));
  const accounts = new Map(
    numbers.map(({ number, userId }) => [number, userId]),
  );
  const now: TermNow = {
    week: weekReached(weeks, wallClock(at, timeZone).slice(0, 10)),
    dueOn: (number) => {
      const week = weeks.find((each) => each.number === number);
      return week ? dueDay(calendar, week) : calendar.startsOn;
    },
    holder: (ref, place, week) =>
      places
        .get(ref)
        ?.places(week)
        .find((each) => each.first === place)?.holder ?? place,
    account: (number) => accounts.get(number),
  };
  return { term, version: published?.version, items, reach, now };
}

// The term's tasks from its framework, as the engine compares them.
async function frameworkTasks(db: Db, termId: string): Promise<Task[]> {
  const rows = await db
    .select({
      id: tasks.id,
      item: tasks.sourceItemId,
      occurrence: tasks.occurrence,
      departmentId: tasks.departmentId,
      sectionRef: tasks.sectionRef,
      courseCode: tasks.courseCode,
      place: tasks.place,
      holderId: tasks.holderId,
      week: tasks.week,
      title: tasks.title,
      axisId: tasks.axisId,
      kind: tasks.kind,
      dueOn: tasks.dueOn,
      policy: tasks.policy,
      status: tasks.status,
      cancelledAt: tasks.cancelledAt,
      assigneeId: tasks.assigneeId,
      assigneeNumber: tasks.assigneeNumber,
    })
    .from(tasks)
    .where(and(eq(tasks.termId, termId), eq(tasks.source, "framework")));
  return rows.map(({ cancelledAt, assigneeId, assigneeNumber, ...task }) => ({
    ...task,
    cancelled: cancelledAt !== null,
    assignee: { id: assigneeId, number: assigneeNumber },
  }));
}

// The columns a wanted task sets.
const filled = (wanted: Wanted) => ({
  week: wanted.week,
  title: wanted.title,
  axisId: wanted.axisId,
  kind: wanted.kind,
  dueOn: wanted.dueOn,
  policy: wanted.policy,
  assigneeId: wanted.assignee.id,
  assigneeNumber: wanted.assignee.number,
  updatedAt: sql`now()`,
});

// Work not started, the only work the engine moves or cancels, and work still to do, the only work
// it hands to someone else: each change checks the task is still so, as someone may have started it
// since the engine read it.
const notStarted = and(
  eq(tasks.status, "notStarted"),
  isNull(tasks.cancelledAt),
);
const stillToDo = and(
  inArray(tasks.status, ["notStarted", "inProgress", "returned"]),
  isNull(tasks.cancelledAt),
);

const INSERT_BATCH = 500;

// One department's changes, in one transaction, as many as still apply.
async function applyChanges(
  tx: Tx,
  collegeId: string,
  termId: string,
  changes: Changes,
) {
  let created = 0;
  for (let start = 0; start < changes.create.length; start += INSERT_BATCH) {
    const rows = await tx
      .insert(tasks)
      .values(
        changes.create.slice(start, start + INSERT_BATCH).map((wanted) => ({
          ...filled(wanted),
          collegeId,
          termId,
          departmentId: wanted.departmentId,
          source: "framework" as const,
          sourceItemId: wanted.item,
          occurrence: wanted.occurrence,
          sectionRef: wanted.sectionRef,
          courseCode: wanted.courseCode,
          place: wanted.place,
          holderId: wanted.holderId,
        })),
      )
      .onConflictDoNothing()
      .returning({ id: tasks.id });
    created += rows.length;
  }
  let updated = 0;
  for (const { id, wanted } of changes.update) {
    const rows = await tx
      .update(tasks)
      .set(filled(wanted))
      .where(and(eq(tasks.id, id), notStarted))
      .returning({ id: tasks.id });
    updated += rows.length;
  }
  for (const { id, wanted } of changes.revive) {
    const rows = await tx
      .update(tasks)
      .set({ ...filled(wanted), cancelledAt: null })
      .where(
        and(
          eq(tasks.id, id),
          eq(tasks.status, "notStarted"),
          isNotNull(tasks.cancelledAt),
        ),
      )
      .returning({ id: tasks.id });
    created += rows.length;
  }
  let reassigned = 0;
  for (const { id, assignee } of changes.reassign) {
    const rows = await tx
      .update(tasks)
      .set({
        assigneeId: assignee.id,
        assigneeNumber: assignee.number,
        updatedAt: sql`now()`,
      })
      .where(and(eq(tasks.id, id), stillToDo))
      .returning({ id: tasks.id });
    reassigned += rows.length;
  }
  const cancelled =
    changes.cancel.length === 0
      ? []
      : await tx
          .update(tasks)
          .set({ cancelledAt: sql`now()`, updatedAt: sql`now()` })
          .where(and(inArray(tasks.id, changes.cancel), notStarted))
          .returning({ id: tasks.id });
  return { created, updated, reassigned, cancelled: cancelled.length };
}

// Generates a term's tasks from its latest published framework (docs/PLAN.md, section 3; Step 20):
// a task for each slot it calls for that has none; the new words, week and due day for tasks not
// started, and the new holder of a section's place for work still to do; tasks no longer called for
// cancelled, when not started; finished work never touched. It applies one department at a time,
// telling `progress` how many of the term's tasks it has gone through, and records task.generate
// for the term when anything changed. A closed term's tasks change no more.
export async function generateTerm(
  collegeId: string,
  termId: string,
  reason: GenerationReason,
  {
    at = new Date(),
    progress,
    db = getDb(),
  }: {
    at?: Date;
    progress?: (done: number, total: number) => Promise<unknown>;
    db?: Db;
  } = {},
): Promise<Generated | undefined> {
  const inputs = await termInputs(collegeId, termId, at, db);
  if (!inputs) return undefined;
  const done: Generated = {
    total: 0,
    created: 0,
    updated: 0,
    reassigned: 0,
    cancelled: 0,
  };
  if (inputs.term.status === "closed") return done;
  const wanted = wantedTasks(inputs.items, inputs.reach, inputs.now);
  const existing = await frameworkTasks(db, termId);
  const changes = reconcile(wanted, existing);
  done.total = wanted.length;
  await progress?.(0, done.total);

  // Each department's share of the changes, and of the tasks the term calls for.
  const byDepartment = new Map<string, { changes: Changes; tasks: number }>();
  const share = (departmentId: string) => {
    const found = byDepartment.get(departmentId) ?? {
      changes: { create: [], update: [], revive: [], reassign: [], cancel: [] },
      tasks: 0,
    };
    byDepartment.set(departmentId, found);
    return found;
  };
  for (const each of wanted) share(each.departmentId).tasks += 1;
  for (const each of changes.create)
    share(each.departmentId).changes.create.push(each);
  for (const each of changes.update) {
    share(each.wanted.departmentId).changes.update.push(each);
  }
  for (const each of changes.revive) {
    share(each.wanted.departmentId).changes.revive.push(each);
  }
  const departmentOf = new Map(
    existing.map((task) => [task.id, task.departmentId]),
  );
  for (const each of changes.reassign) {
    share(departmentOf.get(each.id) ?? "").changes.reassign.push(each);
  }
  for (const id of changes.cancel) {
    share(departmentOf.get(id) ?? "").changes.cancel.push(id);
  }

  let gone = 0;
  for (const [, department] of byDepartment) {
    const applied = await db.transaction((tx) =>
      applyChanges(tx, collegeId, termId, department.changes),
    );
    done.created += applied.created;
    done.updated += applied.updated;
    done.reassigned += applied.reassigned;
    done.cancelled += applied.cancelled;
    gone += department.tasks;
    await progress?.(gone, done.total);
  }
  if (done.created + done.updated + done.reassigned + done.cancelled > 0) {
    await writeAudit(
      {
        collegeId,
        actorId: null,
        action: "task.generate",
        entityType: "term",
        entityId: termId,
        diff: {
          to: {
            cause: reason,
            version: inputs.version ?? null,
            created: done.created,
            updated: done.updated,
            reassigned: done.reassigned,
            cancelled: done.cancelled,
          },
        },
      },
      db,
    );
  }
  return done;
}

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  countTasks,
  type DueRule,
  dueWeeks,
  type TermShape,
} from "../../src/modules/framework/index.ts";
import {
  type Changes,
  type Reach,
  reconcile,
  type SourceItem,
  slotKey,
  slotsOf,
  type Task,
  type TermNow,
  taskStatuses,
  wantedTasks,
} from "../../src/modules/tasks/index.ts";

// The generation engine's properties (Step 20), on terms, items for roles, sections and courses,
// departments, transfers and work in every status that fast-check makes up: the preview counts the tasks the engine makes, running
// it again changes nothing, and it never changes finished work.

const ROLES = ["r1", "r2"];
const AXIS = "0199b2a4-0000-7000-8000-0000000000a1";
const POLICY = {
  required: true,
  types: ["pdf"],
  maxFiles: 2,
  requiresApproval: false,
};

const termShape: fc.Arbitrary<TermShape> = fc
  .integer({ min: 1, max: 24 })
  .chain((weeks) =>
    fc.record({
      weeks: fc.constant(weeks),
      events: fc.record({
        exam: fc.array(fc.integer({ min: 1, max: weeks }), { maxLength: 3 }),
        custom: fc.array(fc.integer({ min: 1, max: weeks }), {
          maxLength: 2,
        }),
      }),
    }),
  );

const dueRule: fc.Arbitrary<DueRule> = fc.oneof(
  fc.record({
    type: fc.constant("week" as const),
    week: fc.integer({ min: 1, max: 30 }),
  }),
  fc.constant({ type: "weekly" as const }),
  fc.record({
    type: fc.constant("everyWeeks" as const),
    every: fc.integer({ min: 2, max: 8 }),
  }),
  fc.record({
    type: fc.constant("afterEvent" as const),
    eventKind: fc.constantFrom("exam", "custom", "gradeDeadline"),
    weeks: fc.integer({ min: 0, max: 3 }),
  }),
);

// Items as a framework version has them, before their due weeks are counted.
const items = fc.uniqueArray(
  fc.record({
    origin: fc.constantFrom("a", "b", "c", "d", "e"),
    title: fc.constantFrom("توصيف", "تحليل"),
    appliesTo: fc.oneof(
      fc.record({
        type: fc.constant("role" as const),
        roleId: fc.constantFrom(...ROLES),
      }),
      fc.constant({ type: "eachSection" as const }),
      fc.constant({ type: "eachCourse" as const }),
    ),
    due: dueRule,
    required: fc.boolean(),
  }),
  { selector: (item) => item.origin, maxLength: 4 },
);

const reach: fc.Arbitrary<Reach[]> = fc.uniqueArray(
  fc.record({
    departmentId: fc.constantFrom("d1", "d2", "d3"),
    holders: fc.record({
      r1: fc.uniqueArray(fc.constantFrom("u1", "u2", "u3"), { maxLength: 3 }),
      r2: fc.uniqueArray(fc.constantFrom("u1", "u4"), { maxLength: 2 }),
    }),
    sections: fc.uniqueArray(
      fc.record({
        ref: fc.constantFrom("s1", "s2", "s3"),
        course: fc.constantFrom("c1", "c2"),
        places: fc.uniqueArray(fc.constantFrom("200101", "200102", "200103"), {
          maxLength: 2,
        }),
      }),
      { selector: (section) => section.ref, maxLength: 3 },
    ),
  }),
  { selector: (department) => department.departmentId, maxLength: 3 },
);

// Where the term has got to, and the transfers in force: a place passes to another trainer from a
// week, and some trainers are not on the platform.
const now = (weeks: number): fc.Arbitrary<TermNow> =>
  fc
    .record({
      week: fc.integer({ min: 0, max: weeks }),
      from: fc.integer({ min: 1, max: weeks + 1 }),
      to: fc.constantFrom("200104", "200102"),
      onPlatform: fc.uniqueArray(
        fc.constantFrom<string>("200101", "200102", "200103", "200104"),
      ),
    })
    .map(({ week, from, to, onPlatform }) => ({
      week,
      dueOn: (number) => `day-${number}`,
      holder: (_ref, place, number) =>
        place === "200101" && number >= from ? to : place,
      account: (number) =>
        onPlatform.includes(number) ? `user-${number}` : undefined,
    }));

const sourced = (
  version: {
    origin: string;
    title: string;
    appliesTo: SourceItem["appliesTo"];
    due: DueRule;
    required: boolean;
  }[],
  shape: TermShape,
): SourceItem[] =>
  version.map((item) => ({
    origin: item.origin,
    title: item.title,
    axisId: AXIS,
    kind: "general",
    appliesTo: item.appliesTo,
    weeks: dueWeeks(item.due, shape),
    evidence: { ...POLICY, required: item.required },
  }));

// The changes applied as the engine's service writes them.
function apply(tasks: readonly Task[], changes: Changes): Task[] {
  const byId = new Map(tasks.map((task) => [task.id, { ...task }]));
  const fill = (task: Task, wanted: Changes["create"][number]) =>
    Object.assign(task, {
      week: wanted.week,
      title: wanted.title,
      axisId: wanted.axisId,
      kind: wanted.kind,
      dueOn: wanted.dueOn,
      policy: wanted.policy,
      assignee: wanted.assignee,
    });
  for (const { id, wanted } of changes.update) {
    fill(byId.get(id) as Task, wanted);
  }
  for (const { id, wanted } of changes.revive) {
    Object.assign(fill(byId.get(id) as Task, wanted), { cancelled: false });
  }
  for (const { id, assignee } of changes.reassign) {
    Object.assign(byId.get(id) as Task, { assignee });
  }
  for (const id of changes.cancel) {
    Object.assign(byId.get(id) as Task, { cancelled: true });
  }
  const created = changes.create.map(
    (wanted, index): Task => ({
      id: `new-${tasks.length}-${index}`,
      item: wanted.item,
      occurrence: wanted.occurrence,
      departmentId: wanted.departmentId,
      sectionRef: wanted.sectionRef,
      courseCode: wanted.courseCode,
      place: wanted.place,
      holderId: wanted.holderId,
      week: wanted.week,
      title: wanted.title,
      axisId: wanted.axisId,
      kind: wanted.kind,
      dueOn: wanted.dueOn,
      policy: wanted.policy,
      status: "notStarted",
      cancelled: false,
      assignee: wanted.assignee,
    }),
  );
  return [...byId.values(), ...created];
}

const finished = new Set(["submitted", "done", "notApplicable"]);

describe("the generation engine", () => {
  it("makes as many tasks as the preview counts", () => {
    fc.assert(
      fc.property(termShape, items, reach, (shape, version, departments) => {
        const counted = countTasks(
          version.map(({ appliesTo, due }) => ({ appliesTo, due })),
          departments.map((department) => ({
            roles: Object.fromEntries(
              ROLES.map((role) => [role, department.holders[role].length]),
            ),
            sectionTrainers: department.sections.reduce(
              (sum, section) => sum + section.places.length,
              0,
            ),
            // Each trainer of each course once, however many of its sections they teach.
            courseTrainers: new Set(
              department.sections.flatMap((section) =>
                section.places.map((place) => `${section.course} ${place}`),
              ),
            ).size,
          })),
          shape,
        );
        const slots = slotsOf(sourced(version, shape), departments);
        expect(slots).toHaveLength(counted.tasks);
        expect(new Set(slots.map(slotKey)).size).toBe(slots.length);
      }),
    );
  });

  it("finds nothing to do when run again, leaves finished work alone, and moves started work only to whoever teaches its section", () => {
    fc.assert(
      fc.property(
        termShape.chain((shape) =>
          fc.record({
            shape: fc.constant(shape),
            first: items,
            second: items,
            departments: reach,
            changed: reach,
            earlier: now(shape.weeks),
            later: now(shape.weeks),
            statuses: fc.array(fc.constantFrom(...taskStatuses), {
              maxLength: 60,
            }),
          }),
        ),
        ({
          shape,
          first,
          second,
          departments,
          changed,
          earlier,
          later,
          statuses,
        }) => {
          // The first version published, then work started on some of its tasks.
          const wanted = wantedTasks(
            sourced(first, shape),
            departments,
            earlier,
          );
          const generated = apply([], reconcile(wanted, [])).map(
            (task, index) => ({
              ...task,
              status: statuses[index] ?? task.status,
            }),
          );
          // A second version, Rayat's sections and the term's people changed, some weeks later.
          const again = wantedTasks(sourced(second, shape), changed, later);
          const changes = reconcile(again, generated);
          const after = apply(generated, changes);

          expect(reconcile(again, after)).toEqual({
            create: [],
            update: [],
            revive: [],
            reassign: [],
            cancel: [],
          });
          const before = new Map(generated.map((task) => [task.id, task]));
          for (const task of after) {
            const was = before.get(task.id);
            if (!was) continue;
            if (finished.has(was.status)) expect(task).toEqual(was);
            if (was.status === "inProgress" || was.status === "returned") {
              expect({ ...task, assignee: was.assignee }).toEqual(was);
            }
          }
          const live = new Set(
            after.filter((task) => !task.cancelled).map(slotKey),
          );
          for (const each of again) expect(live.has(slotKey(each))).toBe(true);
        },
      ),
    );
  });
});

import { describe, expect, it } from "vitest";
import {
  reconcile,
  type SourceItem,
  slotsOf,
  type Task,
  type TermNow,
  type Wanted,
  wantedTasks,
} from "./generate.ts";

const TRAINER = "0199b2a4-0000-7000-8000-000000000001";
const AXIS = "0199b2a4-0000-7000-8000-0000000000a1";
const POLICY = {
  required: true,
  types: ["pdf"],
  maxFiles: 2,
  requiresApproval: false,
};

// A course specification from every trainer in week 2, and an exam copy from each section's trainer
// after each exam week, the midterms' in week 8 and the finals' in week 18.
const plan: SourceItem = {
  origin: "plan",
  title: "توصيف المقرر",
  axisId: AXIS,
  kind: "general",
  appliesTo: { type: "role", roleId: TRAINER },
  weeks: [2],
  evidence: POLICY,
};
const examCopy: SourceItem = {
  origin: "exam",
  title: "نسخة الاختبار",
  axisId: AXIS,
  kind: "exam_copy",
  appliesTo: { type: "eachSection" },
  weeks: [8, 18],
  evidence: { ...POLICY, requiresApproval: true },
};

// Electrical: two trainers, and two sections, one taught by two trainers.
const electrical = {
  departmentId: "electrical",
  holders: { [TRAINER]: ["u1", "u2"] },
  sections: [
    { ref: "30101", places: ["200101"] },
    { ref: "30102", places: ["200101", "200102"] },
  ],
};

// Week 5 of the term; 200102 hands section 30102 to 200103 from week 9, and 200103 is not on the
// platform yet.
const accounts: Record<string, string> = { "200101": "u1", "200102": "u2" };
const term = (week: number): TermNow => ({
  week,
  dueOn: (number) => `week-${number}`,
  holder: (ref, place, number) =>
    ref === "30102" && place === "200102" && number >= 9 ? "200103" : place,
  account: (number) => accounts[number],
});

// A task generated for a slot as it was wanted then, in a status.
const task = (
  id: string,
  wanted: Wanted,
  status: Task["status"] = "notStarted",
  cancelled = false,
): Task => ({
  id,
  item: wanted.item,
  occurrence: wanted.occurrence,
  departmentId: wanted.departmentId,
  sectionRef: wanted.sectionRef,
  place: wanted.place,
  holderId: wanted.holderId,
  week: wanted.week,
  title: wanted.title,
  axisId: wanted.axisId,
  kind: wanted.kind,
  dueOn: wanted.dueOn,
  policy: wanted.policy,
  status,
  cancelled,
  assignee: wanted.assignee,
});

describe("slotsOf", () => {
  it("gives each item one slot for each holder of its role, or each place of each section, each time it is due", () => {
    const slots = slotsOf([plan, examCopy], [electrical]);
    // 2 trainers once, and 3 places twice.
    expect(slots).toHaveLength(2 + 3 * 2);
    expect(slots.filter((slot) => slot.item === "exam")).toContainEqual({
      item: "exam",
      occurrence: 2,
      week: 18,
      departmentId: "electrical",
      sectionRef: "30102",
      place: "200102",
      holderId: null,
    });
    expect(slotsOf([examCopy], [{ ...electrical, sections: [] }])).toEqual([]);
  });
});

describe("wantedTasks", () => {
  it("gives a section's task to whoever holds its place in its week, and a holder's to the holder", () => {
    const wanted = wantedTasks([plan, examCopy], [electrical], term(5));
    const of = (ref: string, place: string, week: number) =>
      wanted.find(
        (each) =>
          each.sectionRef === ref && each.place === place && each.week === week,
      );
    expect(of("30102", "200102", 8)?.assignee).toEqual({
      id: "u2",
      number: "200102",
    });
    // From week 9 the place is 200103's, who is not on the platform: the task waits for them.
    expect(of("30102", "200102", 18)?.assignee).toEqual({
      id: null,
      number: "200103",
    });
    expect(wanted.find((each) => each.item === "plan")).toMatchObject({
      assignee: { id: "u1", number: null },
      dueOn: "week-2",
      title: plan.title,
      policy: POLICY,
    });
  });

  it("gives a past week's task to whoever holds the place now: work still to do goes with the section", () => {
    const wanted = wantedTasks([examCopy], [electrical], term(10));
    expect(
      wanted.find((each) => each.place === "200102" && each.week === 8)
        ?.assignee,
    ).toEqual({ id: null, number: "200103" });
  });
});

describe("reconcile", () => {
  const wanted = wantedTasks([plan, examCopy], [electrical], term(5));
  const generated = wanted.map((each, index) => task(`t${index}`, each));

  it("creates a task for each slot, and finds nothing to do the second time", () => {
    expect(reconcile(wanted, []).create).toEqual(wanted);
    expect(reconcile(wanted, generated)).toEqual({
      create: [],
      update: [],
      revive: [],
      reassign: [],
      cancel: [],
    });
  });

  it("moves a task not started to its rule's new week, with the item's new words", () => {
    const moved = wantedTasks(
      [{ ...plan, title: "توصيف المقررات", weeks: [3] }],
      [electrical],
      term(5),
    );
    const changes = reconcile(moved, generated);
    expect(changes.update.map(({ id }) => id)).toEqual(["t0", "t1"]);
    expect(changes.update[0].wanted).toMatchObject({
      week: 3,
      dueOn: "week-3",
      title: "توصيف المقررات",
    });
    // The exam copies the new version no longer has are cancelled.
    expect(changes.cancel).toHaveLength(6);
  });

  it("leaves started and finished work where it is, but hands work still to do to the place's new holder", () => {
    const started = [
      task("t0", wanted[0], "inProgress"),
      task("t1", wanted[1], "done"),
      ...generated.slice(2),
    ];
    // A new version moves the plan to week 3 and drops the exam copies.
    const moved = wantedTasks([{ ...plan, weeks: [3] }], [electrical], term(5));
    const changes = reconcile(moved, started);
    expect(changes.update).toEqual([]);
    expect(changes.cancel).toHaveLength(6);

    // A transfer, once in effect, moves the returned work of week 8 to 200103; the done one stays.
    const midterm = (place: string) =>
      wanted.find(
        (each) =>
          each.sectionRef === "30102" &&
          each.place === place &&
          each.week === 8,
      ) as Wanted;
    const later = wantedTasks([plan, examCopy], [electrical], term(10));
    const tasks = [
      task("returned", midterm("200102"), "returned"),
      task("done", midterm("200101"), "done"),
    ];
    expect(reconcile(later, tasks).reassign).toEqual([
      { id: "returned", assignee: { id: null, number: "200103" } },
    ]);
  });

  it("brings a cancelled task back when its slot is called for again", () => {
    const cancelled = generated.map((each) => ({ ...each, cancelled: true }));
    const changes = reconcile(wanted, cancelled);
    expect(changes.revive).toHaveLength(wanted.length);
    expect(changes.create).toEqual([]);
    expect(changes.cancel).toEqual([]);
  });
});

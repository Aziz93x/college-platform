import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedBase } from "../../db/seed/base.ts";
import {
  cancelTransfer,
  keepTransfer,
  listSections,
  sectionCounts,
  transferSection,
  unmatchedTrainers,
} from "../../src/modules/academics/index.ts";
import { joinRole } from "../../src/modules/access/index.ts";
import { createAccount } from "../../src/modules/identity/index.ts";
import { createDepartment } from "../../src/modules/org/index.ts";
import {
  applyRayat,
  type RayatKind,
  rollbackRayat,
  uploadRayat,
} from "../../src/modules/rayat/index.ts";
import {
  activateTerm,
  closeTerm,
  createTerm,
} from "../../src/modules/terms/index.ts";
import { createSharedTestDatabase } from "./support/database.ts";
import { rayatTable } from "./support/rayat-table.ts";

// A term's sections, read from Rayat's SS01 in force with SF01's registrations, their trainers
// matched by employee number, and a head's transfers of them (Step 17).
let database: Awaited<ReturnType<typeof createSharedTestDatabase>>;
let collegeId: string;
let termId: string;
let electrical: string;
let mechanical: string;
const people: Record<string, string> = {};
const TERM = "الفصل التدريبي الأول 1448";
const ELECTRICAL = "قسم التقنية الكهربائية";
const MECHANICAL = "قسم التقنية الميكانيكية";

const query = async (text: string, values: unknown[] = []) =>
  (await database.pool.query(text, values)).rows;
const by = (name: string) => ({ collegeId, actorId: people[name] });

// An SS01 meeting row of a section, taught by a trainer.
const meeting = (
  sectionRef: string,
  trainerNumber: string,
  changes: Record<string, string> = {},
) => ({
  term: TERM,
  department: ELECTRICAL,
  courseCode: `كهر ${sectionRef.slice(-3)}`,
  courseName: "الدوائر الكهربائية",
  creditHours: "3",
  sectionRef,
  deliveryMode: "حضوري",
  day: "الأحد",
  time: "08:00 - 09:40",
  building: "المبنى 1",
  room: "101",
  capacity: "30",
  enrolled: "28",
  remaining: "2",
  trainerNumber,
  ...changes,
});

// Uploads a report as the vice-dean and applies it.
async function applied<K extends RayatKind>(
  kind: K,
  rows: Parameters<typeof rayatTable<K>>[1],
) {
  const upload = await uploadRayat(
    kind,
    termId,
    rayatTable(kind, rows),
    by("viceDean"),
    database.db,
  );
  if (upload.status !== "pending") throw new Error(upload.status);
  await applyRayat(upload.importId, by("viceDean"), database.db);
  return upload.importId;
}

// SS01 with 30101 taught by this trainer, 30102 by 200102 and 200109, who is not on the platform,
// and Mechanical's 30201.
const ss01 = (first = "200101", { without = "" } = {}) =>
  [
    meeting("30101", first),
    meeting("30102", "200102"),
    meeting("30102", "200109", { day: "الثلاثاء" }),
    meeting("30201", "200104", { department: MECHANICAL }),
  ].filter((row) => row.sectionRef !== without);

const transfer = (changes: Partial<Parameters<typeof transferSection>[0]>) =>
  transferSection(
    {
      termId,
      sectionRef: "30101",
      fromNumber: "200101",
      toUserId: people.third,
      week: 6,
      reason: "إعادة توزيع الأنصبة",
      ...changes,
    },
    by("head"),
    database.db,
  );

const section = async (ref: string, week = 1) =>
  (
    await listSections(collegeId, termId, "college", week, database.db)
  ).sections.find((each) => each.ref === ref);

beforeAll(async () => {
  // Shared: the people a section goes to are read through the directory, whose lockout settings
  // come through getDb().
  database = await createSharedTestDatabase();
  collegeId = await seedBase(database.db, {
    name: "Test College",
    shortName: "TC",
  });
  for (const [name, number] of [
    ["viceDean", "600001"],
    ["head", "300001"],
    ["first", "200101"],
    ["second", "200102"],
    ["third", "200103"],
    ["mechanic", "200104"],
  ]) {
    people[name] = await database.db.transaction(
      async (tx) =>
        (
          await createAccount(
            {
              collegeId,
              name,
              email: `${name}@college.example`,
              employeeNumber: number,
            },
            tx,
            `password-${name}`,
          )
        ).userId,
    );
  }
  const department = async (name: string, value: string) => {
    const made = await createDepartment(
      { name, shortName: name, rayatValues: [value], active: true },
      by("viceDean"),
      database.db,
    );
    if (made.status !== "created") throw new Error(made.status);
    return made.id;
  };
  electrical = await department("Electrical", ELECTRICAL);
  mechanical = await department("Mechanical", MECHANICAL);
  for (const [name, role, departmentId] of [
    ["head", "head", electrical],
    ["first", "trainer", electrical],
    ["second", "trainer", electrical],
    ["third", "trainer", electrical],
    ["mechanic", "trainer", mechanical],
  ]) {
    await joinRole(
      { userId: people[name], collegeId, role: { key: role }, departmentId },
      database.db,
    );
  }
  const created = await createTerm(
    { name: TERM, startsOn: "2026-08-23", weeks: 18 },
    by("viceDean"),
    database.db,
  );
  if (created.status !== "created") throw new Error(created.status);
  termId = created.id;
  await activateTerm(termId, by("viceDean"), database.db);

  await applied("ss01", ss01());
  await applied(
    "sf01",
    ["مسجل", "مسجل", "منسحب"].map((registrationStatus, at) => ({
      term: TERM,
      department: ELECTRICAL,
      courseCode: "كهر 101",
      sectionRef: "30101",
      traineeNumber: `44410000${at}`,
      registrationStatus,
      traineeStatus: "منتظم",
    })),
  );
});

afterAll(() => database?.drop());

describe("a term's sections", () => {
  it("are SS01's in force by course and reference, with SF01's registrations by status and their trainers matched by employee number", async () => {
    const { sections, gone } = await listSections(
      collegeId,
      termId,
      "college",
      1,
      database.db,
    );
    expect(gone).toEqual([]);
    expect(
      sections.map(({ ref, departmentId, trainers, registrations }) => ({
        ref,
        departmentId,
        trainers,
        registrations,
      })),
    ).toEqual([
      {
        ref: "30101",
        departmentId: electrical,
        trainers: [{ number: "200101", userId: people.first, name: "first" }],
        registrations: [
          { status: "مسجل", count: 2 },
          { status: "منسحب", count: 1 },
        ],
      },
      {
        ref: "30102",
        departmentId: electrical,
        trainers: [
          { number: "200102", userId: people.second, name: "second" },
          { number: "200109" },
        ],
        registrations: [],
      },
      {
        ref: "30201",
        departmentId: mechanical,
        trainers: [
          { number: "200104", userId: people.mechanic, name: "mechanic" },
        ],
        registrations: [],
      },
    ]);
    expect(sections[0]).toMatchObject({
      course: { code: "كهر 101", name: "الدوائر الكهربائية", hours: 3 },
      deliveryMode: "حضوري",
      capacity: 30,
      enrolled: 28,
      meetings: [
        {
          day: "الأحد",
          time: "08:00 - 09:40",
          building: "المبنى 1",
          room: "101",
        },
      ],
    });
  });

  it("keep to the departments asked for, and are counted by department for the framework's preview", async () => {
    expect(
      (
        await listSections(collegeId, termId, [mechanical], 1, database.db)
      ).sections.map(({ ref }) => ref),
    ).toEqual(["30201"]);
    await expect(
      sectionCounts(collegeId, termId, database.db),
    ).resolves.toEqual({ [electrical]: 2, [mechanical]: 1 });
  });

  it("report the trainers SS01 names who are not on the platform, with their sections", async () => {
    await expect(
      unmatchedTrainers(collegeId, termId, database.db),
    ).resolves.toEqual([{ number: "200109", sections: ["30102"] }]);
  });
});

describe("a section's transfer", () => {
  it("refuses a section SS01 does not have, a week past the term's, someone not teaching it then, and someone it cannot go to or who teaches it already, and keeps nothing", async () => {
    for (const [changes, status] of [
      [{ sectionRef: "39999" }, "notFound"],
      [{ week: 19 }, "week"],
      [{ fromNumber: "200102" }, "notTrainer"],
      [{ toUserId: people.mechanic }, "notCandidate"],
      [{ toUserId: people.head }, "notCandidate"],
      [
        { sectionRef: "30102", fromNumber: "200109", toUserId: people.second },
        "alreadyTrainer",
      ],
    ] as const) {
      await expect(transfer(changes), JSON.stringify(changes)).resolves.toEqual(
        { status },
      );
    }
    expect(await query("select * from section_transfers")).toEqual([]);
  });

  it("gives the section to the new trainer from its week on, and records sectionTransfer.create", async () => {
    const made = await transfer({});
    if (made.status !== "transferred") throw new Error(made.status);
    expect((await section("30101", 5))?.trainers).toEqual([
      { number: "200101", userId: people.first, name: "first" },
    ]);
    expect(await section("30101", 6)).toMatchObject({
      trainers: [{ number: "200103", userId: people.third, name: "third" }],
      transfers: [
        {
          id: made.id,
          from: { number: "200101", name: "first" },
          to: { number: "200103", name: "third" },
          week: 6,
          reason: "إعادة توزيع الأنصبة",
          by: "head",
          status: "holds",
        },
      ],
    });
    expect(
      await query(
        "select actor_id, diff from audit_events where entity_type = 'sectionTransfer'",
      ),
    ).toEqual([
      {
        actor_id: people.head,
        diff: {
          to: {
            termId,
            sectionRef: "30101",
            fromNumber: "200101",
            userId: people.third,
            week: 6,
            reason: "إعادة توزيع الأنصبة",
          },
        },
      },
    ]);
    // A second transfer of the same trainer that week finds them gone from the section.
    await expect(transfer({ toUserId: people.second })).resolves.toEqual({
      status: "notTrainer",
    });
  });

  it("holds until a newer SS01, which confirms it or is in conflict with it; rolling one back, or the head keeping it, changes that again", async () => {
    const status = async () => (await section("30101"))?.transfers[0].status;
    expect(await status()).toBe("holds");

    await applied("ss01", ss01("200103"));
    expect(await status()).toBe("confirmed");
    const conflicting = await applied("ss01", ss01("200109"));
    expect(await status()).toBe("conflict");
    await rollbackRayat(conflicting, by("viceDean"), database.db);
    expect(await status()).toBe("confirmed");
    // Rayat still naming the trainer replaced is in conflict too.
    await applied("ss01", ss01("200101"));
    expect(await status()).toBe("conflict");

    const id = (await section("30101"))?.transfers[0].id ?? "";
    await expect(keepTransfer(id, by("head"), database.db)).resolves.toEqual({
      status: "kept",
    });
    expect(await status()).toBe("holds");
  });

  it("of a section a newer SS01 drops is listed apart, and cancelling a transfer gives the section back to Rayat's trainers", async () => {
    const made = await transfer({
      sectionRef: "30102",
      fromNumber: "200109",
      week: 3,
    });
    if (made.status !== "transferred") throw new Error(made.status);
    await applied("ss01", ss01("200101", { without: "30102" }));
    const { sections, gone } = await listSections(
      collegeId,
      termId,
      [electrical],
      9,
      database.db,
    );
    expect(sections.map(({ ref }) => ref)).toEqual(["30101"]);
    expect(gone).toMatchObject([
      { id: made.id, sectionRef: "30102", status: "conflict" },
    ]);
    // Out of the departments asked for, it is not listed.
    expect(
      (await listSections(collegeId, termId, [mechanical], 9, database.db))
        .gone,
    ).toEqual([]);

    await expect(
      cancelTransfer(made.id, by("head"), database.db),
    ).resolves.toEqual({ status: "cancelled" });
    const first = (await section("30101", 9))?.transfers[0].id ?? "";
    await cancelTransfer(first, by("head"), database.db);
    expect(await section("30101", 9)).toMatchObject({
      trainers: [{ number: "200101", name: "first" }],
      transfers: [],
    });
    expect(
      (
        await query(
          "select action from audit_events where entity_type = 'sectionTransfer' order by created_at, action",
        )
      ).map(({ action }) => action),
    ).toEqual([
      "sectionTransfer.create",
      "sectionTransfer.keep",
      "sectionTransfer.create",
      "sectionTransfer.cancel",
      "sectionTransfer.cancel",
    ]);
    await expect(
      cancelTransfer(made.id, by("head"), database.db),
    ).resolves.toEqual({ status: "notFound" });
  });

  it("is refused, and so are keeping and cancelling one, once the term is closed", async () => {
    const made = await transfer({});
    if (made.status !== "transferred") throw new Error(made.status);
    await closeTerm(termId, by("viceDean"), database.db);
    await expect(transfer({ toUserId: people.second })).resolves.toEqual({
      status: "termClosed",
    });
    await expect(
      keepTransfer(made.id, by("head"), database.db),
    ).resolves.toEqual({ status: "termClosed" });
    await expect(
      cancelTransfer(made.id, by("head"), database.db),
    ).resolves.toEqual({ status: "termClosed" });
  });
});

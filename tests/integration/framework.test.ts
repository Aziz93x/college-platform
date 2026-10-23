import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedBase } from "../../db/seed/base.ts";
import { addMembership, countMembers } from "../../src/modules/access/index.ts";
import {
  addItem,
  copyFrameworkInto,
  endorseDraft,
  type FrameworkItemInput,
  publishDraft,
  removeItem,
  startDraft,
  termFramework,
  updateItem,
} from "../../src/modules/framework/index.ts";
import { createAccount } from "../../src/modules/identity/index.ts";
import {
  calendarSettings,
  createTerm,
  openNextTerm,
} from "../../src/modules/terms/index.ts";
import { createTestDatabase } from "./support/database.ts";

// The term's general framework (Step 15): a draft the vice-dean fills, the dean's endorsement where
// the college asks for it, a published version that never changes, the next version started from
// it, and the next term's draft copied by the Step 13 wizard.
let database: Awaited<ReturnType<typeof createTestDatabase>>;
let collegeId: string;
let termId: string;
let axisId: string;
let trainerRole: string;
const people: Record<string, string> = {};

const query = async (text: string, values: unknown[] = []) =>
  (await database.pool.query(text, values)).rows;
const change = (who = "viceDean") => ({ collegeId, actorId: people[who] });

// The file types the college accepts, as the item actions read them from files.acceptedTypes.
const accepted = ["pdf", "xlsx", "docx"];

const item = (title: string): FrameworkItemInput => ({
  title,
  axisId,
  kind: "grade_analysis",
  appliesTo: { type: "role", roleId: trainerRole },
  due: { type: "afterEvent", eventKind: "exam", weeks: 1 },
  evidence: {
    required: true,
    types: ["pdf", "xlsx"],
    maxFiles: 2,
    requiresApproval: false,
  },
  notes: "",
});

beforeAll(async () => {
  database = await createTestDatabase();
  collegeId = await seedBase(database.db, {
    name: "Test College",
    shortName: "TC",
  });
  for (const name of ["viceDean", "dean", "hind", "noura"]) {
    people[name] = await database.db.transaction(
      async (tx) =>
        (
          await createAccount(
            {
              collegeId,
              name,
              email: `${name}@college.example`,
              employeeNumber: `6${Object.keys(people).length}0001`,
            },
            tx,
            `password-${name}`,
          )
        ).userId,
    );
  }
  [{ id: axisId }] = await query("select id from axes where code = '3'");
  [{ id: trainerRole }] = await query(
    "select id from roles where college_id = $1 and key = 'trainer'",
    [collegeId],
  );
  const created = await createTerm(
    { name: "الفصل الأول 1448", startsOn: "2026-08-23", weeks: 18 },
    change(),
    database.db,
  );
  if (created.status !== "created") throw new Error(created.status);
  termId = created.id;
});

afterAll(() => database?.drop());

describe("a framework's versions", () => {
  it("starts as an empty draft, takes items, and publishes a version that changes no more", async () => {
    const draft = await startDraft(termId, change(), database.db);
    if (draft.status !== "created") throw new Error(draft.status);
    await expect(startDraft(termId, change(), database.db)).resolves.toEqual({
      status: "exists",
      id: draft.id,
    });
    await expect(
      publishDraft(draft.id, change(), false, database.db),
    ).resolves.toEqual({ status: "empty" });

    const added = await addItem(
      draft.id,
      item("تحليل نتائج الاختبار"),
      change(),
      accepted,
      database.db,
    );
    if (added.status !== "saved") throw new Error(added.status);
    await addItem(
      draft.id,
      item("ملف المقرر"),
      change(),
      accepted,
      database.db,
    );
    await expect(
      updateItem(
        added.id,
        item("تحليل نتائج الاختبار"),
        change(),
        accepted,
        database.db,
      ),
    ).resolves.toEqual({ status: "unchanged" });
    await expect(
      updateItem(
        added.id,
        { ...item("تحليل النتائج"), notes: "بعد أسبوع" },
        change(),
        accepted,
        database.db,
      ),
    ).resolves.toEqual({ status: "saved" });

    await expect(
      publishDraft(draft.id, change(), false, database.db),
    ).resolves.toEqual({ status: "published", termId });
    // Published: its items stay as they were.
    await expect(
      addItem(draft.id, item("بند متأخر"), change(), accepted, database.db),
    ).resolves.toEqual({ status: "notDraft" });
    await expect(
      updateItem(added.id, item("تغيير"), change(), accepted, database.db),
    ).resolves.toEqual({ status: "notDraft" });
    await expect(removeItem(added.id, change(), database.db)).resolves.toEqual({
      status: "notDraft",
    });

    const { draft: none, published } = await termFramework(
      collegeId,
      termId,
      database.db,
    );
    expect(none).toBeUndefined();
    expect(published).toMatchObject({ version: 1, status: "published" });
    expect(published?.items.map(({ title, notes }) => [title, notes])).toEqual([
      ["تحليل النتائج", "بعد أسبوع"],
      ["ملف المقرر", ""],
    ]);
    expect(
      (
        await query(
          "select action from audit_events where entity_type = 'framework' order by created_at, id",
        )
      ).map(({ action }) => action),
    ).toEqual([
      "framework.create",
      "frameworkItem.create",
      "frameworkItem.create",
      "frameworkItem.update",
      "framework.publish",
    ]);
  });

  it("starts the next version from the published one, and leaves the published one as it was", async () => {
    const next = await startDraft(termId, change(), database.db);
    if (next.status !== "created") throw new Error(next.status);
    const { draft, published } = await termFramework(
      collegeId,
      termId,
      database.db,
    );
    expect(draft).toMatchObject({ version: 2 });
    expect(draft?.items.map(({ title }) => title)).toEqual(
      published?.items.map(({ title }) => title),
    );
    const [first] = draft?.items ?? [];
    await removeItem(first.id, change(), database.db);
    const after = await termFramework(collegeId, termId, database.db);
    expect(after.draft?.items).toHaveLength(1);
    expect(after.published?.items).toHaveLength(2);
  });

  it("waits for the dean's endorsement where the college asks for it, and a change takes it back", async () => {
    const { draft } = await termFramework(collegeId, termId, database.db);
    if (!draft) throw new Error("no draft");
    await expect(
      publishDraft(draft.id, change(), true, database.db),
    ).resolves.toEqual({ status: "notEndorsed" });
    await expect(
      endorseDraft(draft.id, change("dean"), database.db),
    ).resolves.toEqual({ status: "endorsed" });
    // An item added after the endorsement takes it back.
    await addItem(
      draft.id,
      item("تقرير الواجبات"),
      change(),
      accepted,
      database.db,
    );
    await expect(
      publishDraft(draft.id, change(), true, database.db),
    ).resolves.toEqual({ status: "notEndorsed" });
    await endorseDraft(draft.id, change("dean"), database.db);
    await expect(
      publishDraft(draft.id, change(), true, database.db),
    ).resolves.toEqual({ status: "published", termId });
    expect(
      await query(
        "select actor_id from audit_events where action = 'framework.endorse'",
      ),
    ).toEqual([{ actor_id: people.dean }, { actor_id: people.dean }]);
  });

  it("is copied as a draft into the next term the wizard opens, from its latest published version", async () => {
    const settings = await calendarSettings(collegeId, database.db);
    const next = await openNextTerm(
      termId,
      { name: "الفصل الثاني 1448", startsOn: "2027-01-10", weeks: 18 },
      change(),
      settings,
      database.db,
      (tx, from, to) => copyFrameworkInto(tx, from, to, change()),
    );
    if (next.status !== "created") throw new Error(next.status);
    const copied = await termFramework(collegeId, next.id, database.db);
    expect(copied.published).toBeUndefined();
    expect(copied.draft).toMatchObject({ version: 1, status: "draft" });
    expect(copied.draft?.items.map(({ title }) => title)).toEqual([
      "ملف المقرر",
      "تقرير الواجبات",
    ]);
  });

  it("takes only what the college offers, and nothing once its term has closed (Audit 5)", async () => {
    const created = await createTerm(
      { name: "الفصل الصيفي 1448", startsOn: "2027-06-13", weeks: 8 },
      change(),
      database.db,
    );
    if (created.status !== "created") throw new Error(created.status);
    const draft = await startDraft(created.id, change(), database.db);
    if (draft.status !== "created") throw new Error(draft.status);
    const [{ id: system }] = await query(
      "select id from roles where college_id = $1 and system",
      [collegeId],
    );
    const base = item("ملف المقرر");
    // A file type the college does not accept, a kind of day no calendar has, the system role, and
    // a role of no college's.
    for (const refused of [
      { ...base, evidence: { ...base.evidence, types: ["mp4"] } },
      { ...base, due: { type: "afterEvent", eventKind: "trip", weeks: 1 } },
      { ...base, appliesTo: { type: "role", roleId: system } },
      { ...base, appliesTo: { type: "role", roleId: randomUUID() } },
    ] satisfies FrameworkItemInput[]) {
      await expect(
        addItem(draft.id, refused, change(), accepted, database.db),
      ).resolves.toEqual({ status: "notOffered" });
    }
    const added = await addItem(
      draft.id,
      base,
      change(),
      accepted,
      database.db,
    );
    if (added.status !== "saved") throw new Error(added.status);
    await expect(
      updateItem(
        added.id,
        { ...base, evidence: { ...base.evidence, types: ["pdf", "mp4"] } },
        change(),
        accepted,
        database.db,
      ),
    ).resolves.toEqual({ status: "notOffered" });

    // Its term closes with the draft unpublished: the draft changes no more.
    await query("update terms set status = 'closed' where id = $1", [
      created.id,
    ]);
    await expect(
      addItem(draft.id, base, change(), accepted, database.db),
    ).resolves.toEqual({ status: "closed" });
    await expect(
      updateItem(
        added.id,
        { ...base, notes: "متأخر" },
        change(),
        accepted,
        database.db,
      ),
    ).resolves.toEqual({ status: "closed" });
    await expect(removeItem(added.id, change(), database.db)).resolves.toEqual({
      status: "closed",
    });
    await expect(
      endorseDraft(draft.id, change("dean"), database.db),
    ).resolves.toEqual({ status: "closed" });
    await expect(
      publishDraft(draft.id, change(), false, database.db),
    ).resolves.toEqual({ status: "closed" });
  });
});

it("counts the enabled holders of each role in each active department", async () => {
  const [{ id: electrical }] = await query(
    "insert into departments (college_id, name, short_name) values ($1, 'Electrical', 'Elec') returning id",
    [collegeId],
  );
  for (const who of ["hind", "noura"]) {
    await addMembership(
      { userId: people[who], roleId: trainerRole, departmentId: electrical },
      { collegeId, actorId: people.viceDean },
      database.db,
    );
  }
  await query("update users set disabled_at = now() where id = $1", [
    people.noura,
  ]);
  // Hind also holds the role for the active term alone: still one person (Audit 5).
  await query("update terms set status = 'active' where id = $1", [termId]);
  await expect(
    addMembership(
      {
        userId: people.hind,
        roleId: trainerRole,
        departmentId: electrical,
        termId,
      },
      { collegeId, actorId: people.viceDean },
      database.db,
    ),
  ).resolves.toMatchObject({ status: "added" });
  expect(await countMembers(collegeId, database.db)).toEqual([
    { departmentId: electrical, roleId: trainerRole, count: 1 },
  ]);
});

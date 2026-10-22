import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedBase } from "../../db/seed/base.ts";
import { rayatColumns, rayatHeaders } from "../../db/seed/rayat-columns.ts";
import { createAccount } from "../../src/modules/identity/index.ts";
import { createDepartment } from "../../src/modules/org/index.ts";
import {
  applyRayat,
  currentRayatRecords,
  discardRayat,
  listRayatImports,
  type RayatKind,
  rollbackRayat,
  uploadRayat,
} from "../../src/modules/rayat/index.ts";
import {
  activateTerm,
  closeTerm,
  createTerm,
} from "../../src/modules/terms/index.ts";
import { createTestDatabase } from "./support/database.ts";

// Rayat's reports imported for a term (Step 16): checked whole, diffed against the version in force,
// applied in one step, kept as versions and rolled back; and never a trainee's name, mobile number
// or grade kept, in the schema or in the data.
let database: Awaited<ReturnType<typeof createTestDatabase>>;
let collegeId: string;
let viceDean: string;
let termId: string;
const TERM = "الفصل التدريبي الأول 1448";
const ELECTRICAL = "قسم التقنية الكهربائية";

const query = async (text: string, values: unknown[] = []) =>
  (await database.pool.query(text, values)).rows;
const change = () => ({ collegeId, actorId: viceDean });

// A report as Rayat exports it: its header row, then each row's columns read, by field, and the
// others, by header.
function table<K extends RayatKind>(
  kind: K,
  rows: Partial<Record<keyof (typeof rayatColumns)[K], string>>[],
  dropped: Record<string, string>[] = [],
) {
  const columns = rayatColumns[kind] as Record<string, string>;
  return [
    rayatHeaders[kind],
    ...rows.map((row, at) =>
      rayatHeaders[kind].map((header) => {
        const field = Object.keys(columns).find(
          (name) => columns[name] === header,
        );
        return field
          ? ((row as Record<string, string>)[field] ?? "")
          : (dropped[at]?.[header] ?? "");
      }),
    ),
  ];
}

const section = (sectionRef: string, changes: Record<string, string> = {}) => ({
  term: TERM,
  department: ELECTRICAL,
  courseCode: "كهر 101",
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
  trainerNumber: "200101",
  ...changes,
});

const enrollment = (traineeNumber: string, changes = {}) => ({
  term: TERM,
  department: ELECTRICAL,
  courseCode: "كهر 101",
  sectionRef: "30101",
  traineeNumber,
  registrationStatus: "مسجل",
  traineeStatus: "منتظم",
  ...changes,
});

const absence = (traineeNumber: string) => ({
  termCode: "14481",
  term: TERM,
  department: ELECTRICAL,
  subjectCode: "كهر",
  courseNumber: "101",
  traineeNumber,
  courseStatus: "منتظم",
  absencePercent: "5",
  absenceHours: "2",
});

async function upload<K extends RayatKind>(
  kind: K,
  rows: Parameters<typeof table<K>>[1],
  dropped?: Record<string, string>[],
) {
  return uploadRayat(
    kind,
    termId,
    table(kind, rows, dropped),
    change(),
    database.db,
  );
}

async function pending<K extends RayatKind>(
  kind: K,
  rows: Parameters<typeof table<K>>[1],
  dropped?: Record<string, string>[],
) {
  const result = await upload(kind, rows, dropped);
  if (result.status !== "pending") throw new Error(result.status);
  return result;
}

const imports = async () =>
  Number((await query("select count(*) from rayat_imports"))[0].count);

beforeAll(async () => {
  database = await createTestDatabase();
  collegeId = await seedBase(database.db, {
    name: "Test College",
    shortName: "TC",
  });
  viceDean = await database.db.transaction(
    async (tx) =>
      (
        await createAccount(
          {
            collegeId,
            name: "viceDean",
            email: "vice-dean@college.example",
            employeeNumber: "600001",
          },
          tx,
          "password-vice-dean",
        )
      ).userId,
  );
  for (const [name, values, active] of [
    ["Electrical", [ELECTRICAL], true],
    ["Mechanical", ["قسم التقنية الميكانيكية"], false],
  ] as const) {
    await createDepartment(
      { name, shortName: name, rayatValues: [...values], active },
      change(),
      database.db,
    );
  }
  const created = await createTerm(
    { name: TERM, startsOn: "2026-08-23", weeks: 18 },
    change(),
    database.db,
  );
  if (created.status !== "created") throw new Error(created.status);
  termId = created.id;
});

afterAll(() => database?.drop());

describe("a term's version of a report", () => {
  it("is applied in one step, kept with the versions before it, and rolled back to the one before", async () => {
    const first = await pending("ss01", [
      section("30101"),
      section("30101", { day: "الثلاثاء", trainerNumber: "200102" }),
      section("30102", { capacity: "25", enrolled: "26", remaining: "-1" }),
    ]);
    expect(first).toMatchObject({
      rows: 3,
      records: 2,
      diff: { added: 2, removed: 0, changed: 0, unchanged: 0 },
    });
    // Waiting to be applied, it is not the term's version yet.
    await expect(
      currentRayatRecords(collegeId, termId, "ss01", database.db),
    ).resolves.toEqual([]);
    await expect(
      applyRayat(first.importId, change(), database.db),
    ).resolves.toEqual({ status: "applied" });
    const applied = await currentRayatRecords(
      collegeId,
      termId,
      "ss01",
      database.db,
    );
    expect(applied).toEqual([
      expect.objectContaining({
        sectionRef: "30101",
        creditHours: 3,
        capacity: 30,
        enrolled: 28,
        meetings: [
          {
            day: "الأحد",
            time: "08:00 - 09:40",
            building: "المبنى 1",
            room: "101",
          },
          {
            day: "الثلاثاء",
            time: "08:00 - 09:40",
            building: "المبنى 1",
            room: "101",
          },
        ],
        trainerNumbers: ["200101", "200102"],
      }),
      expect.objectContaining({
        sectionRef: "30102",
        capacity: 25,
        enrolled: 26,
      }),
    ]);

    const second = await pending("ss01", [
      section("30101", { capacity: "32", remaining: "4" }),
      section("30101", {
        day: "الثلاثاء",
        trainerNumber: "200102",
        capacity: "32",
        remaining: "4",
      }),
      section("30103"),
    ]);
    expect(second.diff).toMatchObject({
      added: 1,
      removed: 1,
      changed: 1,
      samples: {
        added: [["30103"]],
        removed: [["30102"]],
        changed: [{ key: ["30101"], fields: ["capacity"] }],
      },
    });
    await applyRayat(second.importId, change(), database.db);
    expect(
      (await currentRayatRecords(collegeId, termId, "ss01", database.db)).map(
        ({ sectionRef }) => sectionRef,
      ),
    ).toEqual(["30101", "30103"]);

    await expect(
      rollbackRayat(first.importId, change(), database.db),
    ).resolves.toEqual({ status: "notCurrent" });
    await expect(
      rollbackRayat(second.importId, change(), database.db),
    ).resolves.toEqual({ status: "rolledBack" });
    await expect(
      currentRayatRecords(collegeId, termId, "ss01", database.db),
    ).resolves.toEqual(applied);
    expect(
      (await listRayatImports(collegeId, termId, database.db)).map(
        ({ id, status, current }) => ({ id, status, current }),
      ),
    ).toEqual([
      { id: second.importId, status: "rolledBack", current: false },
      { id: first.importId, status: "applied", current: true },
    ]);
  });

  it("keeps one upload waiting at most, drops it once the version it was diffed against is rolled back, and keeps none with nothing new", async () => {
    const first = await pending("sf01", [enrollment("444100001")]);
    await applyRayat(first.importId, change(), database.db);
    await expect(upload("sf01", [enrollment("444100001")])).resolves.toEqual({
      status: "unchanged",
    });

    const older = await pending("sf01", [enrollment("444100002")]);
    const newer = await pending("sf01", [
      enrollment("444100001", { registrationStatus: "منسحب" }),
    ]);
    await expect(
      applyRayat(older.importId, change(), database.db),
    ).resolves.toEqual({ status: "notPending" });
    await expect(
      discardRayat(newer.importId, change(), database.db),
    ).resolves.toEqual({ status: "discarded" });

    const waiting = await pending("sf01", [enrollment("444100003")]);
    await rollbackRayat(first.importId, change(), database.db);
    await expect(
      applyRayat(waiting.importId, change(), database.db),
    ).resolves.toEqual({ status: "notPending" });
    expect(
      (await listRayatImports(collegeId, termId, database.db))
        .filter(({ kind }) => kind === "sf01")
        .map(({ status }) => status),
    ).toEqual(["rolledBack"]);

    expect(
      (
        await query(
          "select action, diff from audit_events where entity_type = 'rayatImport' and diff->>'report' = 'sf01' order by created_at, action",
        )
      ).map(({ action }) => action),
    ).toEqual([
      "rayatImport.upload",
      "rayatImport.apply",
      "rayatImport.upload",
      "rayatImport.upload",
      "rayatImport.discard",
      "rayatImport.upload",
      "rayatImport.rollback",
    ]);
  });

  // A head imports the college's reports as the vice-dean does, and the page names who did what
  // (ADR-0019).
  it("names who uploaded each version and, when someone else applied it, who applied it", async () => {
    const head = await database.db.transaction(
      async (tx) =>
        (
          await createAccount(
            {
              collegeId,
              name: "head",
              email: "head@college.example",
              employeeNumber: "600002",
            },
            tx,
            "password-head",
          )
        ).userId,
    );
    const byHead = (rows: ReturnType<typeof absence>[]) =>
      uploadRayat(
        "so01",
        termId,
        table("so01", rows),
        { collegeId, actorId: head },
        database.db,
      );
    const first = await pending("so01", [absence("444100001")]);
    await applyRayat(first.importId, change(), database.db);
    const second = await byHead([absence("444100002")]);
    if (second.status !== "pending") throw new Error(second.status);
    await applyRayat(second.importId, change(), database.db);
    await byHead([absence("444100003")]);
    expect(
      (await listRayatImports(collegeId, termId, database.db))
        .filter(({ kind }) => kind === "so01")
        .map(({ status, uploadedBy, appliedBy }) => ({
          status,
          uploadedBy,
          appliedBy,
        })),
    ).toEqual([
      { status: "pending", uploadedBy: "head", appliedBy: null },
      { status: "applied", uploadedBy: "head", appliedBy: "viceDean" },
      { status: "applied", uploadedBy: "viceDean", appliedBy: null },
    ]);
  });

  it("refuses a file it cannot apply whole, saying why, and keeps nothing of it", async () => {
    const before = await imports();
    await expect(
      upload("sf01", [enrollment("1", { term: "الفصل التدريبي الثاني 1448" })]),
    ).resolves.toEqual({
      status: "otherTerm",
      term: "الفصل التدريبي الثاني 1448",
    });
    await expect(
      upload("sf01", [
        enrollment("1"),
        enrollment("2", { term: "الفصل التدريبي الثاني 1448" }),
      ]),
    ).resolves.toMatchObject({ status: "termsMixed" });
    await expect(
      uploadRayat(
        "sf01",
        termId,
        [rayatHeaders.sf01.filter((header) => header !== "حالة المتدرب")],
        change(),
        database.db,
      ),
    ).resolves.toEqual({ status: "missingColumns", missing: ["حالة المتدرب"] });
    await expect(
      upload("sf01", [
        enrollment("1"),
        enrollment("2", { department: "قسم التقنية الميكانيكية" }),
        enrollment("3", { department: "قسم المساحة" }),
        enrollment("1"),
      ]),
    ).resolves.toEqual({
      status: "invalid",
      total: 3,
      problems: [
        {
          line: 3,
          problem: "departmentInactive",
          value: "قسم التقنية الميكانيكية",
        },
        { line: 4, problem: "department", value: "قسم المساحة" },
        { line: 5, problem: "duplicate", first: 2 },
      ],
      headers: rayatColumns.sf01,
    });
    expect(await imports()).toBe(before);
  });

  it("refuses a term that is closed, and a report without its column map", async () => {
    await query("delete from settings where college_id = $1 and key = $2", [
      collegeId,
      "rayat.columns.so01",
    ]);
    await expect(
      upload("so01", [{ term: TERM, termCode: "14481" }]),
    ).resolves.toEqual({ status: "noColumnMap" });

    await activateTerm(termId, change(), database.db);
    await closeTerm(termId, change(), database.db);
    await expect(upload("sf01", [enrollment("9")])).resolves.toEqual({
      status: "termClosed",
    });
  });
});

describe("a trainee's name, mobile number and grade", () => {
  const NAME = "متدرب اختباري زائف";
  const MOBILE = "0599123456";
  const GRADE = "91.75";

  it("are in no column of the Rayat tables and in no row of the database", async () => {
    const open = await createTerm(
      { name: "الفصل التدريبي الثاني 1448", startsOn: "2027-01-10", weeks: 18 },
      change(),
      database.db,
    );
    if (open.status !== "created") throw new Error(open.status);
    const uploaded = await uploadRayat(
      "sf01",
      open.id,
      table(
        "sf01",
        [
          enrollment("444100001", { term: "الفصل التدريبي الثاني 1448" }),
          enrollment("444100002", { term: "الفصل التدريبي الثاني 1448" }),
        ],
        [
          { "إسم المتدرب": NAME, "رقم الجوال": MOBILE, الدرجة: GRADE },
          {
            "إسم المتدرب": `${NAME} 2`,
            "رقم الجوال": "0599654321",
            الدرجة: "88.5",
          },
        ],
      ),
      change(),
      database.db,
    );
    if (uploaded.status !== "pending") throw new Error(uploaded.status);
    await applyRayat(uploaded.importId, change(), database.db);

    const columns = await query(
      `select table_name, column_name from information_schema.columns
       where table_schema = 'public' and table_name like 'rayat%'`,
    );
    expect(
      columns.filter(({ column_name }) =>
        /name|mobile|phone|grade|mark/.test(column_name),
      ),
    ).toEqual([{ table_name: "rayat_sections", column_name: "course_name" }]);
    expect(
      columns
        .filter(({ table_name }) => table_name === "rayat_enrollments")
        .map(({ column_name }) => column_name)
        .sort(),
    ).toEqual([
      "college_id",
      "course_code",
      "department_id",
      "id",
      "import_id",
      "registration_status",
      "section_ref",
      "trainee_number",
      "trainee_status",
    ]);

    const tables = await query(
      "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'",
    );
    for (const { table_name } of tables) {
      const found = await query(
        `select count(*) from "${table_name}" t where t::text like any($1)`,
        [
          [NAME, MOBILE, GRADE, "0599654321", "88.5"].map(
            (text) => `%${text}%`,
          ),
        ],
      );
      expect({ table: table_name, rows: Number(found[0].count) }).toEqual({
        table: table_name,
        rows: 0,
      });
    }
  });
});

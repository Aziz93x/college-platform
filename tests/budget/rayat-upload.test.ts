import { afterAll, beforeAll, describe, expect, it } from "vitest";
import writeXlsxFile from "write-excel-file/node";
import { seedBase } from "../../db/seed/base.ts";
import { createAccount } from "../../src/modules/identity/index.ts";
import { createDepartment } from "../../src/modules/org/index.ts";
import { uploadRayat } from "../../src/modules/rayat/index.ts";
import { createTerm } from "../../src/modules/terms/index.ts";
import { readTable } from "../../src/platform/files/table.ts";
import { createTestDatabase } from "../integration/support/database.ts";
import { rayatTable } from "../integration/support/rayat-table.ts";

// ADR-0023's budget, measured with nothing else running: the budget project runs after the unit
// and integration tests, one file at a time (vitest.config.mts). Beside them, this test once took
// 5.5 s on CI's runner. Each run notes its time, which CI shows beside the run.
let database: Awaited<ReturnType<typeof createTestDatabase>>;
let collegeId: string;
let viceDean: string;
const TERM = "الفصل التدريبي الصيفي 1448";
const ELECTRICAL = "قسم التقنية الكهربائية";

const change = () => ({ collegeId, actorId: viceDean });

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
  await createDepartment(
    {
      name: "Electrical",
      shortName: "Electrical",
      rayatValues: [ELECTRICAL],
      active: true,
    },
    change(),
    database.db,
  );
});

afterAll(() => database?.drop());

describe("a college-sized upload (ADR-0023)", () => {
  it("reads, checks, diffs and keeps an SF01 of 25,000 rows from the file's bytes in under 5 s", async ({
    annotate,
  }) => {
    const created = await createTerm(
      { name: TERM, startsOn: "2027-06-13", weeks: 8 },
      change(),
      database.db,
    );
    if (created.status !== "created") throw new Error(created.status);
    const rows = Array.from({ length: 25_000 }, (_, at) => ({
      term: TERM,
      department: ELECTRICAL,
      courseCode: "كهر 101",
      sectionRef: String(40_001 + (at % 700)),
      traineeNumber: String(445_000_001 + at),
      registrationStatus: "مسجل",
      traineeStatus: "منتظم",
    }));
    // Every column Rayat exports, the trainees' names, mobile numbers and grades too.
    const table = rayatTable(
      "sf01",
      rows,
      rows.map((_, at) => ({
        "إسم المتدرب": `متدرب رقم ${at}`,
        "رقم الجوال": `05${String(10_000_000 + at)}`,
        الدرجة: String(60 + (at % 40)),
        "اسم المقرر": "الدوائر الكهربائية",
        المدرب: "مدرب القسم",
      })),
    );
    const bytes = await writeXlsxFile(
      table.map((row) => row.map((value) => ({ value }))),
    ).toBuffer();

    const started = performance.now();
    const read = await readTable({ name: "sf01.xlsx", bytes });
    if (!read) throw new Error("the workbook was not read");
    const uploaded = await uploadRayat(
      "sf01",
      created.id,
      read,
      change(),
      database.db,
    );
    const took = performance.now() - started;
    await annotate(
      `25,000 rows kept in ${Math.round(took)} ms, of a 5,000 ms budget`,
    );
    expect(uploaded).toMatchObject({ status: "pending", records: 25_000 });
    expect(took).toBeLessThan(5_000);
  }, 120_000);
});

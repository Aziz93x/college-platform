import { afterAll, beforeAll, expect, it } from "vitest";
import { seedBase } from "../../db/seed/base.ts";
import {
  createDepartment,
  type DepartmentInput,
  findDepartment,
  listDepartments,
  updateCollege,
  updateDepartment,
} from "../../src/modules/org/index.ts";
import { createTestDatabase } from "./support/database.ts";

let database: Awaited<ReturnType<typeof createTestDatabase>>;
let collegeId: string;
let otherCollegeId: string;
let actorId: string;

beforeAll(async () => {
  database = await createTestDatabase();
  collegeId = await seedBase(database.db, {
    name: "Test College",
    shortName: "TC",
  });
  const { rows } = await database.pool.query(
    "insert into colleges (name, short_name) values ('Other College', 'OC') returning id",
  );
  otherCollegeId = rows[0].id;
  const user = await database.pool.query(
    "insert into users (name, email) values ('Admin', 'admin@example.test') returning id",
  );
  actorId = user.rows[0].id;
});

afterAll(() => database?.drop());

const change = () => ({
  collegeId,
  actorId,
  ip: "203.0.113.7",
  userAgent: "test",
});

const department = (
  name: string,
  rayatValues: string[],
  overrides: Partial<DepartmentInput> = {},
): DepartmentInput => ({
  name,
  shortName: name.slice(0, 4),
  rayatValues,
  active: true,
  ...overrides,
});

const events = async (entityId: string) =>
  (
    await database.pool.query(
      `select action, actor_id, diff, ip from audit_events
       where entity_type = $1 and entity_id = $2 order by created_at`,
      [entityId === collegeId ? "college" : "department", entityId],
    )
  ).rows;

const count = async (table: string) =>
  Number(
    (await database.pool.query(`select count(*) from ${table}`)).rows[0].count,
  );

it("adds a department with its Rayat values and records department.create with what it was given", async () => {
  const result = await createDepartment(
    department("Electrical", ["Electrical Tech", "Electrical"]),
    change(),
    database.db,
  );
  if (result.status !== "created") throw new Error(result.status);

  await expect(
    findDepartment(collegeId, result.id, database.db),
  ).resolves.toEqual({
    id: result.id,
    name: "Electrical",
    shortName: "Elec",
    active: true,
    rayatValues: ["Electrical", "Electrical Tech"],
  });
  expect(await events(result.id)).toEqual([
    {
      action: "department.create",
      actor_id: actorId,
      diff: {
        to: {
          name: "Electrical",
          shortName: "Elec",
          active: true,
          rayatValues: ["Electrical", "Electrical Tech"],
        },
      },
      ip: "203.0.113.7",
    },
  ]);
});

it("refuses a name, a short name or a Rayat value another department of the college has, and writes nothing", async () => {
  const before = [
    await count("departments"),
    await count("department_rayat_values"),
    await count("audit_events"),
  ];

  await expect(
    createDepartment(
      department("Electrical", ["Other"]),
      change(),
      database.db,
    ),
  ).resolves.toEqual({ status: "nameTaken", department: "Electrical" });
  await expect(
    createDepartment(
      department("Electronics", ["Other"], { shortName: "Elec" }),
      change(),
      database.db,
    ),
  ).resolves.toEqual({ status: "shortNameTaken", department: "Electrical" });
  await expect(
    createDepartment(
      department("Mechanical", ["Mechanical", "Electrical Tech"]),
      change(),
      database.db,
    ),
  ).resolves.toEqual({
    status: "valueTaken",
    value: "Electrical Tech",
    department: "Electrical",
  });

  expect([
    await count("departments"),
    await count("department_rayat_values"),
    await count("audit_events"),
  ]).toEqual(before);
});

// An import matches a department by its name, its short name or a Rayat value, in any case of its
// Latin letters, so no text may name two departments (Audit 3).
it("refuses a text another department has in any of the three, in any Latin case, and writes nothing", async () => {
  const before = [
    await count("departments"),
    await count("department_rayat_values"),
    await count("audit_events"),
  ];

  await expect(
    createDepartment(
      department("ELEC", ["Other"], { shortName: "Other" }),
      change(),
      database.db,
    ),
  ).resolves.toEqual({ status: "nameTaken", department: "Electrical" });
  await expect(
    createDepartment(
      department("Electronics", ["Other"], { shortName: "electrical tech" }),
      change(),
      database.db,
    ),
  ).resolves.toEqual({ status: "shortNameTaken", department: "Electrical" });
  await expect(
    createDepartment(
      department("Mechanical", ["Mechanical", "ELECTRICAL"]),
      change(),
      database.db,
    ),
  ).resolves.toEqual({
    status: "valueTaken",
    value: "ELECTRICAL",
    department: "Electrical",
  });

  expect([
    await count("departments"),
    await count("department_rayat_values"),
    await count("audit_events"),
  ]).toEqual(before);
});

it("lets another college use the same names and values", async () => {
  const result = await createDepartment(
    department("Electrical", ["Electrical Tech"]),
    { ...change(), collegeId: otherCollegeId },
    database.db,
  );

  expect(result.status).toBe("created");
  expect(
    (await listDepartments(otherCollegeId, database.db)).map((d) => d.name),
  ).toEqual(["Electrical"]);
  expect(
    (await listDepartments(collegeId, database.db)).map((d) => d.name),
  ).toEqual(["Electrical"]);
});

it("saves the changed fields, replaces the Rayat values, and records only what changed", async () => {
  const created = await createDepartment(
    department("General", ["General Studies"]),
    change(),
    database.db,
  );
  if (created.status !== "created") throw new Error(created.status);

  await expect(
    updateDepartment(
      created.id,
      department("General", ["General", "General Studies"], { active: false }),
      change(),
      database.db,
    ),
  ).resolves.toEqual({ status: "saved" });

  await expect(
    findDepartment(collegeId, created.id, database.db),
  ).resolves.toMatchObject({
    name: "General",
    active: false,
    rayatValues: ["General", "General Studies"],
  });
  expect((await events(created.id)).at(-1)).toMatchObject({
    action: "department.update",
    diff: {
      from: { active: true, rayatValues: ["General Studies"] },
      to: { active: false, rayatValues: ["General", "General Studies"] },
    },
  });
});

it("writes nothing when the department is saved as it is, and keeps its own values its own", async () => {
  const [general] = (await listDepartments(collegeId, database.db)).filter(
    (d) => d.name === "General",
  );
  const before = await count("audit_events");

  await expect(
    updateDepartment(
      general.id,
      department("General", ["General Studies", "General"], { active: false }),
      change(),
      database.db,
    ),
  ).resolves.toEqual({ status: "unchanged" });
  expect(await count("audit_events")).toBe(before);
});

it("refuses another department's value, and a department of another college", async () => {
  const [general] = (await listDepartments(collegeId, database.db)).filter(
    (d) => d.name === "General",
  );
  const [otherElectrical] = await listDepartments(otherCollegeId, database.db);

  await expect(
    updateDepartment(
      general.id,
      department("General", ["General", "Electrical"], { active: false }),
      change(),
      database.db,
    ),
  ).resolves.toEqual({
    status: "valueTaken",
    value: "Electrical",
    department: "Electrical",
  });
  await expect(
    updateDepartment(
      otherElectrical.id,
      department("Renamed", ["Renamed"]),
      change(),
      database.db,
    ),
  ).resolves.toEqual({ status: "notFound" });
  await expect(
    findDepartment(collegeId, otherElectrical.id, database.db),
  ).resolves.toBeUndefined();
});

it("keeps one department per Rayat value in the college even without the check", async () => {
  const [general] = (await listDepartments(collegeId, database.db)).filter(
    (d) => d.name === "General",
  );

  await expect(
    database.pool.query(
      "insert into department_rayat_values (college_id, department_id, value) values ($1, $2, 'Electrical')",
      [collegeId, general.id],
    ),
  ).rejects.toThrow(/department_rayat_values_pkey/);
});

it("refuses a value that names one college and another college's department, even without the check", async () => {
  const [otherElectrical] = await listDepartments(otherCollegeId, database.db);

  await expect(
    database.pool.query(
      "insert into department_rayat_values (college_id, department_id, value) values ($1, $2, 'Elsewhere')",
      [collegeId, otherElectrical.id],
    ),
  ).rejects.toThrow(/department_rayat_values_department_fk/);
});

it("renames the college and records college.update with each changed name; the same names write nothing", async () => {
  await expect(
    updateCollege(
      { name: "Renamed College", shortName: "TC" },
      change(),
      database.db,
    ),
  ).resolves.toEqual({ status: "saved" });
  const before = await count("audit_events");
  await expect(
    updateCollege(
      { name: "Renamed College", shortName: "TC" },
      change(),
      database.db,
    ),
  ).resolves.toEqual({ status: "unchanged" });

  expect(await count("audit_events")).toBe(before);
  expect(
    (
      await database.pool.query(
        "select name, short_name from colleges where id = $1",
        [collegeId],
      )
    ).rows,
  ).toEqual([{ name: "Renamed College", short_name: "TC" }]);
  expect(await events(collegeId)).toEqual([
    {
      action: "college.update",
      actor_id: actorId,
      diff: { from: { name: "Test College" }, to: { name: "Renamed College" } },
      ip: "203.0.113.7",
    },
  ]);
});

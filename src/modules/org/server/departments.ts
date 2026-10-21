import { and, asc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { type Db, getDb, type Tx } from "../../../platform/db/client.ts";
import { writeAudit } from "../../audit/index.ts";
import type { CollegeInput, DepartmentInput } from "../domain/inputs.ts";
import { colleges, departmentRayatValues, departments } from "./schema.ts";

// Who changes the organization, for the audit event. The caller has authorized them.
type Change = {
  collegeId: string;
  actorId: string;
  ip?: string | null;
  userAgent?: string | null;
};

export type Department = {
  id: string;
  name: string;
  shortName: string;
  active: boolean;
  rayatValues: string[];
};

// What keeps a department from being saved as asked: another department of the college has its
// name, its short name or one of its Rayat values.
type Conflict =
  | { status: "nameTaken" }
  | { status: "shortNameTaken" }
  | { status: "valueTaken"; value: string; department: string };

const columns = {
  id: departments.id,
  name: departments.name,
  shortName: departments.shortName,
  active: departments.active,
};

async function withValues(
  rows: Omit<Department, "rayatValues">[],
  db: Db | Tx,
): Promise<Department[]> {
  if (rows.length === 0) return [];
  const values = await db
    .select({
      departmentId: departmentRayatValues.departmentId,
      value: departmentRayatValues.value,
    })
    .from(departmentRayatValues)
    .where(
      inArray(
        departmentRayatValues.departmentId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(asc(departmentRayatValues.value));
  return rows.map((row) => ({
    ...row,
    rayatValues: values
      .filter((value) => value.departmentId === row.id)
      .map((value) => value.value),
  }));
}

// The college's departments, active or not, by name.
export async function listDepartments(collegeId: string, db: Db = getDb()) {
  const rows = await db
    .select(columns)
    .from(departments)
    .where(eq(departments.collegeId, collegeId))
    .orderBy(asc(departments.name));
  return withValues(rows, db);
}

// One department of the college; undefined for an id that is not one of the college's.
export async function findDepartment(
  collegeId: string,
  id: string,
  db: Db | Tx = getDb(),
) {
  const rows = await db
    .select(columns)
    .from(departments)
    .where(and(eq(departments.collegeId, collegeId), eq(departments.id, id)));
  return (await withValues(rows, db))[0];
}

// One change to the college's departments at a time, so two admins cannot both take the same
// name or Rayat value between the check and the write.
async function lockCollege(tx: Tx, collegeId: string) {
  await tx
    .select({ id: colleges.id })
    .from(colleges)
    .where(eq(colleges.id, collegeId))
    .for("update");
}

async function findConflict(
  tx: Tx,
  collegeId: string,
  input: DepartmentInput,
  except?: string,
): Promise<Conflict | undefined> {
  const others = except
    ? and(eq(departments.collegeId, collegeId), ne(departments.id, except))
    : eq(departments.collegeId, collegeId);
  const [named] = await tx
    .select({ name: departments.name, shortName: departments.shortName })
    .from(departments)
    .where(
      and(
        others,
        or(
          eq(departments.name, input.name),
          eq(departments.shortName, input.shortName),
        ),
      ),
    )
    .limit(1);
  if (named) {
    return named.name === input.name
      ? { status: "nameTaken" }
      : { status: "shortNameTaken" };
  }
  const [taken] = await tx
    .select({
      value: departmentRayatValues.value,
      department: departments.name,
    })
    .from(departmentRayatValues)
    .innerJoin(
      departments,
      eq(departments.id, departmentRayatValues.departmentId),
    )
    .where(and(others, inArray(departmentRayatValues.value, input.rayatValues)))
    .orderBy(asc(departmentRayatValues.value))
    .limit(1);
  return taken ? { status: "valueTaken", ...taken } : undefined;
}

// Adds a department and records it as department.create with what it was given.
export async function createDepartment(
  input: DepartmentInput,
  change: Change,
  db: Db = getDb(),
): Promise<Conflict | { status: "created"; id: string }> {
  return db.transaction(async (tx) => {
    await lockCollege(tx, change.collegeId);
    const conflict = await findConflict(tx, change.collegeId, input);
    if (conflict) return conflict;
    const [{ id }] = await tx
      .insert(departments)
      .values({
        collegeId: change.collegeId,
        name: input.name,
        shortName: input.shortName,
        active: input.active,
      })
      .returning({ id: departments.id });
    await tx.insert(departmentRayatValues).values(
      input.rayatValues.map((value) => ({
        collegeId: change.collegeId,
        departmentId: id,
        value,
      })),
    );
    await writeAudit(
      {
        collegeId: change.collegeId,
        actorId: change.actorId,
        action: "department.create",
        entityType: "department",
        entityId: id,
        diff: { to: { ...input, rayatValues: [...input.rayatValues].sort() } },
        ip: change.ip,
        userAgent: change.userAgent,
      },
      tx,
    );
    return { status: "created", id };
  });
}

// Saves a department as given and records department.update with each changed field before and
// after. Nothing changed, nothing is written.
export async function updateDepartment(
  id: string,
  input: DepartmentInput,
  change: Change,
  db: Db = getDb(),
): Promise<Conflict | { status: "saved" | "unchanged" | "notFound" }> {
  return db.transaction(async (tx) => {
    await lockCollege(tx, change.collegeId);
    const current = await findDepartment(change.collegeId, id, tx);
    if (!current) return { status: "notFound" };
    const conflict = await findConflict(tx, change.collegeId, input, id);
    if (conflict) return conflict;

    const next = { ...input, rayatValues: [...input.rayatValues].sort() };
    const from: Record<string, unknown> = {};
    const to: Record<string, unknown> = {};
    for (const key of ["name", "shortName", "active", "rayatValues"] as const) {
      if (JSON.stringify(current[key]) !== JSON.stringify(next[key])) {
        from[key] = current[key];
        to[key] = next[key];
      }
    }
    if (Object.keys(to).length === 0) return { status: "unchanged" };

    await tx
      .update(departments)
      .set({
        name: next.name,
        shortName: next.shortName,
        active: next.active,
        updatedAt: sql`now()`,
      })
      .where(eq(departments.id, id));
    if ("rayatValues" in to) {
      await tx
        .delete(departmentRayatValues)
        .where(eq(departmentRayatValues.departmentId, id));
      await tx.insert(departmentRayatValues).values(
        next.rayatValues.map((value) => ({
          collegeId: change.collegeId,
          departmentId: id,
          value,
        })),
      );
    }
    await writeAudit(
      {
        collegeId: change.collegeId,
        actorId: change.actorId,
        action: "department.update",
        entityType: "department",
        entityId: id,
        diff: { from, to },
        ip: change.ip,
        userAgent: change.userAgent,
      },
      tx,
    );
    return { status: "saved" };
  });
}

// Saves the college's name and short name and records college.update with each changed one before
// and after. Nothing changed, nothing is written.
export async function updateCollege(
  input: CollegeInput,
  change: Change,
  db: Db = getDb(),
): Promise<{ status: "saved" | "unchanged" | "notFound" }> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ name: colleges.name, shortName: colleges.shortName })
      .from(colleges)
      .where(eq(colleges.id, change.collegeId))
      .for("update");
    if (!current) return { status: "notFound" };
    const from: Record<string, string> = {};
    const to: Record<string, string> = {};
    for (const key of ["name", "shortName"] as const) {
      if (current[key] !== input[key]) {
        from[key] = current[key];
        to[key] = input[key];
      }
    }
    if (Object.keys(to).length === 0) return { status: "unchanged" };
    await tx
      .update(colleges)
      .set({ ...input, updatedAt: sql`now()` })
      .where(eq(colleges.id, change.collegeId));
    await writeAudit(
      {
        collegeId: change.collegeId,
        actorId: change.actorId,
        action: "college.update",
        entityType: "college",
        entityId: change.collegeId,
        diff: { from, to },
        ip: change.ip,
        userAgent: change.userAgent,
      },
      tx,
    );
    return { status: "saved" };
  });
}

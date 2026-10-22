import { and, asc, desc, eq, sql } from "drizzle-orm";
import { type Db, getDb, type Tx } from "../../../platform/db/client.ts";
import { lockCollege } from "../../../platform/db/college-lock.ts";
import { writeAudit } from "../../audit/index.ts";
import { users } from "../../identity/index.ts";
import { listDepartments } from "../../org/index.ts";
import { settings, settingsRegistry } from "../../settings/index.ts";
import { terms } from "../../terms/index.ts";
import {
  checkRayatRows,
  type RayatRecords,
  type RowProblem,
} from "../domain/check.ts";
import { diffRecords, type RayatDiff } from "../domain/diff.ts";
import { readRayatFile } from "../domain/read.ts";
import type { RayatField, RayatKind } from "../domain/reports.ts";
import {
  type RayatImportStatus,
  rayatAbsences,
  rayatEnrollments,
  rayatImports,
  rayatSections,
} from "./schema.ts";

// Who imports, for the audit events. The caller has authorized them for rayat.import.
type Change = {
  collegeId: string;
  actorId: string;
  ip?: string | null;
  userAgent?: string | null;
};

// The most problems an upload's report lists; it counts them all. A guard on the page's length, not
// a policy anyone sets.
export const REPORTED_PROBLEMS = 100;

// Records written per insert, well under PostgreSQL's limit on a statement's parameters.
const INSERT_CHUNK = 1000;

// What an upload comes to: refused for the term, the column map, the file or its rows, with what
// to tell the uploader; the same records as the version in force; or a new import waiting to be
// applied, with its diff. Fields are named by the headers of the college's column map.
export type RayatUpload =
  | {
      status:
        | "termNotFound"
        | "termClosed"
        | "noColumnMap"
        | "empty"
        | "unchanged";
    }
  | { status: "missingColumns"; missing: string[] }
  | { status: "termsMixed"; terms: string[] }
  | { status: "otherTerm"; term: string }
  | { status: "termCodesMixed"; codes: string[] }
  | {
      status: "invalid";
      problems: RowProblem[];
      total: number;
      headers: Record<string, string>;
    }
  | {
      status: "pending";
      importId: string;
      diff: RayatDiff;
      rows: number;
      records: number;
    };

// The columns each kind's records are read back with, the fields of its records.
const recordColumns = {
  ss01: {
    departmentId: rayatSections.departmentId,
    courseCode: rayatSections.courseCode,
    courseName: rayatSections.courseName,
    creditHours: rayatSections.creditHours,
    sectionRef: rayatSections.sectionRef,
    deliveryMode: rayatSections.deliveryMode,
    capacity: rayatSections.capacity,
    enrolled: rayatSections.enrolled,
    meetings: rayatSections.meetings,
    trainerNumbers: rayatSections.trainerNumbers,
  },
  sf01: {
    departmentId: rayatEnrollments.departmentId,
    courseCode: rayatEnrollments.courseCode,
    sectionRef: rayatEnrollments.sectionRef,
    traineeNumber: rayatEnrollments.traineeNumber,
    registrationStatus: rayatEnrollments.registrationStatus,
    traineeStatus: rayatEnrollments.traineeStatus,
  },
  so01: {
    departmentId: rayatAbsences.departmentId,
    subjectCode: rayatAbsences.subjectCode,
    courseNumber: rayatAbsences.courseNumber,
    traineeNumber: rayatAbsences.traineeNumber,
    courseStatus: rayatAbsences.courseStatus,
    absencePercent: rayatAbsences.absencePercent,
    absenceHours: rayatAbsences.absenceHours,
  },
};

async function recordsOf<K extends RayatKind>(
  db: Db | Tx,
  kind: K,
  importId: string,
): Promise<RayatRecords[K][]> {
  switch (kind) {
    case "ss01":
      return (await db
        .select(recordColumns.ss01)
        .from(rayatSections)
        .where(eq(rayatSections.importId, importId))
        .orderBy(asc(rayatSections.id))) as RayatRecords[K][];
    case "sf01":
      return (await db
        .select(recordColumns.sf01)
        .from(rayatEnrollments)
        .where(eq(rayatEnrollments.importId, importId))
        .orderBy(asc(rayatEnrollments.id))) as RayatRecords[K][];
    default:
      return (await db
        .select(recordColumns.so01)
        .from(rayatAbsences)
        .where(eq(rayatAbsences.importId, importId))
        .orderBy(asc(rayatAbsences.id))) as RayatRecords[K][];
  }
}

async function insertRecords(
  tx: Tx,
  kind: RayatKind,
  owner: { collegeId: string; importId: string },
  records: readonly RayatRecords[RayatKind][],
) {
  const table = {
    ss01: rayatSections,
    sf01: rayatEnrollments,
    so01: rayatAbsences,
  }[kind];
  for (let at = 0; at < records.length; at += INSERT_CHUNK) {
    await tx
      .insert(table)
      .values(
        records
          .slice(at, at + INSERT_CHUNK)
          .map((record) => ({ ...record, ...owner })) as never,
      );
  }
}

// The version of a term's report in force: its import applied last and not rolled back.
async function currentImport(
  db: Db | Tx,
  collegeId: string,
  termId: string,
  kind: RayatKind,
) {
  const [current] = await db
    .select({ id: rayatImports.id })
    .from(rayatImports)
    .where(
      and(
        eq(rayatImports.collegeId, collegeId),
        eq(rayatImports.termId, termId),
        eq(rayatImports.kind, kind),
        eq(rayatImports.status, "applied"),
      ),
    )
    .orderBy(desc(rayatImports.appliedAt), desc(rayatImports.id))
    .limit(1);
  return current;
}

// The records of the version of a term's report in force; none before its first import is applied.
export async function currentRayatRecords<K extends RayatKind>(
  collegeId: string,
  termId: string,
  kind: K,
  db: Db = getDb(),
) {
  const current = await currentImport(db, collegeId, termId, kind);
  return current ? recordsOf(db, kind, current.id) : [];
}

// The column map that reads a kind of report, and its version; undefined while none is stored.
async function columnMap(tx: Tx, collegeId: string, kind: RayatKind) {
  const key = `rayat.columns.${kind}` as const;
  const [row] = await tx
    .select({ value: settings.value, version: settings.version })
    .from(settings)
    .where(and(eq(settings.collegeId, collegeId), eq(settings.key, key)));
  const parsed = row && settingsRegistry[key].schema.safeParse(row.value);
  return parsed?.success && parsed.data
    ? {
        columns: parsed.data as Record<string, string>,
        version: row.version,
      }
    : undefined;
}

// A report's rows read with the college's column map, checked, and diffed against the term's
// version in force; kept as an import waiting to be applied, which replaces any upload of the same
// report still waiting. Nothing is kept of a file refused, or of one with the same records as the
// version in force, and nothing of any file but the records (docs/PLAN.md, Step 16).
export async function uploadRayat(
  kind: RayatKind,
  termId: string,
  table: readonly (readonly string[])[],
  change: Change,
  db: Db = getDb(),
): Promise<RayatUpload> {
  const { collegeId } = change;
  return db.transaction(async (tx) => {
    await lockCollege(tx, collegeId);
    const [term] = await tx
      .select({ name: terms.name, status: terms.status })
      .from(terms)
      .where(and(eq(terms.collegeId, collegeId), eq(terms.id, termId)));
    if (!term) return { status: "termNotFound" };
    if (term.status === "closed") return { status: "termClosed" };
    const map = await columnMap(tx, collegeId, kind);
    if (!map) return { status: "noColumnMap" };

    // Each kind's own fields: the map passed its kind's schema.
    const read = readRayatFile(
      kind,
      table,
      map.columns as Record<RayatField, string>,
    );
    if (read.status === "empty") return read;
    if (read.status === "missingColumns") {
      return {
        status: "missingColumns",
        missing: read.missing.map((field) => map.columns[field]),
      };
    }
    const check = checkRayatRows(kind, read.rows, {
      term: term.name,
      departments: await listDepartments(collegeId, tx),
    });
    if (check.status === "invalid") {
      return {
        status: "invalid",
        problems: check.problems.slice(0, REPORTED_PROBLEMS),
        total: check.problems.length,
        headers: map.columns,
      };
    }
    if (check.status !== "valid") return check;

    const base = await currentImport(tx, collegeId, termId, kind);
    const diff = diffRecords(
      kind,
      base ? await recordsOf(tx, kind, base.id) : [],
      check.records,
    );
    if (diff.added + diff.removed + diff.changed === 0) {
      return { status: "unchanged" };
    }
    await tx
      .delete(rayatImports)
      .where(
        and(
          eq(rayatImports.collegeId, collegeId),
          eq(rayatImports.termId, termId),
          eq(rayatImports.kind, kind),
          eq(rayatImports.status, "pending"),
        ),
      );
    const [created] = await tx
      .insert(rayatImports)
      .values({
        collegeId,
        termId,
        kind,
        mappingVersion: map.version,
        rowCount: read.rows.length,
        recordCount: check.records.length,
        diff,
        uploadedBy: change.actorId,
      })
      .returning({ id: rayatImports.id });
    await insertRecords(
      tx,
      kind,
      { collegeId, importId: created.id },
      check.records,
    );
    await writeAudit(
      {
        ...event(change, "rayatImport.upload", created.id),
        diff: {
          termId,
          report: kind,
          records: check.records.length,
          added: diff.added,
          removed: diff.removed,
          changed: diff.changed,
        },
      },
      tx,
    );
    return {
      status: "pending",
      importId: created.id,
      diff,
      rows: read.rows.length,
      records: check.records.length,
    };
  });
}

function event(
  change: Change,
  action:
    | "rayatImport.upload"
    | "rayatImport.apply"
    | "rayatImport.rollback"
    | "rayatImport.discard",
  importId: string,
) {
  return {
    collegeId: change.collegeId,
    actorId: change.actorId,
    action,
    entityType: "rayatImport" as const,
    entityId: importId,
    ip: change.ip,
    userAgent: change.userAgent,
  };
}

// An import of the college with its term's status, read under the college's lock.
async function importOf(tx: Tx, collegeId: string, importId: string) {
  const [found] = await tx
    .select({
      termId: rayatImports.termId,
      kind: rayatImports.kind,
      status: rayatImports.status,
      termStatus: terms.status,
    })
    .from(rayatImports)
    .innerJoin(
      terms,
      and(
        eq(terms.collegeId, rayatImports.collegeId),
        eq(terms.id, rayatImports.termId),
      ),
    )
    .where(
      and(eq(rayatImports.collegeId, collegeId), eq(rayatImports.id, importId)),
    );
  return found;
}

// Makes an upload waiting to be applied the term's version of its report, in one transaction.
export async function applyRayat(
  importId: string,
  change: Change,
  db: Db = getDb(),
): Promise<{ status: "applied" | "notPending" | "termClosed" }> {
  return db.transaction(async (tx) => {
    await lockCollege(tx, change.collegeId);
    const found = await importOf(tx, change.collegeId, importId);
    if (found?.status !== "pending") return { status: "notPending" };
    if (found.termStatus === "closed") return { status: "termClosed" };
    await tx
      .update(rayatImports)
      .set({
        status: "applied",
        appliedBy: change.actorId,
        appliedAt: sql`now()`,
      })
      .where(eq(rayatImports.id, importId));
    await writeAudit(
      {
        ...event(change, "rayatImport.apply", importId),
        diff: { termId: found.termId, report: found.kind },
      },
      tx,
    );
    return { status: "applied" };
  });
}

// Rolls back the term's version of a report in force, so the one applied before it is in force
// again, or none after the first. An upload waiting to be applied goes too: its diff was taken
// against the version rolled back.
export async function rollbackRayat(
  importId: string,
  change: Change,
  db: Db = getDb(),
): Promise<{ status: "rolledBack" | "notCurrent" | "termClosed" }> {
  return db.transaction(async (tx) => {
    await lockCollege(tx, change.collegeId);
    const found = await importOf(tx, change.collegeId, importId);
    if (!found) return { status: "notCurrent" };
    if (found.termStatus === "closed") return { status: "termClosed" };
    const current = await currentImport(
      tx,
      change.collegeId,
      found.termId,
      found.kind,
    );
    if (current?.id !== importId) return { status: "notCurrent" };
    await tx
      .update(rayatImports)
      .set({
        status: "rolledBack",
        rolledBackBy: change.actorId,
        rolledBackAt: sql`now()`,
      })
      .where(eq(rayatImports.id, importId));
    await tx
      .delete(rayatImports)
      .where(
        and(
          eq(rayatImports.collegeId, change.collegeId),
          eq(rayatImports.termId, found.termId),
          eq(rayatImports.kind, found.kind),
          eq(rayatImports.status, "pending"),
        ),
      );
    await writeAudit(
      {
        ...event(change, "rayatImport.rollback", importId),
        diff: { termId: found.termId, report: found.kind },
      },
      tx,
    );
    return { status: "rolledBack" };
  });
}

// Drops an upload waiting to be applied, with its records.
export async function discardRayat(
  importId: string,
  change: Change,
  db: Db = getDb(),
): Promise<{ status: "discarded" | "notPending" }> {
  return db.transaction(async (tx) => {
    await lockCollege(tx, change.collegeId);
    const found = await importOf(tx, change.collegeId, importId);
    if (found?.status !== "pending") return { status: "notPending" };
    await tx.delete(rayatImports).where(eq(rayatImports.id, importId));
    await writeAudit(
      {
        ...event(change, "rayatImport.discard", importId),
        diff: { termId: found.termId, report: found.kind },
      },
      tx,
    );
    return { status: "discarded" };
  });
}

export type RayatImport = {
  id: string;
  kind: RayatKind;
  status: RayatImportStatus;
  // The version in force of its report: the import applied last and not rolled back.
  current: boolean;
  rows: number;
  records: number;
  diff: RayatDiff;
  uploadedAt: Date;
  uploadedBy: string | null;
  appliedAt: Date | null;
  rolledBackAt: Date | null;
};

// A term's imports, newest first: those waiting to be applied, applied, and rolled back.
export async function listRayatImports(
  collegeId: string,
  termId: string,
  db: Db = getDb(),
): Promise<RayatImport[]> {
  const rows = await db
    .select({
      id: rayatImports.id,
      kind: rayatImports.kind,
      status: rayatImports.status,
      rows: rayatImports.rowCount,
      records: rayatImports.recordCount,
      diff: rayatImports.diff,
      uploadedAt: rayatImports.uploadedAt,
      uploadedBy: users.name,
      appliedAt: rayatImports.appliedAt,
      rolledBackAt: rayatImports.rolledBackAt,
    })
    .from(rayatImports)
    .leftJoin(users, eq(users.id, rayatImports.uploadedBy))
    .where(
      and(
        eq(rayatImports.collegeId, collegeId),
        eq(rayatImports.termId, termId),
      ),
    )
    .orderBy(desc(rayatImports.uploadedAt), desc(rayatImports.id));
  const current = new Map<RayatKind, string>();
  for (const row of [...rows].sort(
    (a, b) => (b.appliedAt?.getTime() ?? 0) - (a.appliedAt?.getTime() ?? 0),
  )) {
    if (row.status === "applied" && !current.has(row.kind)) {
      current.set(row.kind, row.id);
    }
  }
  return rows.map((row) => ({
    ...row,
    current: current.get(row.kind) === row.id,
  }));
}

import { and, asc, eq } from "drizzle-orm";
import { cache } from "react";
import { type Db, getDb } from "../../../platform/db/client.ts";
import { writeAudit } from "../../audit/index.ts";
import { users } from "../../identity/index.ts";
import {
  type Catalog,
  checkText,
  flatten,
  type TextProblem,
} from "../domain/catalog.ts";
import { textOverrides } from "./schema.ts";

// Who changes a message, for the audit event (ADR-0029).
type Change = {
  collegeId: string;
  actorId: string;
  ip?: string | null;
  userAgent?: string | null;
};

// The college's wording, as the request's messages lay it over the catalog: read once per request,
// as the settings are (src/i18n/request.ts).
export const collegeTexts = cache(async (collegeId: string, db: Db = getDb()) =>
  db
    .select({ key: textOverrides.key, value: textOverrides.value })
    .from(textOverrides)
    .where(eq(textOverrides.collegeId, collegeId)),
);

// The college's changed messages with who changed each and when, for the texts page.
export async function listTexts(collegeId: string, db: Db = getDb()) {
  return db
    .select({
      key: textOverrides.key,
      value: textOverrides.value,
      updatedAt: textOverrides.updatedAt,
      updatedBy: users.name,
    })
    .from(textOverrides)
    .leftJoin(users, eq(users.id, textOverrides.updatedBy))
    .where(eq(textOverrides.collegeId, collegeId))
    .orderBy(asc(textOverrides.key));
}

// Words a message of the catalog in the college's own way, and records text.override with the
// wording before and after. Refused for a key the catalog lacks, or for wording the message's code
// could not show (checkText); the default's own words take the change back.
export async function setText(
  key: string,
  value: string,
  catalog: Catalog,
  change: Change,
  db: Db = getDb(),
): Promise<
  { status: "saved" | "unchanged" | "unknownKey" } | { status: TextProblem }
> {
  const original = flatten(catalog).find((text) => text.key === key)?.value;
  if (original === undefined) return { status: "unknownKey" };
  const problem = checkText(value, original);
  if (problem) return { status: problem };
  if (value === original) return resetText(key, change, db);
  return db.transaction(async (tx) => {
    const where = and(
      eq(textOverrides.collegeId, change.collegeId),
      eq(textOverrides.key, key),
    );
    const [current] = await tx
      .select({ value: textOverrides.value })
      .from(textOverrides)
      .where(where)
      .for("update");
    if (current?.value === value) return { status: "unchanged" };
    await tx
      .insert(textOverrides)
      .values({
        collegeId: change.collegeId,
        key,
        value,
        updatedBy: change.actorId,
      })
      .onConflictDoUpdate({
        target: [textOverrides.collegeId, textOverrides.key],
        set: { value, updatedBy: change.actorId, updatedAt: new Date() },
      });
    await writeAudit(
      {
        collegeId: change.collegeId,
        actorId: change.actorId,
        action: "text.override",
        entityType: "text",
        entityId: key,
        diff: { from: current?.value ?? original, to: value },
        ip: change.ip,
        userAgent: change.userAgent,
      },
      tx,
    );
    return { status: "saved" };
  });
}

// Puts a message's default back, and records text.reset with the college's wording it removed.
export async function resetText(
  key: string,
  change: Change,
  db: Db = getDb(),
): Promise<{ status: "saved" | "unchanged" }> {
  return db.transaction(async (tx) => {
    const [removed] = await tx
      .delete(textOverrides)
      .where(
        and(
          eq(textOverrides.collegeId, change.collegeId),
          eq(textOverrides.key, key),
        ),
      )
      .returning({ value: textOverrides.value });
    if (!removed) return { status: "unchanged" };
    await writeAudit(
      {
        collegeId: change.collegeId,
        actorId: change.actorId,
        action: "text.reset",
        entityType: "text",
        entityId: key,
        diff: { from: removed.value },
        ip: change.ip,
        userAgent: change.userAgent,
      },
      tx,
    );
    return { status: "saved" };
  });
}

import { and, asc, eq, sql } from "drizzle-orm";
import { type Db, getDb } from "../../../platform/db/client.ts";
import { writeAudit } from "../../audit/index.ts";
import type { AxisInput } from "../domain/inputs.ts";
import { axes, axisGroups } from "./schema.ts";

// The catalog a seed gives a college: its groups in order, each with its axes in order.
export type AxisCatalog = {
  code: string;
  title: string;
  axes: { code: string; title: string; description?: string }[];
}[];

// The college's axis groups in order, each with its axes in order.
export async function listAxes(collegeId: string, db: Db = getDb()) {
  const [groups, rows] = await Promise.all([
    db
      .select({
        id: axisGroups.id,
        code: axisGroups.code,
        title: axisGroups.title,
      })
      .from(axisGroups)
      .where(eq(axisGroups.collegeId, collegeId))
      .orderBy(asc(axisGroups.position)),
    db
      .select({
        id: axes.id,
        groupId: axes.groupId,
        code: axes.code,
        title: axes.title,
        description: axes.description,
      })
      .from(axes)
      .where(eq(axes.collegeId, collegeId))
      .orderBy(asc(axes.position)),
  ]);
  return groups.map((group) => ({
    ...group,
    axes: rows.filter((axis) => axis.groupId === group.id),
  }));
}

// Adds the groups and axes of the catalog the college does not have yet, by their codes, in the
// catalog's order. Those it has stay as the admin left them.
export async function seedAxes(
  collegeId: string,
  catalog: AxisCatalog,
  db: Db = getDb(),
) {
  await db.transaction(async (tx) => {
    let position = 0;
    for (const [index, group] of catalog.entries()) {
      await tx
        .insert(axisGroups)
        .values({
          collegeId,
          code: group.code,
          title: group.title,
          position: index,
        })
        .onConflictDoNothing();
      const [{ id: groupId }] = await tx
        .select({ id: axisGroups.id })
        .from(axisGroups)
        .where(
          and(
            eq(axisGroups.collegeId, collegeId),
            eq(axisGroups.code, group.code),
          ),
        );
      for (const axis of group.axes) {
        await tx
          .insert(axes)
          .values({ collegeId, groupId, ...axis, position: position++ })
          .onConflictDoNothing();
      }
    }
  });
}

// Corrects an axis's title and description, and records axis.update with both before and after.
export async function updateAxis(
  id: string,
  input: AxisInput,
  change: {
    collegeId: string;
    actorId: string;
    ip?: string | null;
    userAgent?: string | null;
  },
  db: Db = getDb(),
): Promise<{ status: "notFound" | "unchanged" | "saved" }> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ title: axes.title, description: axes.description })
      .from(axes)
      .where(and(eq(axes.collegeId, change.collegeId), eq(axes.id, id)))
      .for("update");
    if (!current) return { status: "notFound" };
    if (
      current.title === input.title &&
      current.description === input.description
    ) {
      return { status: "unchanged" };
    }
    await tx
      .update(axes)
      .set({ ...input, updatedAt: sql`now()` })
      .where(eq(axes.id, id));
    await writeAudit(
      {
        collegeId: change.collegeId,
        actorId: change.actorId,
        action: "axis.update",
        entityType: "axis",
        entityId: id,
        diff: { from: current, to: input },
        ip: change.ip,
        userAgent: change.userAgent,
      },
      tx,
    );
    return { status: "saved" };
  });
}

import { and, asc, eq, inArray, isNull, max, ne, or, sql } from "drizzle-orm";
import { type Db, getDb, type Tx } from "../../../platform/db/client.ts";
import { lockCollege } from "../../../platform/db/college-lock.ts";
import { canonical } from "../../../platform/validation/text.ts";
import { roles } from "../../access/index.ts";
import { type AuditAction, writeAudit } from "../../audit/index.ts";
import { axes } from "../../axes/index.ts";
import type {
  AssignmentItemInput,
  AssignmentTemplateInput,
  EvidencePolicy,
  TaskKind,
} from "../../framework/index.ts";
import { departments } from "../../org/index.ts";
import { getSetting } from "../../settings/index.ts";
import { terms } from "../../terms/index.ts";
import {
  assignments,
  assignmentTemplateItems,
  assignmentTemplates,
} from "./schema.ts";

// Who changes a department's templates, for the audit event. The caller has authorized them in the
// template's department.
export type Change = {
  collegeId: string;
  actorId: string;
  ip?: string | null;
  userAgent?: string | null;
};

// A template the base seed gives every college, by its key: its title, the code of the axis its
// tasks go under, the key of the role it grants, if any, the evidence its items ask for, whose
// types are those the college accepts, and its items in order.
export type TemplateCatalog = {
  key: string;
  title: string;
  axis: string;
  grants?: string;
  evidence: Omit<EvidencePolicy, "types">;
  items: { title: string; kind: TaskKind }[];
}[];

// Adds the catalog's templates the college does not have yet, by their keys, shared by every
// department, each with its items. Those it has stay as they are.
export async function seedAssignmentTemplates(
  collegeId: string,
  catalog: TemplateCatalog,
  db: Db = getDb(),
) {
  // Before the transaction, which holds its connection (lead review B).
  const types = await getSetting("files.acceptedTypes", { collegeId }, db);
  await db.transaction(async (tx) => {
    for (const template of catalog) {
      const [axis] = await tx
        .select({ id: axes.id })
        .from(axes)
        .where(
          and(eq(axes.collegeId, collegeId), eq(axes.code, template.axis)),
        );
      if (!axis) {
        throw new Error(
          `seedAssignmentTemplates: no axis ${template.axis} in college ${collegeId}`,
        );
      }
      const [role] = template.grants
        ? await tx
            .select({ id: roles.id })
            .from(roles)
            .where(
              and(
                eq(roles.collegeId, collegeId),
                eq(roles.key, template.grants),
              ),
            )
        : [];
      const [added] = await tx
        .insert(assignmentTemplates)
        .values({
          collegeId,
          key: template.key,
          title: template.title,
          axisId: axis.id,
          grantsRoleId: role?.id ?? null,
        })
        .onConflictDoNothing()
        .returning({ id: assignmentTemplates.id });
      if (!added) continue;
      await tx.insert(assignmentTemplateItems).values(
        template.items.map((item, position) => ({
          ...item,
          collegeId,
          templateId: added.id,
          position,
          evidence: { ...template.evidence, types },
        })),
      );
    }
  });
}

const audit = (
  tx: Tx,
  change: Change,
  action: AuditAction,
  templateId: string,
  diff: Record<string, unknown>,
) =>
  writeAudit(
    {
      collegeId: change.collegeId,
      actorId: change.actorId,
      action,
      entityType: "assignmentTemplate",
      entityId: templateId,
      diff,
      ip: change.ip,
      userAgent: change.userAgent,
    },
    tx,
  );

const itemColumns = {
  id: assignmentTemplateItems.id,
  templateId: assignmentTemplateItems.templateId,
  title: assignmentTemplateItems.title,
  kind: assignmentTemplateItems.kind,
  evidence: assignmentTemplateItems.evidence,
};

// The templates a department assigns, those every department shares and then its own, each with
// the axis its tasks go under, the role it grants, if any, whether a term has it assigned, and its
// items in order.
export async function departmentTemplates(
  collegeId: string,
  departmentId: string,
  db: Db = getDb(),
) {
  const templates = await db
    .select({
      id: assignmentTemplates.id,
      departmentId: assignmentTemplates.departmentId,
      title: assignmentTemplates.title,
      axisId: assignmentTemplates.axisId,
      grantsRoleId: assignmentTemplates.grantsRoleId,
      assigned: sql<boolean>`exists (select 1 from ${assignments} where ${assignments.templateId} = ${assignmentTemplates.id})`,
    })
    .from(assignmentTemplates)
    .where(
      and(
        eq(assignmentTemplates.collegeId, collegeId),
        or(
          isNull(assignmentTemplates.departmentId),
          eq(assignmentTemplates.departmentId, departmentId),
        ),
      ),
    )
    .orderBy(
      sql`${assignmentTemplates.departmentId} is not null`,
      asc(assignmentTemplates.id),
    );
  const items =
    templates.length > 0
      ? await db
          .select(itemColumns)
          .from(assignmentTemplateItems)
          .where(
            inArray(
              assignmentTemplateItems.templateId,
              templates.map(({ id }) => id),
            ),
          )
          .orderBy(asc(assignmentTemplateItems.position))
      : [];
  return templates.map((template) => ({
    ...template,
    items: items.filter(({ templateId }) => templateId === template.id),
  }));
}

// A template of the college, with the department that owns it: none for one every department
// shares.
export async function findTemplate(
  collegeId: string,
  id: string,
  db: Db = getDb(),
) {
  const [template] = await db
    .select({
      id: assignmentTemplates.id,
      departmentId: assignmentTemplates.departmentId,
    })
    .from(assignmentTemplates)
    .where(
      and(
        eq(assignmentTemplates.collegeId, collegeId),
        eq(assignmentTemplates.id, id),
      ),
    );
  return template;
}

// An item of a template of the college, with its template's department.
export async function findTemplateItem(
  collegeId: string,
  id: string,
  db: Db = getDb(),
) {
  const [item] = await db
    .select({
      id: assignmentTemplateItems.id,
      templateId: assignmentTemplateItems.templateId,
      departmentId: assignmentTemplates.departmentId,
    })
    .from(assignmentTemplateItems)
    .innerJoin(
      assignmentTemplates,
      eq(assignmentTemplates.id, assignmentTemplateItems.templateId),
    )
    .where(
      and(
        eq(assignmentTemplateItems.collegeId, collegeId),
        eq(assignmentTemplateItems.id, id),
      ),
    );
  return item;
}

// The terms not yet closed that a template is assigned in: those whose tasks a change to it
// reaches.
export async function assignedTerms(
  collegeId: string,
  templateId: string,
  db: Db = getDb(),
) {
  const rows = await db
    .selectDistinct({ termId: assignments.termId })
    .from(assignments)
    .innerJoin(terms, eq(terms.id, assignments.termId))
    .where(
      and(
        eq(assignments.collegeId, collegeId),
        eq(assignments.templateId, templateId),
        ne(terms.status, "closed"),
      ),
    );
  return rows.map(({ termId }) => termId);
}

// Whether a title is that of a template the department already assigns, one every department shares
// or its own, other than the one being renamed.
async function titleTaken(
  tx: Tx,
  collegeId: string,
  departmentId: string,
  title: string,
  except?: string,
) {
  const [taken] = await tx
    .select({ id: assignmentTemplates.id })
    .from(assignmentTemplates)
    .where(
      and(
        eq(assignmentTemplates.collegeId, collegeId),
        or(
          isNull(assignmentTemplates.departmentId),
          eq(assignmentTemplates.departmentId, departmentId),
        ),
        eq(assignmentTemplates.title, title),
        except ? ne(assignmentTemplates.id, except) : undefined,
      ),
    );
  return Boolean(taken);
}

// Whether an axis is one of the college's.
async function axisOf(tx: Tx, collegeId: string, axisId: string) {
  const [axis] = await tx
    .select({ id: axes.id })
    .from(axes)
    .where(and(eq(axes.collegeId, collegeId), eq(axes.id, axisId)));
  return Boolean(axis);
}

// Adds a template of a department's own, which its head assigns beside the shared ones.
export async function createTemplate(
  departmentId: string,
  input: AssignmentTemplateInput,
  change: Change,
  db: Db = getDb(),
): Promise<
  { status: "notFound" | "taken" } | { status: "created"; id: string }
> {
  return db.transaction(async (tx) => {
    // One title at a time across the college's departments.
    await lockCollege(tx, change.collegeId);
    const [department] = await tx
      .select({ active: departments.active })
      .from(departments)
      .where(
        and(
          eq(departments.collegeId, change.collegeId),
          eq(departments.id, departmentId),
        ),
      );
    if (
      !department?.active ||
      !(await axisOf(tx, change.collegeId, input.axisId))
    ) {
      return { status: "notFound" };
    }
    if (await titleTaken(tx, change.collegeId, departmentId, input.title)) {
      return { status: "taken" };
    }
    const [{ id }] = await tx
      .insert(assignmentTemplates)
      .values({ ...input, collegeId: change.collegeId, departmentId })
      .returning({ id: assignmentTemplates.id });
    await audit(tx, change, "assignmentTemplate.create", id, {
      to: { departmentId, ...input },
    });
    return { status: "created", id };
  });
}

// A department's own template, locked until the change commits; one every department shares
// changes for no head.
async function ownTemplate(tx: Tx, collegeId: string, id: string) {
  const [template] = await tx
    .select({
      id: assignmentTemplates.id,
      departmentId: assignmentTemplates.departmentId,
      title: assignmentTemplates.title,
      axisId: assignmentTemplates.axisId,
    })
    .from(assignmentTemplates)
    .where(
      and(
        eq(assignmentTemplates.collegeId, collegeId),
        eq(assignmentTemplates.id, id),
      ),
    )
    .for("update");
  if (!template) return "notFound" as const;
  const { departmentId } = template;
  return departmentId === null
    ? ("shared" as const)
    : { ...template, departmentId };
}

// Renames a department's own template, or moves its tasks under another axis.
export async function updateTemplate(
  id: string,
  input: AssignmentTemplateInput,
  change: Change,
  db: Db = getDb(),
): Promise<{
  status: "notFound" | "shared" | "taken" | "unchanged" | "saved";
}> {
  return db.transaction(async (tx) => {
    await lockCollege(tx, change.collegeId);
    const template = await ownTemplate(tx, change.collegeId, id);
    if (typeof template === "string") return { status: template };
    const before = { title: template.title, axisId: template.axisId };
    if (canonical(before) === canonical(input)) return { status: "unchanged" };
    if (!(await axisOf(tx, change.collegeId, input.axisId))) {
      return { status: "notFound" };
    }
    if (
      await titleTaken(
        tx,
        change.collegeId,
        template.departmentId,
        input.title,
        id,
      )
    ) {
      return { status: "taken" };
    }
    await tx
      .update(assignmentTemplates)
      .set({ ...input, updatedAt: sql`now()` })
      .where(eq(assignmentTemplates.id, id));
    const at = { departmentId: template.departmentId };
    await audit(tx, change, "assignmentTemplate.update", id, {
      from: { ...at, ...before },
      to: { ...at, ...input },
    });
    return { status: "saved" };
  });
}

// Takes out a department's own template, with its items, while no term has it assigned.
export async function deleteTemplate(
  id: string,
  change: Change,
  db: Db = getDb(),
): Promise<{ status: "notFound" | "shared" | "assigned" | "deleted" }> {
  return db.transaction(async (tx) => {
    const template = await ownTemplate(tx, change.collegeId, id);
    if (typeof template === "string") return { status: template };
    const [assigned] = await tx
      .select({ id: assignments.id })
      .from(assignments)
      .where(eq(assignments.templateId, id))
      .limit(1);
    if (assigned) return { status: "assigned" };
    await tx.delete(assignmentTemplates).where(eq(assignmentTemplates.id, id));
    await audit(tx, change, "assignmentTemplate.delete", id, {
      from: { departmentId: template.departmentId, title: template.title },
    });
    return { status: "deleted" };
  });
}

// Whether an item's evidence names only types the college accepts.
const accepts = (input: AssignmentItemInput, accepted: readonly string[]) =>
  input.evidence.types.every((type) => accepted.includes(type));

// Adds an item at the end of a department's own template.
export async function addTemplateItem(
  templateId: string,
  input: AssignmentItemInput,
  change: Change,
  accepted: readonly string[],
  db: Db = getDb(),
): Promise<
  | { status: "notFound" | "shared" | "notOffered" }
  | { status: "saved"; id: string }
> {
  return db.transaction(async (tx) => {
    const template = await ownTemplate(tx, change.collegeId, templateId);
    if (typeof template === "string") return { status: template };
    if (!accepts(input, accepted)) return { status: "notOffered" };
    const [{ last }] = await tx
      .select({ last: max(assignmentTemplateItems.position) })
      .from(assignmentTemplateItems)
      .where(eq(assignmentTemplateItems.templateId, templateId));
    const [{ id }] = await tx
      .insert(assignmentTemplateItems)
      .values({
        ...input,
        collegeId: change.collegeId,
        templateId,
        position: (last ?? -1) + 1,
      })
      .returning({ id: assignmentTemplateItems.id });
    await audit(tx, change, "assignmentTemplateItem.create", templateId, {
      to: {
        departmentId: template.departmentId,
        template: template.title,
        ...input,
      },
    });
    return { status: "saved", id };
  });
}

// An item of a department's own template, locked with its template.
async function ownItem(tx: Tx, collegeId: string, itemId: string) {
  const [item] = await tx
    .select({ ...itemColumns })
    .from(assignmentTemplateItems)
    .where(
      and(
        eq(assignmentTemplateItems.collegeId, collegeId),
        eq(assignmentTemplateItems.id, itemId),
      ),
    );
  if (!item) return { refused: "notFound" as const };
  const template = await ownTemplate(tx, collegeId, item.templateId);
  return typeof template === "string"
    ? { refused: template }
    : { item, template };
}

// Changes an item of a department's own template.
export async function updateTemplateItem(
  itemId: string,
  input: AssignmentItemInput,
  change: Change,
  accepted: readonly string[],
  db: Db = getDb(),
): Promise<{
  status: "notFound" | "shared" | "notOffered" | "unchanged" | "saved";
}> {
  return db.transaction(async (tx) => {
    const found = await ownItem(tx, change.collegeId, itemId);
    if (found.refused) return { status: found.refused };
    const { id: _, templateId, ...before } = found.item;
    if (canonical(before) === canonical(input)) return { status: "unchanged" };
    if (!accepts(input, accepted)) return { status: "notOffered" };
    await tx
      .update(assignmentTemplateItems)
      .set({ ...input, updatedAt: sql`now()` })
      .where(eq(assignmentTemplateItems.id, itemId));
    const at = {
      departmentId: found.template.departmentId,
      template: found.template.title,
    };
    await audit(tx, change, "assignmentTemplateItem.update", templateId, {
      from: { ...at, ...before },
      to: { ...at, ...input },
    });
    return { status: "saved" };
  });
}

// Takes an item out of a department's own template: its tasks not started are cancelled by the
// next pass.
export async function removeTemplateItem(
  itemId: string,
  change: Change,
  db: Db = getDb(),
): Promise<{ status: "notFound" | "shared" | "removed" }> {
  return db.transaction(async (tx) => {
    const found = await ownItem(tx, change.collegeId, itemId);
    if (found.refused) return { status: found.refused };
    await tx
      .delete(assignmentTemplateItems)
      .where(eq(assignmentTemplateItems.id, itemId));
    await audit(
      tx,
      change,
      "assignmentTemplateItem.delete",
      found.item.templateId,
      {
        from: {
          departmentId: found.template.departmentId,
          template: found.template.title,
          title: found.item.title,
        },
      },
    );
    return { status: "removed" };
  });
}

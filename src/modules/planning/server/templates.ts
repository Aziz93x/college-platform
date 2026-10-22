import { and, asc, eq, max, sql } from "drizzle-orm";
import { type Db, getDb, type Tx } from "../../../platform/db/client.ts";
import { canonical } from "../../../platform/validation/text.ts";
import { type AuditAction, writeAudit } from "../../audit/index.ts";
import {
  offersItem,
  type SectionTemplateInput,
} from "../../framework/index.ts";
import { terms } from "../../terms/index.ts";
import { sectionTemplates } from "./schema.ts";

// Who changes a department's templates, for the audit event. The caller has authorized them in the
// template's department.
type Change = {
  collegeId: string;
  actorId: string;
  ip?: string | null;
  userAgent?: string | null;
};

const templateColumns = {
  id: sectionTemplates.id,
  title: sectionTemplates.title,
  axisId: sectionTemplates.axisId,
  kind: sectionTemplates.kind,
  appliesTo: sectionTemplates.appliesTo,
  due: sectionTemplates.due,
  evidence: sectionTemplates.evidence,
  notes: sectionTemplates.notes,
};

const audit = (
  tx: Tx,
  change: Change,
  action: AuditAction,
  entity: { type: "sectionTemplate" | "department"; id: string },
  diff: Record<string, unknown>,
) =>
  writeAudit(
    {
      collegeId: change.collegeId,
      actorId: change.actorId,
      action,
      entityType: entity.type,
      entityId: entity.id,
      diff,
      ip: change.ip,
      userAgent: change.userAgent,
    },
    tx,
  );

// A department's section templates for a term, in the head's order.
export function listTemplates(
  collegeId: string,
  termId: string,
  departmentId: string,
  db: Db = getDb(),
) {
  return db
    .select(templateColumns)
    .from(sectionTemplates)
    .where(
      and(
        eq(sectionTemplates.collegeId, collegeId),
        eq(sectionTemplates.termId, termId),
        eq(sectionTemplates.departmentId, departmentId),
      ),
    )
    .orderBy(asc(sectionTemplates.position), asc(sectionTemplates.id));
}

// A template of the college, with the department its action checks the key in.
export async function findTemplate(
  collegeId: string,
  id: string,
  db: Db = getDb(),
) {
  const [template] = await db
    .select({
      id: sectionTemplates.id,
      termId: sectionTemplates.termId,
      departmentId: sectionTemplates.departmentId,
    })
    .from(sectionTemplates)
    .where(
      and(
        eq(sectionTemplates.collegeId, collegeId),
        eq(sectionTemplates.id, id),
      ),
    );
  return template;
}

// The college's term a template changes in, locked until the change commits: a closed term's
// templates change no more, as its framework does not (Audit 5).
async function termState(tx: Tx, collegeId: string, termId: string) {
  const [term] = await tx
    .select({ status: terms.status })
    .from(terms)
    .where(and(eq(terms.collegeId, collegeId), eq(terms.id, termId)))
    .for("update");
  if (!term) return "notFound" as const;
  return term.status === "closed" ? ("closed" as const) : ("open" as const);
}

// Adds a template at the end of a department's for a term.
export async function addTemplate(
  termId: string,
  departmentId: string,
  input: SectionTemplateInput,
  change: Change,
  accepted: string[],
  db: Db = getDb(),
): Promise<
  | { status: "notFound" | "closed" | "notOffered" }
  | { status: "saved"; id: string }
> {
  return db.transaction(async (tx) => {
    const state = await termState(tx, change.collegeId, termId);
    if (state !== "open") return { status: state };
    if (!offersItem(input, accepted)) return { status: "notOffered" };
    const [{ last }] = await tx
      .select({ last: max(sectionTemplates.position) })
      .from(sectionTemplates)
      .where(
        and(
          eq(sectionTemplates.termId, termId),
          eq(sectionTemplates.departmentId, departmentId),
        ),
      );
    const [{ id }] = await tx
      .insert(sectionTemplates)
      .values({
        ...input,
        collegeId: change.collegeId,
        termId,
        departmentId,
        position: (last ?? -1) + 1,
      })
      .returning({ id: sectionTemplates.id });
    await audit(
      tx,
      change,
      "sectionTemplate.create",
      { type: "sectionTemplate", id },
      { to: { termId, departmentId, ...input } },
    );
    return { status: "saved", id };
  });
}

// A template to change, with its term locked; nothing for another college's.
async function changing(tx: Tx, collegeId: string, id: string) {
  const [template] = await tx
    .select({
      ...templateColumns,
      termId: sectionTemplates.termId,
      departmentId: sectionTemplates.departmentId,
    })
    .from(sectionTemplates)
    .where(
      and(
        eq(sectionTemplates.collegeId, collegeId),
        eq(sectionTemplates.id, id),
      ),
    );
  if (!template) return { refused: "notFound" as const };
  const state = await termState(tx, collegeId, template.termId);
  return state === "open" ? { template } : { refused: state };
}

// Changes a template.
export async function updateTemplate(
  id: string,
  input: SectionTemplateInput,
  change: Change,
  accepted: string[],
  db: Db = getDb(),
): Promise<{
  status: "notFound" | "closed" | "notOffered" | "unchanged" | "saved";
}> {
  return db.transaction(async (tx) => {
    const found = await changing(tx, change.collegeId, id);
    if (found.refused) return { status: found.refused };
    const { id: _, termId, departmentId, ...before } = found.template;
    if (canonical(before) === canonical({ ...before, ...input })) {
      return { status: "unchanged" };
    }
    if (!offersItem(input, accepted)) return { status: "notOffered" };
    await tx
      .update(sectionTemplates)
      .set({ ...input, updatedAt: sql`now()` })
      .where(eq(sectionTemplates.id, id));
    await audit(
      tx,
      change,
      "sectionTemplate.update",
      { type: "sectionTemplate", id },
      {
        from: { termId, departmentId, ...before },
        to: { termId, departmentId, ...input },
      },
    );
    return { status: "saved" };
  });
}

// Takes a template out.
export async function removeTemplate(
  id: string,
  change: Change,
  db: Db = getDb(),
): Promise<{ status: "notFound" | "closed" | "saved" }> {
  return db.transaction(async (tx) => {
    const found = await changing(tx, change.collegeId, id);
    if (found.refused) return { status: found.refused };
    const { termId, departmentId, title } = found.template;
    await tx.delete(sectionTemplates).where(eq(sectionTemplates.id, id));
    await audit(
      tx,
      change,
      "sectionTemplate.delete",
      { type: "sectionTemplate", id },
      { from: { termId, departmentId, title } },
    );
    return { status: "saved" };
  });
}

// The Step 13 wizard's part: the next term starts with a copy of each department's templates of the
// term it opens from, in their order, still drafts. Inside the wizard's transaction; records a copy
// on each department's history.
export async function copyTemplatesInto(
  tx: Tx,
  fromTermId: string,
  toTermId: string,
  change: Change,
) {
  const templates = await tx
    .select({
      ...templateColumns,
      departmentId: sectionTemplates.departmentId,
      position: sectionTemplates.position,
    })
    .from(sectionTemplates)
    .where(
      and(
        eq(sectionTemplates.collegeId, change.collegeId),
        eq(sectionTemplates.termId, fromTermId),
      ),
    )
    .orderBy(
      asc(sectionTemplates.departmentId),
      asc(sectionTemplates.position),
      asc(sectionTemplates.id),
    );
  if (templates.length === 0) return 0;
  await tx.insert(sectionTemplates).values(
    templates.map(({ id: _, ...template }) => ({
      ...template,
      collegeId: change.collegeId,
      termId: toTermId,
    })),
  );
  const copied = Map.groupBy(templates, ({ departmentId }) => departmentId);
  for (const [departmentId, each] of copied) {
    await audit(
      tx,
      change,
      "sectionTemplate.copy",
      { type: "department", id: departmentId },
      { to: { termId: toTermId, from: fromTermId, templates: each.length } },
    );
  }
  return templates.length;
}

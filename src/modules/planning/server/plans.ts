import { and, asc, desc, eq, inArray, max, sql } from "drizzle-orm";
import { type Db, getDb, type Tx } from "../../../platform/db/client.ts";
import { lockCollege } from "../../../platform/db/college-lock.ts";
import { canonical } from "../../../platform/validation/text.ts";
import { roleHolders, roles } from "../../access/index.ts";
import { type AuditAction, writeAudit } from "../../audit/index.ts";
import { offersItem, type PlanItemInput } from "../../framework/index.ts";
import { departments } from "../../org/index.ts";
import { terms } from "../../terms/index.ts";
import { planItems, plans } from "./schema.ts";

// Who changes a department's plan, for the audit event. The caller has authorized them in the
// plan's department.
type Change = {
  collegeId: string;
  actorId: string;
  ip?: string | null;
  userAgent?: string | null;
};

const itemColumns = {
  id: planItems.id,
  planId: planItems.planId,
  title: planItems.title,
  axisId: planItems.axisId,
  kind: planItems.kind,
  appliesTo: planItems.appliesTo,
  due: planItems.due,
  evidence: planItems.evidence,
  notes: planItems.notes,
};

const audit = (
  tx: Tx,
  change: Change,
  action: AuditAction,
  planId: string,
  diff: Record<string, unknown>,
) =>
  writeAudit(
    {
      collegeId: change.collegeId,
      actorId: change.actorId,
      action,
      entityType: "plan",
      entityId: planId,
      diff,
      ip: change.ip,
      userAgent: change.userAgent,
    },
    tx,
  );

// A department's plan for a term: its latest published version and its draft, each with its items
// in order, and every version it has, the latest first, with how many items each holds.
export async function departmentPlan(
  collegeId: string,
  termId: string,
  departmentId: string,
  db: Db = getDb(),
) {
  const versions = await db
    .select({
      id: plans.id,
      version: plans.version,
      status: plans.status,
      publishedAt: plans.publishedAt,
      items: sql<number>`count(${planItems.id})::int`,
    })
    .from(plans)
    .leftJoin(planItems, eq(planItems.planId, plans.id))
    .where(
      and(
        eq(plans.collegeId, collegeId),
        eq(plans.termId, termId),
        eq(plans.departmentId, departmentId),
      ),
    )
    .groupBy(plans.id)
    .orderBy(desc(plans.version));
  const draft = versions.find(({ status }) => status === "draft");
  const published = versions.find(({ status }) => status === "published");
  const shown = [draft, published].flatMap((each) => (each ? [each.id] : []));
  const items =
    shown.length > 0
      ? await db
          .select(itemColumns)
          .from(planItems)
          .where(inArray(planItems.planId, shown))
          .orderBy(asc(planItems.position))
      : [];
  const withItems = (each: (typeof versions)[number] | undefined) =>
    each && {
      ...each,
      items: items.filter(({ planId }) => planId === each.id),
    };
  return { draft: withItems(draft), published: withItems(published), versions };
}

// A plan of the college, with the department its action checks the key in, and its term.
export async function findPlan(
  collegeId: string,
  id: string,
  db: Db = getDb(),
) {
  const [plan] = await db
    .select({
      id: plans.id,
      termId: plans.termId,
      departmentId: plans.departmentId,
    })
    .from(plans)
    .where(and(eq(plans.collegeId, collegeId), eq(plans.id, id)));
  return plan;
}

// An item of a plan of the college, with its plan's department, as findPlan() gives it.
export async function findPlanItem(
  collegeId: string,
  id: string,
  db: Db = getDb(),
) {
  const [item] = await db
    .select({
      id: planItems.id,
      termId: plans.termId,
      departmentId: plans.departmentId,
    })
    .from(planItems)
    .innerJoin(plans, eq(plans.id, planItems.planId))
    .where(and(eq(planItems.collegeId, collegeId), eq(planItems.id, id)));
  return item;
}

// The item an item copies, as it was first entered, or the item itself: what the generation engine
// knows it by in every version (Step 20).
const origin = sql<string>`coalesce(${planItems.originId}, ${planItems.id})`;

// Copies a version's items into another, in their order, each still knowing the item it copies.
async function copyItems(tx: Tx, collegeId: string, from: string, to: string) {
  const items = await tx
    .select({ ...itemColumns, origin })
    .from(planItems)
    .where(eq(planItems.planId, from))
    .orderBy(asc(planItems.position));
  if (items.length === 0) return 0;
  await tx.insert(planItems).values(
    items.map(({ id: _, planId: __, origin: first, ...item }, position) => ({
      ...item,
      originId: first,
      collegeId,
      planId: to,
      position,
    })),
  );
  return items.length;
}

// The items of each department's latest published plan for the term, in their order, each with its
// department and the item it copies as it was first entered: what the generation engine makes tasks
// of beside the framework's (Step 19).
export async function publishedPlanItems(
  collegeId: string,
  termId: string,
  db: Db | Tx = getDb(),
) {
  const latest = await db
    .selectDistinctOn([plans.departmentId], {
      id: plans.id,
      departmentId: plans.departmentId,
    })
    .from(plans)
    .where(
      and(
        eq(plans.collegeId, collegeId),
        eq(plans.termId, termId),
        eq(plans.status, "published"),
      ),
    )
    .orderBy(plans.departmentId, desc(plans.version));
  if (latest.length === 0) return [];
  const departmentOf = new Map(
    latest.map(({ id, departmentId }) => [id, departmentId]),
  );
  const items = await db
    .select({ ...itemColumns, origin })
    .from(planItems)
    .where(inArray(planItems.planId, [...departmentOf.keys()]))
    .orderBy(asc(planItems.position));
  return items.map((item) => ({
    ...item,
    departmentId: departmentOf.get(item.planId) as string,
  }));
}

// The latest published version of a department's plan for a term, or else its draft: what a copy
// into another term starts from.
async function latestPlan(
  tx: Tx,
  collegeId: string,
  termId: string,
  departmentId?: string,
) {
  return tx
    .selectDistinctOn([plans.departmentId], {
      id: plans.id,
      departmentId: plans.departmentId,
    })
    .from(plans)
    .where(
      and(
        eq(plans.collegeId, collegeId),
        eq(plans.termId, termId),
        departmentId ? eq(plans.departmentId, departmentId) : undefined,
      ),
    )
    .orderBy(
      plans.departmentId,
      sql`${plans.status} = 'published' desc`,
      desc(plans.version),
    );
}

// Starts a department's next version of its plan for a term as a draft: from its latest published
// version, or, for its first, from the plan it had in another term of the college (the previous
// one, which the page offers), or empty. A department that has a draft keeps it; a closed term, a
// department of another college or one no longer in use, gets none.
export async function startPlanDraft(
  termId: string,
  departmentId: string,
  change: Change,
  fromTermId?: string,
  db: Db = getDb(),
): Promise<
  | { status: "notFound" | "closed" }
  | { status: "exists"; id: string }
  | { status: "created"; id: string; items: number }
> {
  return db.transaction(async (tx) => {
    await lockCollege(tx, change.collegeId);
    const [term] = await tx
      .select({ status: terms.status })
      .from(terms)
      .where(and(eq(terms.collegeId, change.collegeId), eq(terms.id, termId)));
    const [department] = await tx
      .select({ active: departments.active })
      .from(departments)
      .where(
        and(
          eq(departments.collegeId, change.collegeId),
          eq(departments.id, departmentId),
        ),
      );
    if (!term || !department?.active) return { status: "notFound" };
    if (term.status === "closed") return { status: "closed" };
    const versions = await tx
      .select({ id: plans.id, version: plans.version, status: plans.status })
      .from(plans)
      .where(
        and(eq(plans.termId, termId), eq(plans.departmentId, departmentId)),
      )
      .orderBy(desc(plans.version));
    const draft = versions.find(({ status }) => status === "draft");
    if (draft) return { status: "exists", id: draft.id };
    const version = (versions[0]?.version ?? 0) + 1;
    const [{ id }] = await tx
      .insert(plans)
      .values({ collegeId: change.collegeId, termId, departmentId, version })
      .returning({ id: plans.id });
    const [source] =
      versions.length > 0
        ? versions.filter(({ status }) => status === "published")
        : fromTermId
          ? await latestPlan(tx, change.collegeId, fromTermId, departmentId)
          : [];
    const items = source
      ? await copyItems(tx, change.collegeId, source.id, id)
      : 0;
    await audit(tx, change, "plan.create", id, {
      to: {
        termId,
        departmentId,
        version,
        items,
        ...(versions.length === 0 && source ? { fromTermId } : {}),
      },
    });
    return { status: "created", id, items };
  });
}

// A draft of the college, locked with its term until the change commits. A published version
// changes no more, and neither does the draft of a term that has closed.
async function draftOf(tx: Tx, collegeId: string, id: string) {
  const [draft] = await tx
    .select({
      id: plans.id,
      termId: plans.termId,
      departmentId: plans.departmentId,
      version: plans.version,
      status: plans.status,
      termStatus: terms.status,
    })
    .from(plans)
    .innerJoin(terms, eq(terms.id, plans.termId))
    .where(and(eq(plans.collegeId, collegeId), eq(plans.id, id)))
    .for("update");
  if (!draft) return "notFound" as const;
  if (draft.status !== "draft") return "notDraft" as const;
  return draft.termStatus === "closed" ? ("closed" as const) : draft;
}

// Whether an item names only what the college offers (offersItem()), and whom the department has:
// one of the college's roles, or a person who holds a role in the department now, as the
// generation engine reaches them.
async function offered(
  tx: Tx,
  collegeId: string,
  departmentId: string,
  input: PlanItemInput,
  accepted: readonly string[],
) {
  if (!(await offersItem(tx, collegeId, input, accepted))) return false;
  const applies = input.appliesTo;
  switch (applies.type) {
    case "eachSection":
    case "eachCourse":
      return true;
    case "role": {
      const [role] = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(
          and(
            eq(roles.collegeId, collegeId),
            eq(roles.id, applies.roleId),
            eq(roles.system, false),
          ),
        );
      return Boolean(role);
    }
    case "person":
      return (await roleHolders(collegeId, tx)).some(
        (holder) =>
          holder.departmentId === departmentId &&
          holder.userId === applies.userId,
      );
  }
}

// Adds an item at the end of a draft.
export async function addPlanItem(
  planId: string,
  input: PlanItemInput,
  change: Change,
  accepted: readonly string[],
  db: Db = getDb(),
): Promise<
  | { status: "notFound" | "notDraft" | "closed" | "notOffered" }
  | { status: "saved"; id: string }
> {
  return db.transaction(async (tx) => {
    const draft = await draftOf(tx, change.collegeId, planId);
    if (typeof draft === "string") return { status: draft };
    if (
      !(await offered(
        tx,
        change.collegeId,
        draft.departmentId,
        input,
        accepted,
      ))
    ) {
      return { status: "notOffered" };
    }
    const [{ last }] = await tx
      .select({ last: max(planItems.position) })
      .from(planItems)
      .where(eq(planItems.planId, planId));
    const [{ id }] = await tx
      .insert(planItems)
      .values({
        ...input,
        collegeId: change.collegeId,
        planId,
        position: (last ?? -1) + 1,
      })
      .returning({ id: planItems.id });
    await audit(tx, change, "planItem.create", planId, {
      to: { termId: draft.termId, departmentId: draft.departmentId, ...input },
    });
    return { status: "saved", id };
  });
}

// The draft's items to change, locked with their draft; nothing for a published version's, or for
// items of different plans.
async function draftItems(
  tx: Tx,
  collegeId: string,
  itemIds: readonly string[],
) {
  const items = await tx
    .select(itemColumns)
    .from(planItems)
    .where(
      and(eq(planItems.collegeId, collegeId), inArray(planItems.id, itemIds)),
    );
  const planIds = new Set(items.map(({ planId }) => planId));
  if (items.length !== new Set(itemIds).size || planIds.size !== 1) {
    return { refused: "notFound" as const };
  }
  const draft = await draftOf(tx, collegeId, items[0].planId);
  return typeof draft === "string" ? { refused: draft } : { items, draft };
}

// Changes an item of a draft.
export async function updatePlanItem(
  itemId: string,
  input: PlanItemInput,
  change: Change,
  accepted: readonly string[],
  db: Db = getDb(),
): Promise<{
  status:
    | "notFound"
    | "notDraft"
    | "closed"
    | "notOffered"
    | "unchanged"
    | "saved";
}> {
  return db.transaction(async (tx) => {
    const found = await draftItems(tx, change.collegeId, [itemId]);
    if (found.refused) return { status: found.refused };
    const { draft } = found;
    const { id: _, planId: __, ...before } = found.items[0];
    if (canonical(before) === canonical({ ...before, ...input })) {
      return { status: "unchanged" };
    }
    if (
      !(await offered(
        tx,
        change.collegeId,
        draft.departmentId,
        input,
        accepted,
      ))
    ) {
      return { status: "notOffered" };
    }
    await tx
      .update(planItems)
      .set({ ...input, updatedAt: sql`now()` })
      .where(eq(planItems.id, itemId));
    const at = { termId: draft.termId, departmentId: draft.departmentId };
    await audit(tx, change, "planItem.update", draft.id, {
      from: { ...at, ...before },
      to: { ...at, ...input },
    });
    return { status: "saved" };
  });
}

// Moves items of a draft, each due in one week, to the weeks given: an item dragged on the week
// grid, or several chosen and moved together. An item due otherwise has no week to move.
export async function movePlanItems(
  moves: readonly { itemId: string; week: number }[],
  change: Change,
  db: Db = getDb(),
): Promise<{
  status: "notFound" | "notDraft" | "closed" | "notMovable" | "saved";
}> {
  return db.transaction(async (tx) => {
    const found = await draftItems(
      tx,
      change.collegeId,
      moves.map(({ itemId }) => itemId),
    );
    if (found.refused) return { status: found.refused };
    const { draft } = found;
    if (found.items.some(({ due }) => due.type !== "week")) {
      return { status: "notMovable" };
    }
    const at = { termId: draft.termId, departmentId: draft.departmentId };
    for (const { itemId, week } of moves) {
      const item = found.items.find(({ id }) => id === itemId);
      if (!item || (item.due.type === "week" && item.due.week === week)) {
        continue;
      }
      const due = { type: "week" as const, week };
      await tx
        .update(planItems)
        .set({ due, updatedAt: sql`now()` })
        .where(eq(planItems.id, itemId));
      await audit(tx, change, "planItem.update", draft.id, {
        from: { ...at, title: item.title, due: item.due },
        to: { ...at, title: item.title, due },
      });
    }
    return { status: "saved" };
  });
}

// Takes items out of a draft: one, or several chosen together.
export async function removePlanItems(
  itemIds: readonly string[],
  change: Change,
  db: Db = getDb(),
): Promise<{ status: "notFound" | "notDraft" | "closed" | "saved" }> {
  return db.transaction(async (tx) => {
    const found = await draftItems(tx, change.collegeId, itemIds);
    if (found.refused) return { status: found.refused };
    const { draft } = found;
    await tx.delete(planItems).where(inArray(planItems.id, [...itemIds]));
    for (const item of found.items) {
      await audit(tx, change, "planItem.delete", draft.id, {
        from: {
          termId: draft.termId,
          departmentId: draft.departmentId,
          title: item.title,
        },
      });
    }
    return { status: "saved" };
  });
}

// Publishes a draft: it becomes the department's plan for the term and never changes again. A
// published plan names its term, whose tasks are generated again (Step 20).
export async function publishPlan(
  planId: string,
  change: Change,
  db: Db = getDb(),
): Promise<
  | { status: "notFound" | "notDraft" | "closed" | "empty" }
  | { status: "published"; termId: string }
> {
  return db.transaction(async (tx) => {
    const draft = await draftOf(tx, change.collegeId, planId);
    if (typeof draft === "string") return { status: draft };
    const [{ items }] = await tx
      .select({ items: sql<number>`count(*)::int` })
      .from(planItems)
      .where(eq(planItems.planId, planId));
    if (items === 0) return { status: "empty" };
    await tx
      .update(plans)
      .set({
        status: "published",
        publishedBy: change.actorId,
        publishedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(eq(plans.id, planId));
    await audit(tx, change, "plan.publish", planId, {
      to: {
        termId: draft.termId,
        departmentId: draft.departmentId,
        version: draft.version,
        items,
      },
    });
    return { status: "published", termId: draft.termId };
  });
}

// The Step 13 wizard's part: the next term starts with a draft of each department's plan of the
// term it opens from, its latest published version or else its draft. Inside the wizard's
// transaction; returns how many items it copied.
export async function copyPlansInto(
  tx: Tx,
  fromTermId: string,
  toTermId: string,
  change: Change,
) {
  let copied = 0;
  for (const source of await latestPlan(tx, change.collegeId, fromTermId)) {
    const [{ id }] = await tx
      .insert(plans)
      .values({
        collegeId: change.collegeId,
        termId: toTermId,
        departmentId: source.departmentId,
        version: 1,
      })
      .returning({ id: plans.id });
    const items = await copyItems(tx, change.collegeId, source.id, id);
    await audit(tx, change, "plan.create", id, {
      to: {
        termId: toTermId,
        departmentId: source.departmentId,
        version: 1,
        items,
        fromTermId,
      },
    });
    copied += items;
  }
  return copied;
}

import { and, asc, desc, eq, inArray, max, sql } from "drizzle-orm";
import { type Db, getDb, type Tx } from "../../../platform/db/client.ts";
import { lockCollege } from "../../../platform/db/college-lock.ts";
import { roles } from "../../access/index.ts";
import { type AuditAction, writeAudit } from "../../audit/index.ts";
import { calendarEventKinds, terms } from "../../terms/index.ts";
import type { FrameworkItemInput } from "../domain/inputs.ts";
import { frameworkItems, frameworks } from "./schema.ts";

// Who changes a framework, for the audit event. The caller has authorized them.
type Change = {
  collegeId: string;
  actorId: string;
  ip?: string | null;
  userAgent?: string | null;
};

const itemColumns = {
  id: frameworkItems.id,
  frameworkId: frameworkItems.frameworkId,
  title: frameworkItems.title,
  axisId: frameworkItems.axisId,
  kind: frameworkItems.kind,
  appliesTo: frameworkItems.appliesTo,
  due: frameworkItems.due,
  evidence: frameworkItems.evidence,
  notes: frameworkItems.notes,
};

// A value as text with its keys in order, so two items compare the same however jsonb kept them.
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_, each) =>
    each && typeof each === "object" && !Array.isArray(each)
      ? Object.fromEntries(
          Object.entries(each).sort(([a], [b]) => a.localeCompare(b)),
        )
      : each,
  );

const audit = (
  tx: Tx,
  change: Change,
  action: AuditAction,
  frameworkId: string,
  diff: Record<string, unknown>,
) =>
  writeAudit(
    {
      collegeId: change.collegeId,
      actorId: change.actorId,
      action,
      entityType: "framework",
      entityId: frameworkId,
      diff,
      ip: change.ip,
      userAgent: change.userAgent,
    },
    tx,
  );

// A term's framework: its latest published version and its draft, each with its items in order,
// and how many versions it has published.
export async function termFramework(
  collegeId: string,
  termId: string,
  db: Db = getDb(),
) {
  const versions = await db
    .select({
      id: frameworks.id,
      version: frameworks.version,
      status: frameworks.status,
      endorsedAt: frameworks.endorsedAt,
      publishedAt: frameworks.publishedAt,
    })
    .from(frameworks)
    .where(
      and(eq(frameworks.collegeId, collegeId), eq(frameworks.termId, termId)),
    )
    .orderBy(desc(frameworks.version));
  const draft = versions.find(({ status }) => status === "draft");
  const published = versions.find(({ status }) => status === "published");
  const shown = [draft, published].flatMap((each) => (each ? [each.id] : []));
  const items =
    shown.length > 0
      ? await db
          .select(itemColumns)
          .from(frameworkItems)
          .where(inArray(frameworkItems.frameworkId, shown))
          .orderBy(asc(frameworkItems.position))
      : [];
  const withItems = (each: (typeof versions)[number] | undefined) =>
    each && {
      ...each,
      items: items.filter(({ frameworkId }) => frameworkId === each.id),
    };
  return { draft: withItems(draft), published: withItems(published) };
}

// Copies a version's items into another, in their order.
async function copyItems(tx: Tx, from: string, to: string) {
  const items = await tx
    .select(itemColumns)
    .from(frameworkItems)
    .where(eq(frameworkItems.frameworkId, from))
    .orderBy(asc(frameworkItems.position));
  if (items.length === 0) return 0;
  const [{ collegeId }] = await tx
    .select({ collegeId: frameworks.collegeId })
    .from(frameworks)
    .where(eq(frameworks.id, to));
  await tx.insert(frameworkItems).values(
    items.map(({ id: _, frameworkId: __, ...item }, position) => ({
      ...item,
      collegeId,
      frameworkId: to,
      position,
    })),
  );
  return items.length;
}

// Starts the term's next version as a draft, from its latest published version, or empty. A term
// that has a draft keeps it, and a closed term changes no more.
export async function startDraft(
  termId: string,
  change: Change,
  db: Db = getDb(),
): Promise<
  | { status: "notFound" | "closed" }
  | { status: "exists" | "created"; id: string }
> {
  return db.transaction(async (tx) => {
    await lockCollege(tx, change.collegeId);
    const [term] = await tx
      .select({ status: terms.status })
      .from(terms)
      .where(and(eq(terms.collegeId, change.collegeId), eq(terms.id, termId)));
    if (!term) return { status: "notFound" };
    if (term.status === "closed") return { status: "closed" };
    const versions = await tx
      .select({
        id: frameworks.id,
        version: frameworks.version,
        status: frameworks.status,
      })
      .from(frameworks)
      .where(eq(frameworks.termId, termId))
      .orderBy(desc(frameworks.version));
    const draft = versions.find(({ status }) => status === "draft");
    if (draft) return { status: "exists", id: draft.id };
    const version = (versions[0]?.version ?? 0) + 1;
    const [{ id }] = await tx
      .insert(frameworks)
      .values({ collegeId: change.collegeId, termId, version })
      .returning({ id: frameworks.id });
    const latest = versions.find(({ status }) => status === "published");
    const copied = latest ? await copyItems(tx, latest.id, id) : 0;
    await audit(tx, change, "framework.create", id, {
      to: { termId, version, items: copied },
    });
    return { status: "created", id };
  });
}

// A draft of the college, locked with its term until the change commits. A published version
// changes no more, and neither does the draft of a term that has closed (Audit 5).
async function draftOf(tx: Tx, collegeId: string, id: string) {
  const [draft] = await tx
    .select({
      id: frameworks.id,
      termId: frameworks.termId,
      version: frameworks.version,
      status: frameworks.status,
      endorsedAt: frameworks.endorsedAt,
      termStatus: terms.status,
    })
    .from(frameworks)
    .innerJoin(terms, eq(terms.id, frameworks.termId))
    .where(and(eq(frameworks.collegeId, collegeId), eq(frameworks.id, id)))
    .for("update");
  if (draft?.status !== "draft") return "notDraft" as const;
  return draft.termStatus === "closed" ? ("closed" as const) : draft;
}

// Whether an item names only file types the college accepts (files.acceptedTypes, which the caller
// reads) and, for a rule after a calendar day, a kind of day a calendar has (Audit 5). A section
// template's service asks the same (Step 18).
export function offersItem(
  input: Pick<FrameworkItemInput, "due" | "evidence">,
  accepted: readonly string[],
) {
  return (
    input.evidence.types.every((type) => accepted.includes(type)) &&
    (input.due.type !== "afterEvent" ||
      (calendarEventKinds as readonly string[]).includes(input.due.eventKind))
  );
}

// Whether an item names only what the college offers, as offersItem() asks, and one of its own
// roles (Audit 5).
async function offered(
  tx: Tx,
  collegeId: string,
  input: FrameworkItemInput,
  accepted: string[],
) {
  if (!offersItem(input, accepted)) return false;
  if (input.appliesTo.type === "eachSection") return true;
  const [role] = await tx
    .select({ id: roles.id })
    .from(roles)
    .where(
      and(
        eq(roles.collegeId, collegeId),
        eq(roles.id, input.appliesTo.roleId),
        eq(roles.system, false),
      ),
    );
  return Boolean(role);
}

// A change to a draft's items takes back the dean's endorsement: the dean endorsed other items.
const unendorse = (tx: Tx, id: string) =>
  tx
    .update(frameworks)
    .set({ endorsedBy: null, endorsedAt: null, updatedAt: sql`now()` })
    .where(eq(frameworks.id, id));

// Adds an item at the end of a draft.
export async function addItem(
  draftId: string,
  input: FrameworkItemInput,
  change: Change,
  accepted: string[],
  db: Db = getDb(),
): Promise<
  | { status: "notDraft" | "closed" | "notOffered" }
  | { status: "saved"; id: string }
> {
  return db.transaction(async (tx) => {
    const draft = await draftOf(tx, change.collegeId, draftId);
    if (typeof draft === "string") return { status: draft };
    if (!(await offered(tx, change.collegeId, input, accepted))) {
      return { status: "notOffered" };
    }
    const [{ last }] = await tx
      .select({ last: max(frameworkItems.position) })
      .from(frameworkItems)
      .where(eq(frameworkItems.frameworkId, draftId));
    const [{ id }] = await tx
      .insert(frameworkItems)
      .values({
        ...input,
        collegeId: change.collegeId,
        frameworkId: draftId,
        position: (last ?? -1) + 1,
      })
      .returning({ id: frameworkItems.id });
    await unendorse(tx, draftId);
    await audit(tx, change, "frameworkItem.create", draftId, {
      to: { termId: draft.termId, ...input },
    });
    return { status: "saved", id };
  });
}

// The draft's item to change, locked with its draft; nothing for a published version's.
async function draftItem(tx: Tx, collegeId: string, itemId: string) {
  const [item] = await tx
    .select(itemColumns)
    .from(frameworkItems)
    .where(
      and(
        eq(frameworkItems.collegeId, collegeId),
        eq(frameworkItems.id, itemId),
      ),
    );
  if (!item) return { refused: "notFound" as const };
  const draft = await draftOf(tx, collegeId, item.frameworkId);
  return typeof draft === "string" ? { refused: draft } : { item, draft };
}

// Changes an item of a draft.
export async function updateItem(
  itemId: string,
  input: FrameworkItemInput,
  change: Change,
  accepted: string[],
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
    const found = await draftItem(tx, change.collegeId, itemId);
    if (found.refused) return { status: found.refused };
    const { id: _, frameworkId: __, ...before } = found.item;
    if (canonical(before) === canonical({ ...before, ...input })) {
      return { status: "unchanged" };
    }
    if (!(await offered(tx, change.collegeId, input, accepted))) {
      return { status: "notOffered" };
    }
    await tx
      .update(frameworkItems)
      .set({ ...input, updatedAt: sql`now()` })
      .where(eq(frameworkItems.id, itemId));
    await unendorse(tx, found.draft.id);
    await audit(tx, change, "frameworkItem.update", found.draft.id, {
      from: { termId: found.draft.termId, ...before },
      to: { termId: found.draft.termId, ...input },
    });
    return { status: "saved" };
  });
}

// Takes an item out of a draft.
export async function removeItem(
  itemId: string,
  change: Change,
  db: Db = getDb(),
): Promise<{ status: "notFound" | "notDraft" | "closed" | "saved" }> {
  return db.transaction(async (tx) => {
    const found = await draftItem(tx, change.collegeId, itemId);
    if (found.refused) return { status: found.refused };
    await tx.delete(frameworkItems).where(eq(frameworkItems.id, itemId));
    await unendorse(tx, found.draft.id);
    await audit(tx, change, "frameworkItem.delete", found.draft.id, {
      from: { termId: found.draft.termId, title: found.item.title },
    });
    return { status: "saved" };
  });
}

// The number of items in a version.
async function itemCount(tx: Tx, frameworkId: string) {
  const [{ items }] = await tx
    .select({ items: sql<number>`count(*)::int` })
    .from(frameworkItems)
    .where(eq(frameworkItems.frameworkId, frameworkId));
  return items;
}

// The dean endorses a draft as it stands; a change to its items takes the endorsement back.
export async function endorseDraft(
  draftId: string,
  change: Change,
  db: Db = getDb(),
): Promise<{
  status: "notDraft" | "closed" | "empty" | "unchanged" | "endorsed";
}> {
  return db.transaction(async (tx) => {
    const draft = await draftOf(tx, change.collegeId, draftId);
    if (typeof draft === "string") return { status: draft };
    if (draft.endorsedAt) return { status: "unchanged" };
    if ((await itemCount(tx, draftId)) === 0) return { status: "empty" };
    await tx
      .update(frameworks)
      .set({
        endorsedBy: change.actorId,
        endorsedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(eq(frameworks.id, draftId));
    await audit(tx, change, "framework.endorse", draftId, {
      to: { termId: draft.termId, version: draft.version },
    });
    return { status: "endorsed" };
  });
}

// Publishes a draft: it becomes the term's framework and never changes again. Where the college asks
// for the dean's endorsement, a draft without it stays a draft.
export async function publishDraft(
  draftId: string,
  change: Change,
  needsEndorsement: boolean,
  db: Db = getDb(),
): Promise<{
  status: "notDraft" | "closed" | "empty" | "notEndorsed" | "published";
}> {
  return db.transaction(async (tx) => {
    const draft = await draftOf(tx, change.collegeId, draftId);
    if (typeof draft === "string") return { status: draft };
    const items = await itemCount(tx, draftId);
    if (items === 0) return { status: "empty" };
    if (needsEndorsement && !draft.endorsedAt) return { status: "notEndorsed" };
    await tx
      .update(frameworks)
      .set({
        status: "published",
        publishedBy: change.actorId,
        publishedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(eq(frameworks.id, draftId));
    await audit(tx, change, "framework.publish", draftId, {
      to: { termId: draft.termId, version: draft.version, items },
    });
    return { status: "published" };
  });
}

// The Step 13 wizard's part: the next term starts with a draft of the framework the term it opens
// from holds, its latest published version or else its draft. Inside the wizard's transaction.
export async function copyFrameworkInto(
  tx: Tx,
  fromTermId: string,
  toTermId: string,
  change: Change,
) {
  const [source] = await tx
    .select({ id: frameworks.id })
    .from(frameworks)
    .where(
      and(
        eq(frameworks.collegeId, change.collegeId),
        eq(frameworks.termId, fromTermId),
      ),
    )
    .orderBy(
      sql`${frameworks.status} = 'published' desc`,
      desc(frameworks.version),
    )
    .limit(1);
  if (!source) return 0;
  const [{ id }] = await tx
    .insert(frameworks)
    .values({ collegeId: change.collegeId, termId: toTermId, version: 1 })
    .returning({ id: frameworks.id });
  const copied = await copyItems(tx, source.id, id);
  await audit(tx, change, "framework.create", id, {
    to: { termId: toTermId, version: 1, items: copied },
  });
  return copied;
}

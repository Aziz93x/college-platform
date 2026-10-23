import { and, asc, eq, sql } from "drizzle-orm";
import { type Db, getDb, type Tx } from "../../../platform/db/client.ts";
import {
  deleteMembership,
  insertMembership,
  roleHolders,
  roleLabel,
  roles,
} from "../../access/index.ts";
import { writeAudit } from "../../audit/index.ts";
import { people, users } from "../../identity/index.ts";
import { departments } from "../../org/index.ts";
import { getSetting } from "../../settings/index.ts";
import { terms } from "../../terms/index.ts";
import type { AssignmentInput } from "../domain/inputs.ts";
import {
  assignments,
  assignmentTemplateItems,
  assignmentTemplates,
} from "./schema.ts";
import type { Change } from "./templates.ts";

const audit = (
  tx: Tx,
  change: Change,
  action: "assignment.create" | "assignment.revoke",
  id: string,
  diff: Record<string, unknown>,
) =>
  writeAudit(
    {
      collegeId: change.collegeId,
      actorId: change.actorId,
      action,
      entityType: "assignment",
      entityId: id,
      diff,
      ip: change.ip,
      userAgent: change.userAgent,
    },
    tx,
  );

// The weeks an assignment covers, for its events: none for the whole term.
const range = (weeks: { from: number | null; to: number | null }) =>
  weeks.from === null ? {} : { fromWeek: weeks.from, toWeek: weeks.to };

// A department's assignments in a term, by template and then by name: whom each template is given
// to, the weeks it covers, none for the whole term, and whether it gave them its template's role.
export async function termAssignments(
  collegeId: string,
  termId: string,
  departmentId: string,
  db: Db = getDb(),
) {
  return db
    .select({
      id: assignments.id,
      templateId: assignments.templateId,
      userId: assignments.userId,
      name: users.name,
      employeeNumber: people.employeeNumber,
      fromWeek: assignments.fromWeek,
      toWeek: assignments.toWeek,
      granted: sql<boolean>`${assignments.membershipId} is not null`,
    })
    .from(assignments)
    .innerJoin(users, eq(users.id, assignments.userId))
    .innerJoin(people, eq(people.userId, assignments.userId))
    .where(
      and(
        eq(assignments.collegeId, collegeId),
        eq(assignments.termId, termId),
        eq(assignments.departmentId, departmentId),
      ),
    )
    .orderBy(asc(assignments.templateId), asc(users.name), asc(users.id));
}

// An assignment of the college, with the term and the department its action checks the key in.
export async function findAssignment(
  collegeId: string,
  id: string,
  db: Db = getDb(),
) {
  const [assignment] = await db
    .select({
      id: assignments.id,
      termId: assignments.termId,
      departmentId: assignments.departmentId,
    })
    .from(assignments)
    .where(and(eq(assignments.collegeId, collegeId), eq(assignments.id, id)));
  return assignment;
}

// Gives a template, one every department shares or the department's own, to people who hold a role
// in the department, for a term not closed: the whole term, or from a week to a week of it (the
// owner's answers, 23 October 2026). Each records assignment.create. A template that grants a role
// gives it to each of them in the department for the term, through a membership the assignment
// keeps. Someone the template is given to already keeps their assignment as it is.
export async function assign(
  input: AssignmentInput,
  change: Change,
  db: Db = getDb(),
): Promise<
  | { status: "notFound" | "closed" | "outsideTerm" | "notMember" }
  | { status: "assigned"; added: number; held: number }
> {
  // Before the transaction, which holds its connection (lead review B).
  const language = await getSetting(
    "locale.language",
    { collegeId: change.collegeId },
    db,
  );
  return db.transaction(async (tx) => {
    const { collegeId } = change;
    const [term] = await tx
      .select({ status: terms.status, weeks: terms.weeks })
      .from(terms)
      .where(and(eq(terms.collegeId, collegeId), eq(terms.id, input.termId)));
    const [department] = await tx
      .select({ name: departments.name, active: departments.active })
      .from(departments)
      .where(
        and(
          eq(departments.collegeId, collegeId),
          eq(departments.id, input.departmentId),
        ),
      );
    const [template] = await tx
      .select({
        title: assignmentTemplates.title,
        departmentId: assignmentTemplates.departmentId,
        roleId: roles.id,
        roleKey: roles.key,
        roleLabels: roles.labels,
      })
      .from(assignmentTemplates)
      .leftJoin(roles, eq(roles.id, assignmentTemplates.grantsRoleId))
      .where(
        and(
          eq(assignmentTemplates.collegeId, collegeId),
          eq(assignmentTemplates.id, input.templateId),
        ),
      );
    if (
      !term ||
      !department?.active ||
      !template ||
      (template.departmentId !== null &&
        template.departmentId !== input.departmentId)
    ) {
      return { status: "notFound" };
    }
    if (term.status === "closed") return { status: "closed" };
    if (input.weeks && input.weeks.to > term.weeks) {
      return { status: "outsideTerm" };
    }
    const members = new Set(
      (await roleHolders(collegeId, tx))
        .filter(({ departmentId }) => departmentId === input.departmentId)
        .map(({ userId }) => userId),
    );
    if (!input.userIds.every((userId) => members.has(userId))) {
      return { status: "notMember" };
    }

    const weeks = {
      from: input.weeks?.from ?? null,
      to: input.weeks?.to ?? null,
    };
    let added = 0;
    for (const userId of input.userIds) {
      const [row] = await tx
        .insert(assignments)
        .values({
          collegeId,
          termId: input.termId,
          departmentId: input.departmentId,
          templateId: input.templateId,
          userId,
          fromWeek: weeks.from,
          toWeek: weeks.to,
        })
        .onConflictDoNothing()
        .returning({ id: assignments.id });
      if (!row) continue;
      added += 1;
      await audit(tx, change, "assignment.create", row.id, {
        to: {
          termId: input.termId,
          departmentId: input.departmentId,
          title: template.title,
          userId,
          ...range(weeks),
        },
      });
      if (template.roleId && template.roleKey && template.roleLabels) {
        const membershipId = await insertMembership(
          tx,
          {
            userId,
            roleId: template.roleId,
            departmentId: input.departmentId,
            termId: input.termId,
          },
          {
            key: template.roleKey,
            label: roleLabel(template.roleLabels, language),
          },
          department.name,
          change,
        );
        if (membershipId) {
          await tx
            .update(assignments)
            .set({ membershipId })
            .where(eq(assignments.id, row.id));
        }
      }
    }
    return {
      status: "assigned",
      added,
      held: input.userIds.length - added,
    };
  });
}

// Takes an assignment back, while its term is not closed, and records assignment.revoke: the role
// it gave goes with the membership it added, and its tasks not started are cancelled by the next
// pass, while work started or finished stays.
export async function revokeAssignment(
  id: string,
  change: Change,
  db: Db = getDb(),
): Promise<
  { status: "notFound" | "closed" } | { status: "revoked"; termId: string }
> {
  // Before the transaction, as in assign().
  const language = await getSetting(
    "locale.language",
    { collegeId: change.collegeId },
    db,
  );
  return db.transaction(async (tx) => {
    const [assignment] = await tx
      .select({
        termId: assignments.termId,
        departmentId: assignments.departmentId,
        userId: assignments.userId,
        fromWeek: assignments.fromWeek,
        toWeek: assignments.toWeek,
        membershipId: assignments.membershipId,
        title: assignmentTemplates.title,
        termStatus: terms.status,
      })
      .from(assignments)
      .innerJoin(
        assignmentTemplates,
        eq(assignmentTemplates.id, assignments.templateId),
      )
      .innerJoin(terms, eq(terms.id, assignments.termId))
      .where(
        and(
          eq(assignments.collegeId, change.collegeId),
          eq(assignments.id, id),
        ),
      )
      .for("update", { of: assignments });
    if (!assignment) return { status: "notFound" };
    if (assignment.termStatus === "closed") return { status: "closed" };
    await tx.delete(assignments).where(eq(assignments.id, id));
    if (assignment.membershipId) {
      await deleteMembership(tx, assignment.membershipId, change, language);
    }
    await audit(tx, change, "assignment.revoke", id, {
      from: {
        termId: assignment.termId,
        departmentId: assignment.departmentId,
        title: assignment.title,
        userId: assignment.userId,
        ...range({ from: assignment.fromWeek, to: assignment.toWeek }),
      },
    });
    return { status: "revoked", termId: assignment.termId };
  });
}

// Each item of each assignment of a term, with the person and department it reaches, the week its
// assignment ends in, none for the term's end, and its template's axis: what the generation engine
// makes tasks of beside the framework's and the plans' (Step 21).
export function assignedItems(
  collegeId: string,
  termId: string,
  db: Db | Tx = getDb(),
) {
  return db
    .select({
      departmentId: assignments.departmentId,
      userId: assignments.userId,
      toWeek: assignments.toWeek,
      origin: assignmentTemplateItems.id,
      title: assignmentTemplateItems.title,
      axisId: assignmentTemplates.axisId,
      kind: assignmentTemplateItems.kind,
      evidence: assignmentTemplateItems.evidence,
    })
    .from(assignments)
    .innerJoin(
      assignmentTemplates,
      eq(assignmentTemplates.id, assignments.templateId),
    )
    .innerJoin(
      assignmentTemplateItems,
      eq(assignmentTemplateItems.templateId, assignments.templateId),
    )
    .where(
      and(eq(assignments.collegeId, collegeId), eq(assignments.termId, termId)),
    )
    .orderBy(asc(assignments.id), asc(assignmentTemplateItems.position));
}

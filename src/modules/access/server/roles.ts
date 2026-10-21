import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { type Db, getDb, type Tx } from "../../../platform/db/client.ts";
import { writeAudit } from "../../audit/index.ts";
import { people, users } from "../../identity/index.ts";
import { notify } from "../../notifications/index.ts";
import { colleges, departments } from "../../org/index.ts";
import { getSetting } from "../../settings/index.ts";
import type {
  MembershipInput,
  RoleInput,
  RolePermissionsInput,
} from "../domain/inputs.ts";
import { roleLabel } from "../domain/labels.ts";
import {
  isPermissionKey,
  type PermissionKey,
  permissionKeys,
} from "../domain/permissions.ts";
import { memberships, rolePermissions, roles } from "./schema.ts";

// Who changes the roles, for the audit event. The caller has authorized them.
type Change = {
  collegeId: string;
  actorId: string;
  ip?: string | null;
  userAgent?: string | null;
};

export type Role = {
  id: string;
  key: string;
  // The role's name in each language, keyed by language code.
  labels: Record<string, string>;
  system: boolean;
  // The keys it holds; the system role holds every key in code.
  permissions: PermissionKey[];
};

// Someone who holds the role, and where: across the college (no department) or in one department.
export type Member = {
  id: string;
  userId: string;
  name: string;
  employeeNumber: string;
  departmentId: string | null;
};

const roleColumns = {
  id: roles.id,
  key: roles.key,
  labels: roles.labels,
  system: roles.system,
};

async function permissionsOf(
  rows: { id: string; system: boolean }[],
  db: Db | Tx,
) {
  const stored =
    rows.length === 0
      ? []
      : await db
          .select({
            roleId: rolePermissions.roleId,
            permission: rolePermissions.permission,
          })
          .from(rolePermissions)
          .where(
            inArray(
              rolePermissions.roleId,
              rows.map((row) => row.id),
            ),
          );
  return (row: { id: string; system: boolean }): PermissionKey[] =>
    row.system
      ? permissionKeys
      : permissionKeys.filter((key) =>
          stored.some(
            (held) => held.roleId === row.id && held.permission === key,
          ),
        );
}

// The college's roles, the system role first, then in the order they were made, with how many
// people hold each.
export async function listRoles(collegeId: string, db: Db = getDb()) {
  const rows = await db
    .select(roleColumns)
    .from(roles)
    .where(eq(roles.collegeId, collegeId))
    .orderBy(desc(roles.system), asc(roles.createdAt), asc(roles.id));
  const held = await permissionsOf(rows, db);
  const counts =
    rows.length === 0
      ? []
      : await db
          .select({ roleId: memberships.roleId, members: count() })
          .from(memberships)
          .where(
            inArray(
              memberships.roleId,
              rows.map((row) => row.id),
            ),
          )
          .groupBy(memberships.roleId);
  return rows.map((row) => ({
    ...row,
    permissions: held(row),
    members: counts.find((each) => each.roleId === row.id)?.members ?? 0,
  }));
}

// One role of the college with the people who hold it, by name; undefined for an id that is not
// one of the college's roles.
export async function findRole(
  collegeId: string,
  id: string,
  db: Db | Tx = getDb(),
): Promise<(Role & { members: Member[] }) | undefined> {
  const [row] = await db
    .select(roleColumns)
    .from(roles)
    .where(and(eq(roles.collegeId, collegeId), eq(roles.id, id)));
  if (!row) return undefined;
  const members = await db
    .select({
      id: memberships.id,
      userId: memberships.userId,
      name: users.name,
      employeeNumber: people.employeeNumber,
      departmentId: memberships.departmentId,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .innerJoin(people, eq(people.userId, memberships.userId))
    .where(eq(memberships.roleId, id))
    .orderBy(asc(users.name), asc(memberships.id));
  return {
    ...row,
    permissions: (await permissionsOf([row], db))(row),
    members,
  };
}

// One change to the college's role names at a time, so two admins cannot both give the same name.
async function lockCollege(tx: Tx, collegeId: string) {
  await tx
    .select({ id: colleges.id })
    .from(colleges)
    .where(eq(colleges.id, collegeId))
    .for("update");
}

async function labelTaken(
  tx: Tx,
  collegeId: string,
  language: string,
  label: string,
  except?: string,
) {
  const [taken] = await tx
    .select({ id: roles.id })
    .from(roles)
    .where(
      and(
        eq(roles.collegeId, collegeId),
        sql`${roles.labels} ->> ${language} = ${label}`,
        except ? ne(roles.id, except) : undefined,
      ),
    )
    .limit(1);
  return taken !== undefined;
}

// Adds a role holding no key, named in the college's language, and records role.create. Its key
// is made here: the grid names a role by its label, and only the page order reads its key.
export async function createRole(
  input: RoleInput,
  language: string,
  change: Change,
  db: Db = getDb(),
): Promise<{ status: "created"; id: string } | { status: "labelTaken" }> {
  return db.transaction(async (tx) => {
    await lockCollege(tx, change.collegeId);
    if (await labelTaken(tx, change.collegeId, language, input.label)) {
      return { status: "labelTaken" };
    }
    const key = `custom-${randomUUID().slice(0, 8)}`;
    const labels = { [language]: input.label };
    const [{ id }] = await tx
      .insert(roles)
      .values({ collegeId: change.collegeId, key, labels })
      .returning({ id: roles.id });
    await writeAudit(
      {
        collegeId: change.collegeId,
        actorId: change.actorId,
        action: "role.create",
        entityType: "role",
        entityId: id,
        diff: { to: { key, labels } },
        ip: change.ip,
        userAgent: change.userAgent,
      },
      tx,
    );
    return { status: "created", id };
  });
}

// Renames a role in the college's language and records role.update with its names before and
// after. The same name writes nothing.
export async function renameRole(
  id: string,
  input: RoleInput,
  language: string,
  change: Change,
  db: Db = getDb(),
): Promise<{ status: "saved" | "unchanged" | "notFound" | "labelTaken" }> {
  return db.transaction(async (tx) => {
    await lockCollege(tx, change.collegeId);
    const [role] = await tx
      .select({ labels: roles.labels })
      .from(roles)
      .where(and(eq(roles.collegeId, change.collegeId), eq(roles.id, id)));
    if (!role) return { status: "notFound" };
    if (role.labels[language] === input.label) return { status: "unchanged" };
    if (await labelTaken(tx, change.collegeId, language, input.label, id)) {
      return { status: "labelTaken" };
    }
    const labels = { ...role.labels, [language]: input.label };
    await tx
      .update(roles)
      .set({ labels, updatedAt: sql`now()` })
      .where(eq(roles.id, id));
    await writeAudit(
      {
        collegeId: change.collegeId,
        actorId: change.actorId,
        action: "role.update",
        entityType: "role",
        entityId: id,
        diff: { from: { labels: role.labels }, to: { labels } },
        ip: change.ip,
        userAgent: change.userAgent,
      },
      tx,
    );
    return { status: "saved" };
  });
}

// Gives a role exactly these keys and records role.update with the keys before and after; the
// next request of everyone who holds the role reads them. The system role's keys are not data.
export async function setRolePermissions(
  id: string,
  input: RolePermissionsInput,
  change: Change,
  db: Db = getDb(),
): Promise<{ status: "saved" | "unchanged" | "notFound" | "system" }> {
  return db.transaction(async (tx) => {
    const [role] = await tx
      .select({ id: roles.id, system: roles.system })
      .from(roles)
      .where(and(eq(roles.collegeId, change.collegeId), eq(roles.id, id)))
      .for("update");
    if (!role) return { status: "notFound" };
    if (role.system) return { status: "system" };
    const stored = await tx
      .select({ permission: rolePermissions.permission })
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, id));
    const from = stored
      .map((row) => row.permission)
      .filter(isPermissionKey)
      .sort();
    const to = [...input.permissions].sort();
    if (
      from.length === to.length &&
      stored.length === from.length &&
      from.every((key, index) => key === to[index])
    ) {
      return { status: "unchanged" };
    }
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
    if (to.length > 0) {
      await tx
        .insert(rolePermissions)
        .values(to.map((permission) => ({ roleId: id, permission })));
    }
    await writeAudit(
      {
        collegeId: change.collegeId,
        actorId: change.actorId,
        action: "role.update",
        entityType: "role",
        entityId: id,
        diff: { from: { permissions: from }, to: { permissions: to } },
        ip: change.ip,
        userAgent: change.userAgent,
      },
      tx,
    );
    return { status: "saved" };
  });
}

// Gives a person of the college a role, across the college or in one of its active departments,
// and records membership.create. Holding it there already changes nothing. The system role is held
// across the college only, so its members are always the college's admins.
export async function addMembership(
  input: MembershipInput,
  change: Change,
  db: Db = getDb(),
): Promise<
  | { status: "added"; id: string }
  | { status: "exists" | "notFound" | "collegeOnly" | "inactive" }
> {
  return db.transaction(async (tx) => {
    const [role] = await tx
      .select({ key: roles.key, labels: roles.labels, system: roles.system })
      .from(roles)
      .where(
        and(eq(roles.collegeId, change.collegeId), eq(roles.id, input.roleId)),
      )
      .for("update");
    const [person] = await tx
      .select({ userId: people.userId })
      .from(people)
      .where(
        and(
          eq(people.collegeId, change.collegeId),
          eq(people.userId, input.userId),
        ),
      );
    const [department] = input.departmentId
      ? await tx
          .select({ name: departments.name, active: departments.active })
          .from(departments)
          .where(
            and(
              eq(departments.collegeId, change.collegeId),
              eq(departments.id, input.departmentId),
            ),
          )
      : [{ name: null, active: true }];
    if (!role || !person || !department) return { status: "notFound" };
    if (role.system && input.departmentId) return { status: "collegeOnly" };
    // A department set aside keeps what was recorded for it, and takes no new member.
    if (!department.active) return { status: "inactive" };
    const language = await getSetting(
      "locale.language",
      { collegeId: change.collegeId },
      db,
    );
    const id = await insertMembership(
      tx,
      input,
      { key: role.key, label: roleLabel(role.labels, language) },
      department.name,
      change,
    );
    return id ? { status: "added", id } : { status: "exists" };
  });
}

// A role and where it is held, as the notification to its holder names them.
function held(role: string, department: string | null) {
  return department === null
    ? { role, scope: "college" as const }
    : { role, scope: "department" as const, department };
}

// A membership its caller has checked, with its membership.create event and the notification to its
// holder, inside the caller's transaction. The role comes with its name in the college's language,
// and the department, if any, by its name. Holding the role in that scope already adds nothing:
// undefined.
export async function insertMembership(
  tx: Tx,
  input: MembershipInput,
  role: { key: string; label: string },
  department: string | null,
  change: Change,
) {
  const [row] = await tx
    .insert(memberships)
    .values({ ...input, collegeId: change.collegeId })
    .onConflictDoNothing()
    .returning({ id: memberships.id });
  if (!row) return undefined;
  await writeAudit(
    {
      collegeId: change.collegeId,
      actorId: change.actorId,
      action: "membership.create",
      entityType: "membership",
      entityId: row.id,
      diff: {
        to: {
          userId: input.userId,
          role: role.key,
          departmentId: input.departmentId,
        },
      },
      ip: change.ip,
      userAgent: change.userAgent,
    },
    tx,
  );
  await notify(
    {
      collegeId: change.collegeId,
      userId: input.userId,
      kind: "membershipAdded",
      params: held(role.label, department),
    },
    tx,
  );
  return row.id;
}

// Takes a role from a person in one scope and records membership.delete. The system role keeps at
// least one member: its last one cannot be removed, by anyone, themselves included.
export async function removeMembership(
  id: string,
  change: Change,
  db: Db = getDb(),
): Promise<{ status: "removed" | "notFound" | "lastAdmin" }> {
  return db.transaction(async (tx) => {
    const [membership] = await tx
      .select({
        roleId: memberships.roleId,
        userId: memberships.userId,
        departmentId: memberships.departmentId,
      })
      .from(memberships)
      .where(
        and(
          eq(memberships.collegeId, change.collegeId),
          eq(memberships.id, id),
        ),
      );
    if (!membership) return { status: "notFound" };
    // Locks the role, so two removals at once cannot both leave the other one as the last member.
    const [role] = await tx
      .select({ key: roles.key, labels: roles.labels, system: roles.system })
      .from(roles)
      .where(eq(roles.id, membership.roleId))
      .for("update");
    if (role.system) {
      const [{ members }] = await tx
        .select({ members: count() })
        .from(memberships)
        .where(eq(memberships.roleId, membership.roleId));
      if (members <= 1) return { status: "lastAdmin" };
    }
    const [removed] = await tx
      .delete(memberships)
      .where(eq(memberships.id, id))
      .returning({ id: memberships.id });
    if (!removed) return { status: "notFound" };
    await writeAudit(
      {
        collegeId: change.collegeId,
        actorId: change.actorId,
        action: "membership.delete",
        entityType: "membership",
        entityId: id,
        diff: {
          from: {
            userId: membership.userId,
            role: role.key,
            departmentId: membership.departmentId,
          },
        },
        ip: change.ip,
        userAgent: change.userAgent,
      },
      tx,
    );
    const [department] = membership.departmentId
      ? await tx
          .select({ name: departments.name })
          .from(departments)
          .where(eq(departments.id, membership.departmentId))
      : [{ name: null }];
    const language = await getSetting(
      "locale.language",
      { collegeId: change.collegeId },
      db,
    );
    await notify(
      {
        collegeId: change.collegeId,
        userId: membership.userId,
        kind: "membershipRemoved",
        params: held(roleLabel(role.labels, language), department.name),
      },
      tx,
    );
    return { status: "removed" };
  });
}

// Gives a person a role of their college, found by its key or as the system role, across the
// college or in one department; holding it there already changes nothing. For pnpm admin:create,
// the seeds and the end-to-end tests, which record what they do themselves or nothing at all; the
// grid goes through addMembership.
export async function joinRole(
  member: {
    userId: string;
    collegeId: string;
    role: { system: true } | { key: string };
    departmentId?: string | null;
  },
  db: Db | Tx = getDb(),
) {
  const [role] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(
      and(
        eq(roles.collegeId, member.collegeId),
        "system" in member.role
          ? eq(roles.system, true)
          : eq(roles.key, member.role.key),
      ),
    );
  if (!role)
    throw new Error(`joinRole: no such role in college ${member.collegeId}`);
  await db
    .insert(memberships)
    .values({
      userId: member.userId,
      roleId: role.id,
      collegeId: member.collegeId,
      departmentId: member.departmentId ?? null,
    })
    .onConflictDoNothing();
}

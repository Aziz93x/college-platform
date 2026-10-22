import { and, eq, inArray } from "drizzle-orm";
import { type Db, getDb, type Tx } from "../../../platform/db/client.ts";
import { foldCase, oneLine } from "../../../platform/validation/text.ts";
import { writeAudit } from "../../audit/index.ts";
import {
  createAccount,
  people,
  personInput,
  users,
} from "../../identity/index.ts";
import {
  colleges,
  departmentRayatValues,
  departments,
} from "../../org/index.ts";
import { getSetting } from "../../settings/index.ts";
import { roleLabel } from "../domain/labels.ts";
import type { PeopleRow } from "../domain/people-file.ts";
import { insertMembership } from "./roles.ts";
import { memberships, roles } from "./schema.ts";

type Change = {
  collegeId: string;
  actorId: string;
  ip?: string | null;
  userAgent?: string | null;
};

// Why a row of a people file cannot be imported as it is.
export type RowError =
  // Not a name, an email address or an employee number.
  | "name"
  | "email"
  | "employeeNumber"
  // An earlier row of the file has the employee number with another email, or the email with
  // another employee number. Rows with both the same are one person, for each of their roles.
  | "repeated"
  // The employee number is someone else's in the college, with another email; or the email is
  // another account's.
  | "employeeNumberTaken"
  | "emailTaken"
  // The department matches none of the college's, or one set aside.
  | "department"
  | "departmentInactive"
  // The role matches none of the college's; is the system role, given on the roles page only; or
  // the importer may not give roles (roles.manage).
  | "role"
  | "systemRole"
  | "roleNotAllowed"
  // A department says where a role is held, so it needs one.
  | "departmentWithoutRole";

// What importing a row does: a new account; a role for someone the college has already; nothing,
// since the person and the role are there; or nothing, for the errors it lists.
export type PlannedRow = {
  line: number;
  name: string;
  email: string;
  employeeNumber: string;
  department: { id: string; name: string } | null;
  role: { id: string; key: string; label: string } | null;
  outcome: "new" | "roleAdded" | "unchanged" | "invalid";
  errors: RowError[];
  // The person the row names, when the college has them already.
  userId?: string;
};

const key = (text: string) => foldCase(oneLine(text));

// Each row's outcome against the college as it is now, without writing anything: the preview, and
// the plan an import carries out. A department matches its name, short name or a Rayat value, and
// a role its name in the college's language or its key, all in any Latin case (docs/PLAN.md,
// Steps 8 and 10).
export async function planPeopleImport(
  collegeId: string,
  rows: readonly PeopleRow[],
  options: { canGiveRoles: boolean },
  db: Db | Tx = getDb(),
): Promise<PlannedRow[]> {
  // One read after another: an import passes its transaction, one connection, which pg 9 will
  // refuse two queries at once (Audit 4).
  const departmentRows = await db
    .select({
      id: departments.id,
      name: departments.name,
      shortName: departments.shortName,
      active: departments.active,
    })
    .from(departments)
    .where(eq(departments.collegeId, collegeId));
  const valueRows = await db
    .select({
      departmentId: departmentRayatValues.departmentId,
      value: departmentRayatValues.value,
    })
    .from(departmentRayatValues)
    .where(eq(departmentRayatValues.collegeId, collegeId));
  const roleRows = await db
    .select({
      id: roles.id,
      key: roles.key,
      labels: roles.labels,
      system: roles.system,
    })
    .from(roles)
    .where(eq(roles.collegeId, collegeId));
  const language = await getSetting("locale.language", { collegeId });
  const departmentByText = new Map<string, (typeof departmentRows)[number]>();
  for (const department of departmentRows) {
    departmentByText.set(key(department.name), department);
    departmentByText.set(key(department.shortName), department);
  }
  for (const { departmentId, value } of valueRows) {
    const department = departmentRows.find(({ id }) => id === departmentId);
    if (department) departmentByText.set(key(value), department);
  }
  const roleByText = new Map<string, (typeof roleRows)[number]>();
  for (const role of roleRows) {
    roleByText.set(key(role.key), role);
    roleByText.set(key(roleLabel(role.labels, language)), role);
  }

  const typed = rows.map((row) => personInput.safeParse(row));
  const numbers = typed.flatMap((person) =>
    person.success ? [person.data.employeeNumber] : [],
  );
  const emails = typed.flatMap((person) =>
    person.success ? [person.data.email] : [],
  );
  const byNumber =
    numbers.length === 0
      ? []
      : await db
          .select({
            userId: people.userId,
            employeeNumber: people.employeeNumber,
            email: users.email,
          })
          .from(people)
          .innerJoin(users, eq(users.id, people.userId))
          .where(
            and(
              eq(people.collegeId, collegeId),
              inArray(people.employeeNumber, numbers),
            ),
          );
  const byEmail =
    emails.length === 0
      ? []
      : await db
          .select({ email: users.email })
          .from(users)
          .where(inArray(users.email, emails));
  const held =
    byNumber.length === 0
      ? []
      : await db
          .select({
            userId: memberships.userId,
            roleId: memberships.roleId,
            departmentId: memberships.departmentId,
          })
          .from(memberships)
          .where(
            inArray(
              memberships.userId,
              byNumber.map(({ userId }) => userId),
            ),
          );

  // The people the rows before this one make or name, by employee number, with the roles they
  // will hold.
  const planned = new Map<
    string,
    { email: string; userId?: string; holds: Set<string> }
  >();
  const numberByEmail = new Map<string, string>();
  return rows.map((row, index) => {
    const errors: RowError[] = [];
    const parsed = typed[index];
    const person = parsed.success ? parsed.data : undefined;
    if (!parsed.success) {
      for (const field of new Set(
        parsed.error.issues.map(({ path }) => path[0]),
      )) {
        errors.push(field as "name" | "email" | "employeeNumber");
      }
    }

    let department: PlannedRow["department"] = null;
    if (row.department) {
      const found = departmentByText.get(key(row.department));
      if (!found) errors.push("department");
      else if (!found.active) errors.push("departmentInactive");
      else department = { id: found.id, name: found.name };
    }
    let role: PlannedRow["role"] = null;
    if (row.role) {
      const found = roleByText.get(key(row.role));
      if (!found) errors.push("role");
      else if (found.system) errors.push("systemRole");
      else if (!options.canGiveRoles) errors.push("roleNotAllowed");
      else {
        role = {
          id: found.id,
          key: found.key,
          label: roleLabel(found.labels, language),
        };
      }
    } else if (row.department) {
      errors.push("departmentWithoutRole");
    }

    const earlier = person && planned.get(person.employeeNumber);
    let userId = earlier ? earlier.userId : undefined;
    if (person) {
      const emailOwner = numberByEmail.get(person.email);
      if (
        (earlier && earlier.email !== person.email) ||
        (emailOwner !== undefined && emailOwner !== person.employeeNumber)
      ) {
        errors.push("repeated");
      } else if (!earlier) {
        const existing = byNumber.find(
          ({ employeeNumber }) => employeeNumber === person.employeeNumber,
        );
        if (existing && existing.email !== person.email) {
          errors.push("employeeNumberTaken");
        } else if (existing) {
          userId = existing.userId;
        } else if (byEmail.some(({ email }) => email === person.email)) {
          errors.push("emailTaken");
        }
      }
    }

    const membership = role && `${role.id}:${department?.id ?? null}`;
    let outcome: PlannedRow["outcome"] = "invalid";
    if (person && errors.length === 0) {
      const holds =
        earlier?.holds ??
        new Set(
          held
            .filter((each) => each.userId === userId)
            .map((each) => `${each.roleId}:${each.departmentId}`),
        );
      outcome =
        !earlier && !userId
          ? "new"
          : membership && !holds.has(membership)
            ? "roleAdded"
            : "unchanged";
      if (membership) holds.add(membership);
      planned.set(person.employeeNumber, {
        email: person.email,
        userId,
        holds,
      });
      numberByEmail.set(person.email, person.employeeNumber);
    }
    return {
      line: row.line,
      name: person?.name ?? row.name,
      email: person?.email ?? row.email,
      employeeNumber: person?.employeeNumber ?? row.employeeNumber,
      department,
      role,
      outcome,
      errors,
      ...(userId && { userId }),
    };
  });
}

export type ImportResult = {
  // Each new account with its temporary password, shown once (ADR-0008: no email goes out).
  created: {
    userId: string;
    name: string;
    email: string;
    employeeNumber: string;
    password: string;
  }[];
  rolesAdded: number;
  unchanged: number;
  // The rows left out, with their errors.
  skipped: PlannedRow[];
};

// Imports a people file's rows: plans them again against the college as it is, then makes each new
// person's account (account.create) and gives the rows' roles (membership.create). Rows with errors
// are left out and returned. One import at a time per college, so two cannot make the same person.
export async function importPeople(
  rows: readonly PeopleRow[],
  options: { canGiveRoles: boolean },
  change: Change,
  db: Db = getDb(),
): Promise<ImportResult> {
  return db.transaction(async (tx) => {
    await tx
      .select({ id: colleges.id })
      .from(colleges)
      .where(eq(colleges.id, change.collegeId))
      .for("update");
    const plan = await planPeopleImport(change.collegeId, rows, options, tx);
    const result: ImportResult = {
      created: [],
      rolesAdded: 0,
      unchanged: 0,
      skipped: [],
    };
    // The people this import makes, for their later rows' roles.
    const made = new Map<string, string>();
    for (const row of plan) {
      if (row.outcome === "invalid") {
        result.skipped.push(row);
        continue;
      }
      if (row.outcome === "unchanged") {
        result.unchanged += 1;
        continue;
      }
      let userId = row.userId ?? made.get(row.employeeNumber);
      if (row.outcome === "new") {
        const person = {
          collegeId: change.collegeId,
          name: row.name,
          email: row.email,
          employeeNumber: row.employeeNumber,
        };
        const account = await createAccount(person, tx);
        userId = account.userId;
        made.set(row.employeeNumber, userId);
        await writeAudit(
          {
            collegeId: change.collegeId,
            actorId: change.actorId,
            action: "account.create",
            entityType: "user",
            entityId: account.userId,
            diff: {
              to: {
                name: row.name,
                email: row.email,
                employeeNumber: row.employeeNumber,
              },
            },
            ip: change.ip,
            userAgent: change.userAgent,
          },
          tx,
        );
        result.created.push({
          userId: account.userId,
          name: row.name,
          email: row.email,
          employeeNumber: row.employeeNumber,
          password: account.password,
        });
      } else {
        result.rolesAdded += 1;
      }
      if (row.role && userId) {
        await insertMembership(
          tx,
          {
            userId,
            roleId: row.role.id,
            departmentId: row.department?.id ?? null,
          },
          row.role,
          row.department?.name ?? null,
          change,
        );
      }
    }
    return result;
  });
}

"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import {
  authorize,
  disableAccount,
  importPeople,
  listDirectory,
  MAX_PEOPLE_ROWS,
  type PersonEntry,
  peopleColumns,
  planPeopleImport,
  readPeopleFile,
  viewerAction,
} from "@/modules/access";
import {
  employeeNumber,
  linkEmployeeNumber,
  personEmail,
  personName,
  reauthenticate,
  requestMeta,
  requirePasswordChange,
  resetPassword,
  revokeAllSessions,
  revokeSession,
  turnOffTwoFactor,
  updatePerson,
} from "@/modules/identity";
import { readTable } from "@/platform/files/table";
import { formFields, latinDigits } from "@/platform/validation/form";

// The people of the college and their accounts (Step 10). Adding, importing, correcting and
// disabling need people.manage; a temporary password and a corrected employee number need their own
// keys where the person is (ctx.requireReach), so a head helps their own trainers. Every action on
// someone's account reaches only those whose powers its holder has (lead review B). Every change to
// an account asks for the password again when it was typed too long ago (reauthenticate()), and
// the domain functions write the audit events.

// Typed again on an Arabic keyboard as on a Latin one, as at sign-in.
const password = latinDigits(z.string().min(1).max(128)).optional();

type Viewer = { userId: string; sessionId: string; collegeId: string };

function changeBy(viewer: Viewer, requestHeaders: Headers) {
  return {
    collegeId: viewer.collegeId,
    actorId: viewer.userId,
    ...requestMeta(requestHeaders),
  };
}

async function confirmPassword(
  typed: string | undefined,
  viewer: Viewer,
  requestHeaders: Headers,
) {
  const result = await reauthenticate(typed, viewer, requestHeaders);
  return result.status === "confirmed" ? undefined : result;
}

// The person an action is about, with where they hold their roles, or undefined for an id that is
// no one of the viewer's college.
async function holder(viewer: Viewer, userId: string) {
  const [person] = await listDirectory(viewer.collegeId, { userId });
  return person;
}

// Each column's names in a file's header row: its label in the catalog, and its own name.
async function columnNames() {
  const t = await getTranslations("people.import.columns");
  return Object.fromEntries(
    peopleColumns.map((column) => [column, [t(column), column]]),
  ) as Record<(typeof peopleColumns)[number], string[]>;
}

const fileRow = z.object({
  line: z.int().positive(),
  employeeNumber: z.string().max(200),
  name: z.string().max(500),
  email: z.string().max(500),
  department: z.string().max(500),
  role: z.string().max(500),
});

// A people file read and planned against the college, without writing anything: the preview, which
// is the import's dry run.
export const previewPeopleAction = viewerAction
  .metadata({ name: "previewPeople", permission: "people.manage" })
  .inputSchema(formFields(z.object({ file: z.instanceof(File) })))
  .action(async ({ parsedInput: { file }, ctx: { viewer } }) => {
    const table = await readTable({
      name: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    if (!table) return { status: "unreadable" as const };
    const read = readPeopleFile(table, await columnNames());
    if (read.status !== "read") return read;
    const plan = await planPeopleImport(viewer.collegeId, read.rows, {
      canGiveRoles: authorize(viewer, "roles.manage", {
        collegeId: viewer.collegeId,
      }),
    });
    return { status: "planned" as const, rows: read.rows, plan };
  });

// Imports the rows of a previewed file, or the one person the form adds, as the college stands
// now. Each new account's temporary password comes back once, to hand over.
export const importPeopleAction = viewerAction
  .metadata({ name: "importPeople", permission: "people.manage" })
  .inputSchema(
    z.object({ rows: z.array(fileRow).min(1).max(MAX_PEOPLE_ROWS), password }),
  )
  .action(async ({ parsedInput, ctx: { viewer } }) => {
    const requestHeaders = await headers();
    const refused = await confirmPassword(
      parsedInput.password,
      viewer,
      requestHeaders,
    );
    if (refused) return refused;
    const result = await importPeople(
      parsedInput.rows,
      {
        canGiveRoles: authorize(viewer, "roles.manage", {
          collegeId: viewer.collegeId,
        }),
      },
      changeBy(viewer, requestHeaders),
    );
    if (result.created.length > 0 || result.rolesAdded > 0) refresh();
    return { status: "imported" as const, ...result };
  });

// A temporary password for someone the viewer's key reaches, shown once; one's own password is
// changed on its own page.
export const resetPasswordAction = viewerAction
  .metadata({ name: "resetPassword" })
  .inputSchema(z.object({ userId: z.uuid(), password }))
  .action(async ({ parsedInput, ctx: { viewer, requireReach } }) => {
    const person = await holder(viewer, parsedInput.userId);
    if (!person) return { status: "notFound" as const };
    requireReach("accounts.resetPassword", person);
    if (person.userId === viewer.userId) return { status: "self" as const };
    const requestHeaders = await headers();
    const refused = await confirmPassword(
      parsedInput.password,
      viewer,
      requestHeaders,
    );
    if (refused) return refused;
    const meta = requestMeta(requestHeaders);
    const temporary = await resetPassword(
      { userId: person.userId, collegeId: viewer.collegeId },
      { userId: viewer.userId, ...meta },
    );
    refresh();
    return { status: "reset" as const, temporaryPassword: temporary };
  });

// Turns off the two-factor of someone the viewer's key reaches, for one who lost their phone, with
// the same key and reach as a temporary password (ADR-0014). One's own is turned off on the profile.
export const turnOffTwoFactorAction = viewerAction
  .metadata({ name: "turnOffTwoFactor" })
  .inputSchema(z.object({ userId: z.uuid(), password }))
  .action(async ({ parsedInput, ctx: { viewer, requireReach } }) => {
    const person = await holder(viewer, parsedInput.userId);
    if (!person) return { status: "notFound" as const };
    requireReach("accounts.resetPassword", person);
    if (person.userId === viewer.userId) return { status: "self" as const };
    const requestHeaders = await headers();
    const refused = await confirmPassword(
      parsedInput.password,
      viewer,
      requestHeaders,
    );
    if (refused) return refused;
    const status = await turnOffTwoFactor(
      person.userId,
      changeBy(viewer, requestHeaders),
    );
    if (status === "off") refresh();
    return { status };
  });

export const linkEmployeeNumberAction = viewerAction
  .metadata({ name: "linkEmployeeNumber" })
  .inputSchema(z.object({ userId: z.uuid(), employeeNumber, password }))
  .action(async ({ parsedInput, ctx: { viewer, requireReach } }) => {
    const person = await holder(viewer, parsedInput.userId);
    if (!person) return { status: "notFound" as const };
    requireReach("accounts.linkEmployeeNumber", person);
    const requestHeaders = await headers();
    const refused = await confirmPassword(
      parsedInput.password,
      viewer,
      requestHeaders,
    );
    if (refused) return refused;
    const result = await linkEmployeeNumber(
      person.userId,
      parsedInput.employeeNumber,
      changeBy(viewer, requestHeaders),
    );
    if (result.status === "saved") refresh();
    return result;
  });

export const updatePersonAction = viewerAction
  .metadata({ name: "updatePerson", permission: "people.manage" })
  .inputSchema(
    z.object({
      userId: z.uuid(),
      name: personName,
      email: personEmail,
      password,
    }),
  )
  .action(async ({ parsedInput, ctx: { viewer, requireReach } }) => {
    const person = await holder(viewer, parsedInput.userId);
    if (!person) return { status: "notFound" as const };
    requireReach("people.manage", person);
    const requestHeaders = await headers();
    const refused = await confirmPassword(
      parsedInput.password,
      viewer,
      requestHeaders,
    );
    if (refused) return refused;
    const result = await updatePerson(
      person.userId,
      { name: parsedInput.name, email: parsedInput.email },
      changeBy(viewer, requestHeaders),
    );
    if (result.status === "saved") refresh();
    return result;
  });

export const disableAccountAction = viewerAction
  .metadata({ name: "disableAccount", permission: "people.manage" })
  .inputSchema(z.object({ userId: z.uuid(), disabled: z.boolean(), password }))
  .action(async ({ parsedInput, ctx: { viewer, requireReach } }) => {
    const person = await holder(viewer, parsedInput.userId);
    if (!person) return { status: "notFound" as const };
    requireReach("people.manage", person);
    const requestHeaders = await headers();
    const refused = await confirmPassword(
      parsedInput.password,
      viewer,
      requestHeaders,
    );
    if (refused) return refused;
    const result = await disableAccount(
      person.userId,
      parsedInput.disabled,
      changeBy(viewer, requestHeaders),
    );
    if (result.status === "saved") refresh();
    return result;
  });

// Where someone is signed in, for whoever holds accounts.sessions where they are (ADR-0029): ending
// one of their sessions or all of them, and requiring a new password at their next request. Never
// one's own, which signing out and the profile change.
async function sessionsOf(
  viewer: Viewer,
  userId: string,
  requireReach: (permission: "accounts.sessions", person: PersonEntry) => void,
): Promise<{ status: "notFound" | "self" } | { person: PersonEntry }> {
  const person = await holder(viewer, userId);
  if (!person) return { status: "notFound" };
  requireReach("accounts.sessions", person);
  if (person.userId === viewer.userId) return { status: "self" };
  return { person };
}

export const revokeSessionAction = viewerAction
  .metadata({ name: "revokeSession" })
  .inputSchema(z.object({ userId: z.uuid(), sessionId: z.uuid(), password }))
  .action(async ({ parsedInput, ctx: { viewer, requireReach } }) => {
    const found = await sessionsOf(viewer, parsedInput.userId, requireReach);
    if (!("person" in found)) return found;
    const requestHeaders = await headers();
    const refused = await confirmPassword(
      parsedInput.password,
      viewer,
      requestHeaders,
    );
    if (refused) return refused;
    const status = await revokeSession(
      found.person.userId,
      parsedInput.sessionId,
      changeBy(viewer, requestHeaders),
    );
    if (status === "revoked") refresh();
    return { status };
  });

export const revokeAllSessionsAction = viewerAction
  .metadata({ name: "revokeAllSessions" })
  .inputSchema(z.object({ userId: z.uuid(), password }))
  .action(async ({ parsedInput, ctx: { viewer, requireReach } }) => {
    const found = await sessionsOf(viewer, parsedInput.userId, requireReach);
    if (!("person" in found)) return found;
    const requestHeaders = await headers();
    const refused = await confirmPassword(
      parsedInput.password,
      viewer,
      requestHeaders,
    );
    if (refused) return refused;
    const status = await revokeAllSessions(
      found.person.userId,
      changeBy(viewer, requestHeaders),
    );
    if (status === "revoked") refresh();
    return { status };
  });

export const requirePasswordChangeAction = viewerAction
  .metadata({ name: "requirePasswordChange" })
  .inputSchema(z.object({ userId: z.uuid(), password }))
  .action(async ({ parsedInput, ctx: { viewer, requireReach } }) => {
    const found = await sessionsOf(viewer, parsedInput.userId, requireReach);
    if (!("person" in found)) return found;
    const requestHeaders = await headers();
    const refused = await confirmPassword(
      parsedInput.password,
      viewer,
      requestHeaders,
    );
    if (refused) return refused;
    const status = await requirePasswordChange(
      found.person.userId,
      changeBy(viewer, requestHeaders),
    );
    if (status === "saved") refresh();
    return { status };
  });

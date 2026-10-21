"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import {
  addMembership,
  createRole,
  findRole,
  membershipInput,
  removeMembership,
  renameRole,
  roleInput,
  rolePermissionsInput,
  setRolePermissions,
  viewerAction,
} from "@/modules/access";
import { reauthenticate, requestMeta } from "@/modules/identity";
import { getSetting, setSetting } from "@/modules/settings";
import { latinDigits } from "@/platform/validation/form";
import { navigation } from "../_shell/navigation.ts";

// The roles grid: roles and their names, the keys each holds, who holds them and where, and each
// role's page order. All of it needs roles.manage; what changes someone's access (the keys and the
// members) needs the password again (reauthenticate()). The domain functions write the audit
// events, and after a change the page is drawn again.

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

// A role is named in the college's language.
const languageOf = (viewer: Viewer) =>
  getSetting("locale.language", { collegeId: viewer.collegeId });

export const createRoleAction = viewerAction
  .metadata({ name: "createRole", permission: "roles.manage" })
  .inputSchema(roleInput)
  .action(async ({ parsedInput, ctx: { viewer } }) =>
    createRole(
      parsedInput,
      await languageOf(viewer),
      changeBy(viewer, await headers()),
    ),
  );

export const renameRoleAction = viewerAction
  .metadata({ name: "renameRole", permission: "roles.manage" })
  .inputSchema(roleInput.extend({ id: z.uuid() }))
  .action(async ({ parsedInput: { id, ...input }, ctx: { viewer } }) => {
    const result = await renameRole(
      id,
      input,
      await languageOf(viewer),
      changeBy(viewer, await headers()),
    );
    if (result.status === "saved") refresh();
    return result;
  });

export const setRolePermissionsAction = viewerAction
  .metadata({ name: "setRolePermissions", permission: "roles.manage" })
  .inputSchema(rolePermissionsInput.extend({ id: z.uuid(), password }))
  .action(async ({ parsedInput, ctx: { viewer } }) => {
    const requestHeaders = await headers();
    const refused = await confirmPassword(
      parsedInput.password,
      viewer,
      requestHeaders,
    );
    if (refused) return refused;
    const result = await setRolePermissions(
      parsedInput.id,
      { permissions: parsedInput.permissions },
      changeBy(viewer, requestHeaders),
    );
    if (result.status === "saved") refresh();
    return result;
  });

export const addMembershipAction = viewerAction
  .metadata({ name: "addMembership", permission: "roles.manage" })
  .inputSchema(membershipInput.extend({ password }))
  .action(
    async ({ parsedInput: { password: typed, ...input }, ctx: { viewer } }) => {
      const requestHeaders = await headers();
      const refused = await confirmPassword(typed, viewer, requestHeaders);
      if (refused) return refused;
      const result = await addMembership(
        input,
        changeBy(viewer, requestHeaders),
      );
      if (result.status === "added") refresh();
      return result;
    },
  );

export const removeMembershipAction = viewerAction
  .metadata({ name: "removeMembership", permission: "roles.manage" })
  .inputSchema(z.object({ id: z.uuid(), password }))
  .action(async ({ parsedInput, ctx: { viewer } }) => {
    const requestHeaders = await headers();
    const refused = await confirmPassword(
      parsedInput.password,
      viewer,
      requestHeaders,
    );
    if (refused) return refused;
    const result = await removeMembership(
      parsedInput.id,
      changeBy(viewer, requestHeaders),
    );
    if (result.status === "removed") refresh();
    return result;
  });

// The order of a role's pages: the shell's page ids, each once. Kept in navigation.order by the
// role's key, beside every other role's order.
export const savePageOrderAction = viewerAction
  .metadata({ name: "savePageOrder", permission: "roles.manage" })
  .inputSchema(
    z.object({
      roleId: z.uuid(),
      order: z
        .array(z.enum(navigation.map((item) => item.id)))
        .refine((ids) => new Set(ids).size === ids.length),
    }),
  )
  .action(async ({ parsedInput, ctx: { viewer } }) => {
    const role = await findRole(viewer.collegeId, parsedInput.roleId);
    if (!role) return { status: "notFound" as const };
    // Merged into the orders in force when it is saved, so another role's order saved at the same
    // time stays.
    const result = await setSetting(
      "navigation.order",
      (orders) => ({ ...orders, [role.key]: parsedInput.order }),
      changeBy(viewer, await headers()),
    );
    if (result.status === "saved") refresh();
    return result;
  });

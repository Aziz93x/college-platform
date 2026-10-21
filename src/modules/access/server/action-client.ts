import { createSafeActionClient } from "next-safe-action";
import { z } from "zod";
import { getSessionUser } from "../../identity/index.ts";
import {
  authorize,
  permittedDepartments,
  type Scope,
} from "../domain/authorize.ts";
import { type PermissionKey, permissionKeys } from "../domain/permissions.ts";
import { getViewer } from "./viewer.ts";

// Why an action was refused, as a message key under "actions" in messages/*.json.
type Refusal = "signedOut" | "forbidden" | "unexpected";

class RefusedError extends Error {
  readonly refusal: Refusal;
  constructor(refusal: Refusal) {
    super(refusal);
    this.refusal = refusal;
  }
}

// Every server action names itself and, unless anyone may call it, the permission it needs; its
// input passes a Zod schema, and the domain function it calls writes the audit event.
const actionClient = createSafeActionClient({
  defineMetadataSchema: () =>
    z.object({
      name: z.string(),
      permission: z
        .enum(permissionKeys as [PermissionKey, ...PermissionKey[]])
        .optional(),
    }),
  handleServerError: async (error, { metadata }): Promise<Refusal> => {
    if (error instanceof RefusedError) return error.refusal;
    // Imported on call: db/ scripts load this module with plain Node, which cannot resolve
    // "next/headers". The request logger puts the request's id on the line.
    const { getRequestLogger } = await import(
      "../../../platform/logging/request-logger.ts"
    );
    (await getRequestLogger()).error(
      { err: error, action: metadata?.name },
      "server action failed",
    );
    return "unexpected";
  },
});

// Signing in: anyone may try.
export const publicAction = actionClient;

// For a signed-in person whatever is still pending: replacing a temporary password, setting up
// two-factor, signing out.
export const signedInAction = actionClient.use(async ({ next }) => {
  const user = await getSessionUser();
  if (!user) throw new RefusedError("signedOut");
  return next({ ctx: { user } });
});

// Everything else: a viewer with nothing pending, holding the action's permission across their
// college. An action whose permission or scope depends on its input, such as the setting it
// changes or the department it touches, names none in its metadata and calls
// ctx.requirePermission with the scope, which refuses it the same way; a list keeps to
// ctx.departmentsFor.
export const viewerAction = actionClient.use(async ({ next, metadata }) => {
  const viewer = await getViewer();
  if (!viewer || viewer.mustChangePassword || viewer.needsTwoFactorSetup) {
    throw new RefusedError("signedOut");
  }
  const requirePermission = (
    permission: PermissionKey,
    scope: Omit<Scope, "collegeId"> = {},
  ) => {
    if (
      !authorize(viewer, permission, { ...scope, collegeId: viewer.collegeId })
    ) {
      throw new RefusedError("forbidden");
    }
  };
  const departmentsFor = (permission: PermissionKey) =>
    permittedDepartments(viewer, permission);
  if (metadata.permission) requirePermission(metadata.permission);
  return next({ ctx: { viewer, requirePermission, departmentsFor } });
});

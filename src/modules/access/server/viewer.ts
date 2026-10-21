import { cache } from "react";
import { getSessionUser, type SessionUser } from "../../identity/index.ts";
import type { Actor } from "../domain/authorize.ts";
import {
  type PermissionKey,
  requiresTwoFactor,
} from "../domain/permissions.ts";
import { loadAccess } from "./load-access.ts";

type Viewer = SessionUser &
  Actor & {
    // Every key the viewer holds, in any scope: what the navigation offers.
    permissions: ReadonlySet<PermissionKey>;
    roleKeys: string[];
    // Holds a permission that requires two-factor, and has not set it up yet.
    needsTwoFactorSetup: boolean;
  };

// The signed-in person with what they may do, or null. Read once per request.
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const { grants, permissions, roleKeys } = await loadAccess(
    user.userId,
    user.collegeId,
  );
  return {
    ...user,
    grants,
    permissions,
    roleKeys,
    needsTwoFactorSetup:
      requiresTwoFactor(permissions) && !user.twoFactorEnabled,
  };
});

// For every page and action behind sign-in: the viewer, once nothing stands between them and the
// platform. Signed out goes to the login page; a temporary password must be replaced first, and
// whoever needs two-factor sets it up first.
export async function requireViewer() {
  // Imported on call: db/ scripts load this module with plain Node, which cannot resolve "next/navigation".
  const { redirect } = await import("next/navigation");
  const viewer = await getViewer();
  if (!viewer) return redirect("/");
  if (viewer.mustChangePassword) return redirect("/change-password");
  if (viewer.needsTwoFactorSetup) return redirect("/two-factor/setup");
  return viewer;
}

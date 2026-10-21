import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PermissionKey } from "../domain/permissions.ts";
import { signedInAction, viewerAction } from "./action-client.ts";

// Who the request carries: the signed-in person, and the viewer with their permissions.
const request = vi.hoisted(() => ({
  user: null as { userId: string } | null,
  viewer: null as unknown,
}));
vi.mock("../../identity/index.ts", () => ({
  getSessionUser: async () => request.user,
}));
vi.mock("./viewer.ts", () => ({ getViewer: async () => request.viewer }));
// The request's logger, which puts the request's id on the line.
const logged = vi.hoisted(() => vi.fn());
vi.mock("../../../platform/logging/request-logger.ts", () => ({
  getRequestLogger: async () => ({ error: logged }),
}));

beforeEach(() => {
  request.user = null;
  request.viewer = null;
  logged.mockClear();
});

const viewer = (
  permissions: PermissionKey[],
  pending: { mustChangePassword?: boolean; needsTwoFactorSetup?: boolean } = {},
  departmentId: string | null = null,
) => ({
  userId: "user-a",
  collegeId: "college-a",
  grants: permissions.map((permission) => ({ permission, departmentId })),
  permissions: new Set(permissions),
  mustChangePassword: false,
  needsTwoFactorSetup: false,
  ...pending,
});

const viewCatalog = viewerAction
  .metadata({ name: "viewCatalog", permission: "design.view" })
  .action(async ({ ctx }) => ctx.viewer.userId);

describe("viewerAction", () => {
  it("runs the action for a viewer who holds its permission", async () => {
    request.viewer = viewer(["design.view"]);
    expect(await viewCatalog()).toEqual({ data: "user-a" });
  });

  it("refuses a viewer without the permission", async () => {
    request.viewer = viewer(["accounts.resetPassword"]);
    expect(await viewCatalog()).toEqual({ serverError: "forbidden" });
  });

  it("refuses someone signed out, or with a password to replace or two-factor to set up first", async () => {
    for (const pending of [
      null,
      viewer(["design.view"], { mustChangePassword: true }),
      viewer(["design.view"], { needsTwoFactorSetup: true }),
    ]) {
      request.viewer = pending;
      expect(await viewCatalog()).toEqual({ serverError: "signedOut" });
    }
  });

  it("refuses, through ctx.requirePermission, an action whose permission depends on its input", async () => {
    const choose = viewerAction
      .metadata({ name: "choose" })
      .action(async ({ ctx }) => {
        ctx.requirePermission("accounts.resetPassword");
        return "done";
      });
    request.viewer = viewer(["design.view"]);
    expect(await choose()).toEqual({ serverError: "forbidden" });
    request.viewer = viewer(["accounts.resetPassword"]);
    expect(await choose()).toEqual({ data: "done" });
  });

  it("keeps a key held in one department to that department, for a check and for a list", async () => {
    const plan = viewerAction
      .metadata({ name: "plan" })
      .action(async ({ ctx }) => {
        ctx.requirePermission("plan.edit", { departmentId: "electrical" });
        return ctx.departmentsFor("plan.edit");
      });
    request.viewer = viewer(["plan.edit"], {}, "electrical");
    expect(await plan()).toEqual({ data: ["electrical"] });
    request.viewer = viewer(["plan.edit"], {}, "mechanical");
    expect(await plan()).toEqual({ serverError: "forbidden" });
    request.viewer = viewer(["plan.edit"]);
    expect(await plan()).toEqual({ data: "college" });
  });

  it("refuses an action named with a permission to a viewer who holds it in one department only", async () => {
    request.viewer = viewer(["design.view"], {}, "electrical");
    expect(await viewCatalog()).toEqual({ serverError: "forbidden" });
  });

  it("answers an unexpected failure with its message key, and logs it", async () => {
    request.viewer = viewer([]);
    const failing = viewerAction
      .metadata({ name: "failing" })
      .action(async () => {
        throw new Error("database unreachable");
      });
    expect(await failing()).toEqual({ serverError: "unexpected" });
    expect(logged).toHaveBeenCalledWith(
      expect.objectContaining({ action: "failing" }),
      "server action failed",
    );
  });
});

describe("signedInAction", () => {
  const whoAmI = signedInAction
    .metadata({ name: "whoAmI" })
    .action(async ({ ctx }) => ctx.user.userId);

  it("runs for anyone signed in, whatever is still pending, and refuses the signed out", async () => {
    request.user = { userId: "user-b" };
    expect(await whoAmI()).toEqual({ data: "user-b" });
    request.user = null;
    expect(await whoAmI()).toEqual({ serverError: "signedOut" });
  });
});

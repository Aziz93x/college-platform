import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PermissionKey } from "../domain/permissions.ts";
import { requireViewer } from "./viewer.ts";

// The person the session carries, the keys their roles give them, and whether their college
// requires two-factor of the keys that need it.
const request = vi.hoisted(() => ({
  twoFactorEnabled: false,
  permissions: new Set<string>(),
  required: true,
}));
vi.mock("../../identity/index.ts", () => ({
  getSessionUser: async () => ({
    userId: "user-a",
    sessionId: "session-a",
    collegeId: "college-a",
    name: "A",
    email: "a@college.example",
    mustChangePassword: false,
    twoFactorEnabled: request.twoFactorEnabled,
  }),
}));
vi.mock("./load-access.ts", () => ({
  loadAccess: async () => ({
    grants: [...request.permissions].map((permission) => ({
      permission,
      departmentId: null,
    })),
    permissions: request.permissions,
    roleKeys: [],
  }),
}));
vi.mock("../../settings/index.ts", () => ({
  getSetting: async (key: string) => {
    if (key !== "auth.requireTwoFactor") throw new Error(`unexpected ${key}`);
    return request.required;
  },
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect ${to}`);
  },
}));

beforeEach(() => {
  request.twoFactorEnabled = false;
  request.permissions = new Set();
  request.required = true;
});

const holding = (...keys: PermissionKey[]) => {
  request.permissions = new Set(keys);
};

describe("requireViewer", () => {
  it("sends whoever holds a permission that requires two-factor to set it up first", async () => {
    holding("design.view", "accounts.resetPassword");
    await expect(requireViewer()).rejects.toThrow("redirect /two-factor/setup");

    request.twoFactorEnabled = true;
    await expect(requireViewer()).resolves.toMatchObject({
      userId: "user-a",
      twoFactorRequired: true,
      needsTwoFactorSetup: false,
    });
  });

  it("leaves two-factor to each person while the college does not require it (ADR-0014)", async () => {
    holding("design.view", "accounts.resetPassword");
    request.required = false;
    await expect(requireViewer()).resolves.toMatchObject({
      twoFactorRequired: false,
      needsTwoFactorSetup: false,
    });

    request.twoFactorEnabled = true;
    await expect(requireViewer()).resolves.toMatchObject({
      twoFactorRequired: false,
    });
  });

  it("lets in someone whose permissions do not require two-factor", async () => {
    holding("design.view");
    await expect(requireViewer()).resolves.toMatchObject({
      twoFactorRequired: false,
      needsTwoFactorSetup: false,
    });
  });
});

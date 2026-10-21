import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PermissionKey } from "../domain/permissions.ts";
import { requireViewer } from "./viewer.ts";

// The person the session carries, and the keys their roles give them.
const request = vi.hoisted(() => ({
  twoFactorEnabled: false,
  permissions: new Set<string>(),
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
  loadAccess: async () => ({ permissions: request.permissions, roleKeys: [] }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect ${to}`);
  },
}));

beforeEach(() => {
  request.twoFactorEnabled = false;
  request.permissions = new Set();
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
      needsTwoFactorSetup: false,
    });
  });

  it("lets in someone whose permissions do not require two-factor", async () => {
    holding("design.view");
    await expect(requireViewer()).resolves.toMatchObject({
      needsTwoFactorSetup: false,
    });
  });
});

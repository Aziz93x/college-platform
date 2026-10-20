import { describe, expect, it } from "vitest";
import { authorize } from "./authorize.ts";
import {
  isPermissionKey,
  type PermissionKey,
  permissionKeys,
  requiresTwoFactor,
} from "./permissions.ts";

const actor = (...permissions: PermissionKey[]) => ({
  collegeId: "college-a",
  permissions: new Set(permissions),
});

describe("authorize", () => {
  it("allows a permission the actor holds in the scope's college", () => {
    expect(
      authorize(actor("design.view"), "design.view", {
        collegeId: "college-a",
      }),
    ).toBe(true);
  });

  it("refuses a permission the actor does not hold", () => {
    expect(
      authorize(actor("design.view"), "accounts.resetPassword", {
        collegeId: "college-a",
      }),
    ).toBe(false);
  });

  it("refuses another college, whatever the actor holds", () => {
    expect(
      authorize(actor(...permissionKeys), "design.view", {
        collegeId: "college-b",
      }),
    ).toBe(false);
  });
});

describe("requiresTwoFactor", () => {
  it("is true when any held key requires it", () => {
    expect(requiresTwoFactor(["design.view", "accounts.resetPassword"])).toBe(
      true,
    );
  });

  it("is false without such a key", () => {
    expect(requiresTwoFactor(["design.view"])).toBe(false);
    expect(requiresTwoFactor([])).toBe(false);
  });
});

describe("isPermissionKey", () => {
  it("knows the keys in code and nothing else", () => {
    expect(isPermissionKey("design.view")).toBe(true);
    expect(isPermissionKey("design.edit")).toBe(false);
    expect(isPermissionKey("constructor")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { authorize, type Grant, permittedDepartments } from "./authorize.ts";
import {
  isPermissionKey,
  type PermissionKey,
  permissionArea,
  permissionKeys,
  requiresTwoFactor,
} from "./permissions.ts";

const actor = (...grants: Grant[]) => ({
  userId: "user-a",
  collegeId: "college-a",
  grants,
});
const college = (permission: PermissionKey): Grant => ({
  permission,
  departmentId: null,
});
const department = (
  permission: PermissionKey,
  departmentId: string,
): Grant => ({
  permission,
  departmentId,
});

describe("authorize", () => {
  it("allows a key held across the college, in the college and in each of its departments", () => {
    const admin = actor(college("plan.edit"));
    expect(authorize(admin, "plan.edit", { collegeId: "college-a" })).toBe(
      true,
    );
    expect(
      authorize(admin, "plan.edit", {
        collegeId: "college-a",
        departmentId: "electrical",
      }),
    ).toBe(true);
  });

  it("keeps a key held in one department to that department", () => {
    const head = actor(department("plan.edit", "electrical"));
    expect(
      authorize(head, "plan.edit", {
        collegeId: "college-a",
        departmentId: "electrical",
      }),
    ).toBe(true);
    expect(
      authorize(head, "plan.edit", {
        collegeId: "college-a",
        departmentId: "mechanical",
      }),
    ).toBe(false);
    expect(authorize(head, "plan.edit", { collegeId: "college-a" })).toBe(
      false,
    );
  });

  it("refuses a key the actor does not hold, and another college whatever the actor holds", () => {
    expect(
      authorize(actor(college("design.view")), "accounts.resetPassword", {
        collegeId: "college-a",
      }),
    ).toBe(false);
    expect(
      authorize(actor(...permissionKeys.map(college)), "design.view", {
        collegeId: "college-b",
      }),
    ).toBe(false);
  });

  it("allows a record of one's own only to its owner", () => {
    const trainer = actor(department("task.complete", "electrical"));
    const task = { collegeId: "college-a", departmentId: "electrical" };
    expect(
      authorize(trainer, "task.complete", { ...task, ownerId: "user-a" }),
    ).toBe(true);
    expect(
      authorize(trainer, "task.complete", { ...task, ownerId: "user-b" }),
    ).toBe(false);
    // Owning the record gives nothing without the key.
    expect(
      authorize(actor(), "task.complete", { ...task, ownerId: "user-a" }),
    ).toBe(false);
  });
});

describe("permittedDepartments", () => {
  it("names the whole college when the key is held across it", () => {
    expect(
      permittedDepartments(
        actor(department("plan.edit", "electrical"), college("plan.edit")),
        "plan.edit",
      ),
    ).toBe("college");
  });

  it("lists each department the key is held in, once, and none without the key", () => {
    const head = actor(
      department("plan.edit", "electrical"),
      department("plan.edit", "mechanical"),
      department("plan.edit", "electrical"),
      department("review.decide", "general"),
    );
    expect(permittedDepartments(head, "plan.edit")).toEqual([
      "electrical",
      "mechanical",
    ]);
    expect(permittedDepartments(head, "plan.publish")).toEqual([]);
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

  it("is required by every key that changes access, accounts, settings or the organization, and by the log of who did it from where", () => {
    expect(permissionKeys.filter((key) => requiresTwoFactor([key]))).toEqual([
      "audit.view",
      "settings.manage",
      "college.manage",
      "departments.manage",
      "roles.manage",
      "people.manage",
      "accounts.resetPassword",
      "accounts.linkEmployeeNumber",
    ]);
  });
});

describe("isPermissionKey", () => {
  it("knows the keys in code and nothing else", () => {
    expect(isPermissionKey("design.view")).toBe(true);
    expect(isPermissionKey("design.edit")).toBe(false);
    expect(isPermissionKey("constructor")).toBe(false);
  });
});

describe("permissionArea", () => {
  it("groups the grid's keys", () => {
    expect(permissionArea("roles.manage")).toBe("organization");
    expect(permissionArea("task.complete")).toBe("work");
  });
});

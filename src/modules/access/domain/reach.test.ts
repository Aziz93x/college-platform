import { describe, expect, it } from "vitest";
import type { Grant } from "./authorize.ts";
import type { PermissionKey } from "./permissions.ts";
import { reachesAccount } from "./reach.ts";

const A = "department-a";
const B = "department-b";
const actor = (grants: Grant[]) => ({
  userId: "actor",
  collegeId: "college",
  grants,
});
const holder = (
  departments: (string | null)[],
  keys: PermissionKey[] = ["task.complete"],
) => ({
  memberships: departments.map((departmentId) => ({ departmentId })),
  permissions: new Set(keys),
});
const head = actor([{ permission: "accounts.resetPassword", departmentId: A }]);

describe("reachesAccount", () => {
  it("reaches everyone in the college from a key held across it", () => {
    const admin = actor([
      { permission: "accounts.resetPassword", departmentId: null },
    ]);
    expect(
      reachesAccount(admin, "accounts.resetPassword", holder([null])),
    ).toBe(true);
    expect(
      reachesAccount(
        admin,
        "accounts.resetPassword",
        holder([A], ["accounts.resetPassword"]),
      ),
    ).toBe(true);
  });

  it("reaches a head's trainers, also those who teach in another department too", () => {
    expect(reachesAccount(head, "accounts.resetPassword", holder([A]))).toBe(
      true,
    );
    expect(reachesAccount(head, "accounts.resetPassword", holder([A, B]))).toBe(
      true,
    );
  });

  it.each([
    ["a trainer of another department", holder([B])],
    ["someone with a role across the college", holder([A, null])],
    ["someone with no role", holder([])],
    [
      "another head, whose keys require two-factor",
      holder([A], ["accounts.resetPassword"]),
    ],
  ])("does not reach %s from a key held in a department", (_name, target) => {
    expect(reachesAccount(head, "accounts.resetPassword", target)).toBe(false);
  });

  it("reaches no one with a key the actor does not hold", () => {
    expect(
      reachesAccount(head, "accounts.linkEmployeeNumber", holder([A])),
    ).toBe(false);
  });
});

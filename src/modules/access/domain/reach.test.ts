import { describe, expect, it } from "vitest";
import type { Grant } from "./authorize.ts";
import { type PermissionKey, permissionKeys } from "./permissions.ts";
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

// The seeded keys of the roles a college-wide key could reach (db/seed/base.ts).
const headKeys: PermissionKey[] = [
  "plan.edit",
  "sections.transfer",
  "accounts.resetPassword",
  "accounts.linkEmployeeNumber",
  "announcements.publish",
];
const viceDeanKeys: PermissionKey[] = [
  "term.manage",
  "framework.publish",
  "rayat.import",
  "announcements.publish",
];

describe("reachesAccount", () => {
  it("reaches everyone in the college from an admin's keys, held across it", () => {
    const admin = actor(
      permissionKeys.map((permission) => ({ permission, departmentId: null })),
    );
    for (const target of [
      holder([null]),
      holder([A], headKeys),
      holder([null], permissionKeys),
    ]) {
      expect(reachesAccount(admin, "accounts.resetPassword", target)).toBe(
        true,
      );
    }
  });

  // Lead review B: one switch on the grid gave the vice-dean temporary passwords, and with them
  // the admin's account.
  describe("from a key held across the college by a role that is not the admin's", () => {
    const viceDean = actor(
      [...viceDeanKeys, "accounts.resetPassword" as const].map(
        (permission) => ({ permission, departmentId: null }),
      ),
    );

    it("reaches trainers, and anyone across the college whose every key it holds", () => {
      expect(
        reachesAccount(viceDean, "accounts.resetPassword", holder([A, B])),
      ).toBe(true);
      expect(
        reachesAccount(
          viceDean,
          "accounts.resetPassword",
          holder([null], ["announcements.publish"]),
        ),
      ).toBe(true);
    });

    it.each([
      ["an admin", holder([null], permissionKeys)],
      ["a head, whose employee number key it lacks", holder([A], headKeys)],
      [
        "the dean, whose endorsement of the framework it lacks",
        holder([null], ["announcements.publish", "framework.endorse"]),
      ],
    ])("does not reach %s", (_name, target) => {
      expect(reachesAccount(viceDean, "accounts.resetPassword", target)).toBe(
        false,
      );
    });

    it("counts only the keys it holds across the college", () => {
      const partly = actor([
        { permission: "accounts.resetPassword", departmentId: null },
        { permission: "accounts.linkEmployeeNumber", departmentId: A },
      ]);
      expect(
        reachesAccount(
          partly,
          "accounts.resetPassword",
          holder([B], ["accounts.linkEmployeeNumber"]),
        ),
      ).toBe(false);
    });
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

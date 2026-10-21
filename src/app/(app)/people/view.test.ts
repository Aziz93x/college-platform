import { describe, expect, it } from "vitest";
import type { PersonEntry } from "@/modules/access";
import { personView } from "./view.ts";

const ELECTRICAL = "0199b2a4-6c1e-7d3a-9f00-000000000001";
const MECHANICAL = "0199b2a4-6c1e-7d3a-9f00-000000000002";

const trainer = (userId: string, departmentId: string): PersonEntry => ({
  userId,
  name: "A Trainer",
  email: `${userId}@college.example`,
  employeeNumber: "2001",
  state: "active",
  memberships: [
    { id: "m", roleId: "r", roleLabels: {}, system: false, departmentId },
  ],
  permissions: new Set(["task.complete"]),
});

const admin = {
  userId: "admin",
  collegeId: "college",
  grants: [
    { permission: "people.manage", departmentId: null },
    { permission: "accounts.resetPassword", departmentId: null },
    { permission: "accounts.linkEmployeeNumber", departmentId: null },
  ] as const,
};

const head = {
  userId: "head",
  collegeId: "college",
  grants: [
    { permission: "accounts.resetPassword", departmentId: ELECTRICAL },
    { permission: "accounts.linkEmployeeNumber", departmentId: ELECTRICAL },
  ] as const,
};

const view = (
  person: PersonEntry,
  viewer: typeof admin | typeof head,
  manages: boolean,
) =>
  personView(person, viewer, {
    manages,
    language: "ar",
    departmentName: () => undefined,
  }).can;

describe("personView", () => {
  it("offers whoever manages the people every action on someone else's account", () => {
    expect(view(trainer("t", ELECTRICAL), admin, true)).toEqual({
      reset: true,
      link: true,
      edit: true,
      disable: true,
    });
  });

  it("offers a head a temporary password and the employee number for their own department's trainers only", () => {
    expect(view(trainer("t", ELECTRICAL), head, false)).toEqual({
      reset: true,
      link: true,
      edit: false,
      disable: false,
    });
    expect(view(trainer("t", MECHANICAL), head, false)).toEqual({
      reset: false,
      link: false,
      edit: false,
      disable: false,
    });
  });

  it("never offers a temporary password for, or disabling of, one's own account", () => {
    expect(view(trainer(admin.userId, ELECTRICAL), admin, true)).toEqual({
      reset: false,
      link: true,
      edit: true,
      disable: false,
    });
  });
});

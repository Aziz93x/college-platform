import { describe, expect, it } from "vitest";
import { type PersonEntry, permissionKeys } from "@/modules/access";
import { personView } from "./view.ts";

const ELECTRICAL = "0199b2a4-6c1e-7d3a-9f00-000000000001";
const MECHANICAL = "0199b2a4-6c1e-7d3a-9f00-000000000002";

const trainer = (
  userId: string,
  departmentId: string,
  twoFactor = false,
): PersonEntry => ({
  userId,
  name: "A Trainer",
  email: `${userId}@college.example`,
  employeeNumber: "2001",
  state: "active",
  twoFactor,
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

// Whoever an admin gave the people keys across the college, without the system role.
const deputy = { ...admin, userId: "deputy" };

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
  viewer: Parameters<typeof personView>[1],
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
      turnOffTwoFactor: false,
      link: true,
      edit: true,
      disable: true,
      sessions: false,
    });
  });

  it("offers a head a temporary password and the employee number for their own department's trainers only", () => {
    expect(view(trainer("t", ELECTRICAL), head, false)).toEqual({
      reset: true,
      turnOffTwoFactor: false,
      link: true,
      edit: false,
      disable: false,
      sessions: false,
    });
    expect(view(trainer("t", MECHANICAL), head, false)).toEqual({
      reset: false,
      turnOffTwoFactor: false,
      link: false,
      edit: false,
      disable: false,
      sessions: false,
    });
  });

  it("offers nothing on the account of someone whose powers the viewer lacks: an admin (lead review B)", () => {
    const systemAdmin: PersonEntry = {
      ...trainer("system-admin", ELECTRICAL),
      memberships: [
        {
          id: "m",
          roleId: "r",
          roleLabels: {},
          system: true,
          departmentId: null,
        },
      ],
      permissions: new Set(permissionKeys),
    };
    expect(view(systemAdmin, deputy, true)).toEqual({
      reset: false,
      turnOffTwoFactor: false,
      link: false,
      edit: false,
      disable: false,
      sessions: false,
    });
  });

  it("never offers a temporary password for, or disabling of, one's own account", () => {
    expect(view(trainer(admin.userId, ELECTRICAL), admin, true)).toEqual({
      reset: false,
      turnOffTwoFactor: false,
      link: true,
      edit: true,
      disable: false,
      sessions: false,
    });
  });

  it("offers someone's sessions to whoever holds accounts.sessions where they are, never one's own (ADR-0029)", () => {
    const keeper = {
      ...admin,
      grants: [
        ...admin.grants,
        { permission: "accounts.sessions", departmentId: null },
      ] as const,
    };
    expect(view(trainer("t", ELECTRICAL), keeper, true).sessions).toBe(true);
    expect(
      view(trainer(keeper.userId, ELECTRICAL), keeper, true).sessions,
    ).toBe(false);
  });

  it("offers turning two-factor off while it is on, to whoever may give a temporary password (ADR-0014)", () => {
    expect(view(trainer("t", ELECTRICAL, true), admin, true)).toMatchObject({
      turnOffTwoFactor: true,
    });
    expect(view(trainer("t", ELECTRICAL, true), head, false)).toMatchObject({
      turnOffTwoFactor: true,
    });
    expect(view(trainer("t", MECHANICAL, true), head, false)).toMatchObject({
      turnOffTwoFactor: false,
    });
    expect(
      view(trainer(admin.userId, ELECTRICAL, true), admin, true),
    ).toMatchObject({ turnOffTwoFactor: false });
  });
});

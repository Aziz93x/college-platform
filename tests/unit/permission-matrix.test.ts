import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultRoles, systemRole } from "../../db/seed/base.ts";
import {
  type PermissionKey,
  permissionKeys,
  roleInput,
  viewerAction,
} from "../../src/modules/access/index.ts";

// The permission matrix (docs/PLAN.md, Step 9): every server action, run for every seeded role,
// held across the college and held in one department only. An action is allowed exactly when the
// role holds the action's key across the college: every action so far touches the whole college.
// A new action fails "every action is in the matrix" until it has a row here.

// The viewer the request carries, made from a role's keys in a scope.
const request = vi.hoisted(() => ({ viewer: null as unknown }));
vi.mock("../../src/modules/access/server/viewer.ts", () => ({
  getViewer: async () => request.viewer,
}));

// The domain functions the actions reach, each answering as if it succeeded.
const ID = "0199b2a4-6c1e-7d3a-9f00-3c5e8a1b2c4d";
vi.mock("@/modules/org", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/org")>()),
  createDepartment: async () => ({ status: "created", id: ID }),
  updateDepartment: async () => ({ status: "saved" }),
  updateCollege: async () => ({ status: "saved" }),
}));
vi.mock("@/modules/settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/settings")>()),
  setSetting: async () => ({ status: "saved", value: null }),
  resetSetting: async () => ({ status: "reset", value: null }),
  getSetting: async (key: string) => (key === "locale.language" ? "ar" : {}),
}));
vi.mock("@/modules/access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/access")>()),
  createRole: async () => ({ status: "created", id: ID }),
  renameRole: async () => ({ status: "saved" }),
  setRolePermissions: async () => ({ status: "saved" }),
  addMembership: async () => ({ status: "added", id: ID }),
  removeMembership: async () => ({ status: "removed" }),
  findRole: async () => ({ id: ID, key: "trainer" }),
}));
vi.mock("@/modules/identity", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/identity")>()),
  reauthenticate: async () => ({ status: "confirmed" }),
  requestMeta: () => ({ ip: "10.0.30.1", userAgent: "matrix" }),
}));
vi.mock("next/cache", () => ({ refresh: () => {} }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

type Action = (
  input: unknown,
) => Promise<
  | { data?: unknown; serverError?: string; validationErrors?: unknown }
  | undefined
>;

// Every action module under src/app, by its path from src/app.
const modules = Object.fromEntries(
  Object.entries(
    import.meta.glob<Record<string, Action>>("../../src/app/**/actions.ts", {
      eager: true,
    }),
  ).map(([path, module]) => [path.replace("../../src/app/", ""), module]),
);

// What each action needs across the college, with an input it accepts. Settings name their key per
// setting, so the settings actions have a row per key a setting may name.
const checked: {
  module: string;
  action: string;
  permission: PermissionKey;
  input: unknown;
}[] = [
  {
    module: "(app)/departments/actions.ts",
    action: "createDepartmentAction",
    permission: "departments.manage",
    input: {
      name: "Electrical",
      shortName: "Elec",
      rayatValues: ["Electrical"],
      active: true,
    },
  },
  {
    module: "(app)/departments/actions.ts",
    action: "updateDepartmentAction",
    permission: "departments.manage",
    input: {
      id: ID,
      name: "Electrical",
      shortName: "Elec",
      rayatValues: ["Electrical"],
      active: true,
    },
  },
  {
    module: "(app)/departments/actions.ts",
    action: "updateCollegeAction",
    permission: "college.manage",
    input: { name: "Oasis College", shortName: "Oasis" },
  },
  {
    module: "(app)/settings/actions.ts",
    action: "saveSettingAction",
    permission: "settings.manage",
    input: { key: "review.weeklyCap", value: 31 },
  },
  {
    module: "(app)/settings/actions.ts",
    action: "saveSettingAction",
    permission: "roles.manage",
    input: { key: "navigation.order", value: { trainer: ["today"] } },
  },
  {
    module: "(app)/settings/actions.ts",
    action: "resetSettingAction",
    permission: "settings.manage",
    input: { key: "review.weeklyCap" },
  },
  {
    module: "(app)/settings/actions.ts",
    action: "resetSettingAction",
    permission: "roles.manage",
    input: { key: "navigation.order" },
  },
  {
    module: "(app)/roles/actions.ts",
    action: "createRoleAction",
    permission: "roles.manage",
    input: { label: "Coordinator" },
  },
  {
    module: "(app)/roles/actions.ts",
    action: "renameRoleAction",
    permission: "roles.manage",
    input: { id: ID, label: "Coordinator" },
  },
  {
    module: "(app)/roles/actions.ts",
    action: "setRolePermissionsAction",
    permission: "roles.manage",
    input: { id: ID, permissions: ["task.complete"] },
  },
  {
    module: "(app)/roles/actions.ts",
    action: "addMembershipAction",
    permission: "roles.manage",
    input: { userId: ID, roleId: ID, departmentId: null },
  },
  {
    module: "(app)/roles/actions.ts",
    action: "removeMembershipAction",
    permission: "roles.manage",
    input: { id: ID },
  },
  {
    module: "(app)/roles/actions.ts",
    action: "savePageOrderAction",
    permission: "roles.manage",
    input: { roleId: ID, order: ["today"] },
  },
];

// Actions anyone may call, or anyone signed in, on purpose: signing in is public, and the others
// act on the caller's own account (ADR-0009 #6, Audit 2).
const open = [
  "(auth)/actions.ts#signInAction",
  "(auth)/actions.ts#verifyCodeAction",
  "(auth)/actions.ts#startTwoFactorSetupAction",
  "(auth)/actions.ts#confirmTwoFactorSetupAction",
  "(auth)/actions.ts#changePasswordAction",
  "(auth)/actions.ts#signOutAction",
];

// Each seeded role, and a role with no key; each held across the college or in one department.
const roles: { key: string; permissions: readonly PermissionKey[] }[] = [
  { key: systemRole.key, permissions: permissionKeys },
  ...defaultRoles,
  { key: "no key", permissions: [] },
];
const DEPARTMENT = "0199b2a4-6c1e-7d3a-9f00-000000000001";

const viewerFor = (
  role: (typeof roles)[number],
  departmentId: string | null,
) => ({
  userId: "user-a",
  sessionId: "session-a",
  collegeId: "college-a",
  grants: role.permissions.map((permission) => ({ permission, departmentId })),
  permissions: new Set(role.permissions),
  roleKeys: [role.key],
  mustChangePassword: false,
  needsTwoFactorSetup: false,
});

// Where an action's outcome differs from what the role and scope call for: each line names the
// role, the scope and what happened. An allowed action must have run, not stopped at its input.
async function mismatches(
  action: Action,
  input: unknown,
  permission: PermissionKey,
) {
  const found: string[] = [];
  for (const role of roles) {
    for (const departmentId of [null, DEPARTMENT]) {
      request.viewer = viewerFor(role, departmentId);
      const result = await action(input);
      const allowed = result?.serverError !== "forbidden";
      const expected =
        departmentId === null && role.permissions.includes(permission);
      const scope = departmentId ? "in a department" : "across the college";
      if (allowed !== expected) {
        found.push(`${role.key} ${scope}: ${allowed ? "allowed" : "refused"}`);
      } else if (allowed && result?.data === undefined) {
        found.push(
          `${role.key} ${scope}: did not run (${JSON.stringify(result)})`,
        );
      }
    }
  }
  return found;
}

beforeEach(() => {
  request.viewer = null;
});

describe("the permission matrix", () => {
  it("has every action of every action module, checked or open on purpose", () => {
    const found = Object.entries(modules).flatMap(([module, exports]) =>
      Object.keys(exports).map((action) => `${module}#${action}`),
    );
    const listed = new Set([
      ...checked.map(({ module, action }) => `${module}#${action}`),
      ...open,
    ]);
    expect(found.sort()).toEqual([...listed].sort());
  });

  // The modules above are found by their name; an action in a file named otherwise, or under
  // src/modules, would escape them (Audit 3).
  it('reaches every server action: each file that says "use server" is an action module under src/app', () => {
    const sources = import.meta.glob<string>("../../src/**/*.{ts,tsx}", {
      query: "?raw",
      import: "default",
      eager: true,
    });
    const servers = Object.entries(sources)
      .filter(([, source]) => /^\s*["']use server["']/m.test(source))
      .map(([path]) => path.replace("../../src/app/", ""));
    expect(servers.sort()).toEqual(Object.keys(modules).sort());
  });

  it.each(
    checked.map((row) => ({
      ...row,
      name: `${row.action}${row.permission === checked.find((each) => each.action === row.action)?.permission ? "" : ` (${JSON.stringify(row.input)})`}`,
    })),
  )("$name runs for exactly the roles that hold $permission across the college", async ({
    module,
    action,
    input,
    permission,
  }) => {
    expect(
      await mismatches(modules[module][action], input, permission),
    ).toEqual([]);
  });

  it("would catch an action whose check was removed", async () => {
    const unchecked = viewerAction
      .metadata({ name: "unchecked" })
      .inputSchema(roleInput)
      .action(async () => ({ status: "created" }));
    expect(
      await mismatches(
        unchecked as Action,
        { label: "Coordinator" },
        "roles.manage",
      ),
    ).toContain("no key across the college: allowed");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetSettingAction, saveSettingAction } from "./actions.ts";

// The viewer the request carries, and the services the actions reach, so each test sees what the
// actions hand them.
const request = vi.hoisted(() => ({
  permissions: new Set<string>(["settings.manage"]),
}));
vi.mock("../../../modules/access/server/viewer.ts", () => ({
  getViewer: async () => ({
    userId: "user-a",
    sessionId: "session-a",
    collegeId: "college-a",
    permissions: request.permissions,
    grants: [...request.permissions].map((permission) => ({
      permission,
      departmentId: null,
    })),
    mustChangePassword: false,
    needsTwoFactorSetup: false,
  }),
}));
const identity = vi.hoisted(() => ({
  reauthenticate: vi.fn(async () => ({ status: "confirmed" as const })),
  requestMeta: () => ({ ip: "10.0.30.1", userAgent: "unit-test" }),
}));
vi.mock("@/modules/identity", () => identity);
const services = vi.hoisted(() => ({
  setSetting: vi.fn(async (_key: string, value: unknown) => ({
    status: "saved" as const,
    value,
  })),
  resetSetting: vi.fn(async () => ({ status: "reset" as const, value: 15 })),
}));
vi.mock("@/modules/settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/settings")>()),
  ...services,
}));
const cache = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/cache", () => cache);
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

beforeEach(() => {
  vi.clearAllMocks();
  request.permissions = new Set(["settings.manage"]);
});

describe("saveSettingAction", () => {
  it("saves through setSetting as the viewer, from the request's address, and draws the page again", async () => {
    expect(
      await saveSettingAction({ key: "review.weeklyCap", value: 31 }),
    ).toEqual({ data: { status: "saved", value: 31 } });
    expect(services.setSetting).toHaveBeenCalledWith("review.weeklyCap", 31, {
      collegeId: "college-a",
      actorId: "user-a",
      ip: "10.0.30.1",
      userAgent: "unit-test",
    });
    expect(cache.refresh).toHaveBeenCalledOnce();
    // Not a security setting: no password.
    expect(identity.reauthenticate).not.toHaveBeenCalled();
  });

  it("refuses a viewer without the setting's permission", async () => {
    request.permissions = new Set(["design.view"]);
    expect(
      await saveSettingAction({ key: "review.weeklyCap", value: 31 }),
    ).toEqual({ serverError: "forbidden" });
    expect(services.setSetting).not.toHaveBeenCalled();
  });

  it("answers a value the setting's schema refuses without asking for the password", async () => {
    expect(
      await saveSettingAction({ key: "auth.lockoutMinutes", value: 5000 }),
    ).toEqual({ data: { status: "invalid" } });
    expect(identity.reauthenticate).not.toHaveBeenCalled();
    expect(services.setSetting).not.toHaveBeenCalled();
  });

  it("asks for the password before a security setting changes, and changes nothing until it is right", async () => {
    identity.reauthenticate.mockResolvedValueOnce({
      status: "passwordRequired",
    } as never);
    expect(
      await saveSettingAction({ key: "auth.lockoutMinutes", value: 30 }),
    ).toEqual({ data: { status: "passwordRequired" } });
    expect(services.setSetting).not.toHaveBeenCalled();

    // Typed in Arabic-Indic digits, it reaches the check as Latin ones, as at sign-in.
    await saveSettingAction({
      key: "auth.lockoutMinutes",
      value: 30,
      password: "oasis-٢٠٢٦",
    });
    expect(identity.reauthenticate).toHaveBeenLastCalledWith(
      "oasis-2026",
      expect.objectContaining({ userId: "user-a", sessionId: "session-a" }),
      expect.any(Headers),
    );
    expect(services.setSetting).toHaveBeenCalledOnce();
  });

  it("refuses a key no setting has", async () => {
    const result = await saveSettingAction({ key: "auth.unknown", value: 1 });
    expect(result?.validationErrors).toBeDefined();
    expect(services.setSetting).not.toHaveBeenCalled();
  });
});

describe("resetSettingAction", () => {
  it("resets through resetSetting, with the password first for a security setting", async () => {
    expect(await resetSettingAction({ key: "auth.lockoutMinutes" })).toEqual({
      data: { status: "reset", value: 15 },
    });
    expect(identity.reauthenticate).toHaveBeenCalledOnce();
    expect(services.resetSetting).toHaveBeenCalledWith("auth.lockoutMinutes", {
      collegeId: "college-a",
      actorId: "user-a",
      ip: "10.0.30.1",
      userAgent: "unit-test",
    });
    expect(cache.refresh).toHaveBeenCalledOnce();
  });
});

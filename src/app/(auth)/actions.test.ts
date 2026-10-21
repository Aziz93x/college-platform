import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  changePasswordAction,
  confirmTwoFactorSetupAction,
  signInAction,
  startTwoFactorSetupAction,
  verifyCodeAction,
} from "./actions.ts";

// The services the fields reach, so the test sees what each action hands them.
const identity = vi.hoisted(() => ({
  signIn: vi.fn(async () => ({ status: "signedIn" as const })),
  startTwoFactorSetup: vi.fn(async () => ({
    status: "wrongPassword" as const,
  })),
  changePassword: vi.fn(async () => ({ status: "changed" as const })),
  verifySignInCode: vi.fn(async () => ({ status: "signedIn" as const })),
  confirmTwoFactorSetup: vi.fn(async () => ({ status: "enabled" as const })),
  getSessionUser: async () => ({
    userId: "user-a",
    collegeId: "college-a",
    sessionId: "session-a",
  }),
}));
vi.mock("@/modules/identity", () => identity);
// Whether the college requires two-factor of the viewer, which decides where its setup ends.
const viewer = vi.hoisted(() => ({ needsTwoFactorSetup: false }));
vi.mock("../../modules/access/server/viewer.ts", () => ({
  getViewer: async () => viewer,
}));
const navigation = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => navigation);
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/modules/settings", () => ({ getSetting: async () => null }));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));

beforeEach(() => {
  vi.clearAllMocks();
  viewer.needsTwoFactorSetup = false;
});

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
};

describe("the two-factor code fields", () => {
  it("read a code typed in Arabic-Indic digits as Latin digits, at sign-in and at setup", async () => {
    await verifyCodeAction({}, form({ code: "٩٦٤٨٤٧" }));
    expect(identity.verifySignInCode).toHaveBeenCalledWith(
      { code: "964847", backup: false },
      expect.any(Headers),
    );

    await confirmTwoFactorSetupAction({}, form({ code: "۱۲۳۴۵۶" }));
    expect(identity.confirmTwoFactorSetup).toHaveBeenCalledWith(
      "123456",
      expect.objectContaining({ userId: "user-a" }),
      expect.any(Headers),
    );
  });
});

describe("the last step of two-factor's setup (ADR-0014)", () => {
  it("sends whoever the college required it of on to Today, and whoever chose it back to the profile", async () => {
    viewer.needsTwoFactorSetup = true;
    await confirmTwoFactorSetupAction({}, form({ code: "123456" }));
    expect(navigation.redirect).toHaveBeenLastCalledWith("/today");

    viewer.needsTwoFactorSetup = false;
    await confirmTwoFactorSetupAction({}, form({ code: "123456" }));
    expect(navigation.redirect).toHaveBeenLastCalledWith("/profile");
  });

  it("stays on the page for a wrong code", async () => {
    identity.confirmTwoFactorSetup.mockResolvedValueOnce({
      status: "invalid",
    } as never);
    expect(
      await confirmTwoFactorSetupAction({}, form({ code: "123456" })),
    ).toEqual({ data: { status: "invalid" } });
    expect(navigation.redirect).not.toHaveBeenCalled();
  });
});

describe("the password fields", () => {
  it("read Arabic-Indic digits as Latin, so a password set on one keyboard works on the other", async () => {
    await signInAction(
      {},
      form({ identifier: "200001", password: "oasis-٢٠٢٦" }),
    );
    expect(identity.signIn).toHaveBeenCalledWith(
      { identifier: "200001", password: "oasis-2026", remember: false },
      expect.any(Headers),
    );

    await startTwoFactorSetupAction({}, form({ password: "oasis-٢٠٢٦" }));
    expect(identity.startTwoFactorSetup).toHaveBeenCalledWith(
      expect.objectContaining({ password: "oasis-2026" }),
      expect.objectContaining({ userId: "user-a" }),
      expect.any(Headers),
    );

    // The confirmation is read the same way, so it matches the new password whichever digits it has.
    await changePasswordAction(
      {},
      form({
        currentPassword: "oasis-۲۰۲۶",
        newPassword: "new-oasis-٢٠٢٧",
        confirmPassword: "new-oasis-2027",
      }),
    );
    expect(identity.changePassword).toHaveBeenCalledWith(
      expect.objectContaining({
        currentPassword: "oasis-2026",
        newPassword: "new-oasis-2027",
      }),
      expect.objectContaining({ userId: "user-a" }),
      expect.any(Headers),
    );
  });
});

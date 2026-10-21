import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmTwoFactorSetupAction, verifyCodeAction } from "./actions.ts";

// The services the code fields reach, so the test sees what each action hands them.
const identity = vi.hoisted(() => ({
  verifySignInCode: vi.fn(async () => ({ status: "signedIn" as const })),
  confirmTwoFactorSetup: vi.fn(async () => ({ status: "enabled" as const })),
  getSessionUser: async () => ({
    userId: "user-a",
    collegeId: "college-a",
    sessionId: "session-a",
  }),
}));
vi.mock("@/modules/identity", () => identity);
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

beforeEach(() => {
  identity.verifySignInCode.mockClear();
  identity.confirmTwoFactorSetup.mockClear();
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

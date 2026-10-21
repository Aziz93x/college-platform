import { beforeEach, describe, expect, it, vi } from "vitest";
import { turnOffOwnTwoFactorAction } from "./actions.ts";

// The viewer the request carries, and the service the action reaches.
const request = vi.hoisted(() => ({ twoFactorRequired: false }));
vi.mock("../../../modules/access/server/viewer.ts", () => ({
  getViewer: async () => ({
    userId: "user-a",
    sessionId: "session-a",
    collegeId: "college-a",
    permissions: new Set(),
    grants: [],
    mustChangePassword: false,
    twoFactorRequired: request.twoFactorRequired,
    needsTwoFactorSetup: false,
  }),
}));
const identity = vi.hoisted(() => ({
  turnOffOwnTwoFactor: vi.fn(async () => ({ status: "off" as const })),
}));
vi.mock("@/modules/identity", () => identity);
const cache = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/cache", () => cache);
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

beforeEach(() => {
  vi.clearAllMocks();
  request.twoFactorRequired = false;
});

describe("turnOffOwnTwoFactorAction", () => {
  it("turns the viewer's own two-factor off with the password typed, and draws the page again", async () => {
    expect(await turnOffOwnTwoFactorAction({ password: "١٢٣٤-pass" })).toEqual({
      data: { status: "off" },
    });
    expect(identity.turnOffOwnTwoFactor).toHaveBeenCalledWith(
      "1234-pass",
      expect.objectContaining({ userId: "user-a", collegeId: "college-a" }),
      expect.any(Headers),
    );
    expect(cache.refresh).toHaveBeenCalledOnce();
  });

  it("refuses while the college requires two-factor of a key the viewer holds (ADR-0014)", async () => {
    request.twoFactorRequired = true;
    expect(await turnOffOwnTwoFactorAction({ password: "1234-pass" })).toEqual({
      data: { status: "required" },
    });
    expect(identity.turnOffOwnTwoFactor).not.toHaveBeenCalled();
  });
});

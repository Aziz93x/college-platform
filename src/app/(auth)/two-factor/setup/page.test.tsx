import { beforeEach, describe, expect, it, vi } from "vitest";
import TwoFactorSetupPage from "./page.tsx";

// The signed-in person as the page reads them, and the redirect that ends its rendering.
const viewer = vi.hoisted(() => ({
  current: null as Record<string, boolean> | null,
}));
vi.mock("@/modules/access", () => ({ getViewer: async () => viewer.current }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect ${path}`);
  },
}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));
vi.mock("./setup-form.tsx", () => ({ SetupForm: () => null }));

const person = (state: Record<string, boolean>) => ({
  mustChangePassword: false,
  needsTwoFactorSetup: false,
  twoFactorEnabled: false,
  twoFactorRequired: false,
  ...state,
});

beforeEach(() => {
  viewer.current = null;
});

describe("the required two-factor setup page", () => {
  it("sends someone whose required setup is done on to Today, where the setup's action sends them (lead review B)", async () => {
    viewer.current = person({
      twoFactorEnabled: true,
      twoFactorRequired: true,
    });
    await expect(TwoFactorSetupPage()).rejects.toThrow("redirect /today");
  });

  it("sends whoever chose two-factor to the profile, and whoever has not set it up to its setup there", async () => {
    viewer.current = person({ twoFactorEnabled: true });
    await expect(TwoFactorSetupPage()).rejects.toThrow("redirect /profile");

    viewer.current = person({});
    await expect(TwoFactorSetupPage()).rejects.toThrow(
      "redirect /profile/two-factor",
    );
  });

  it("shows the setup to whoever the college requires it of", async () => {
    viewer.current = person({ needsTwoFactorSetup: true });
    await expect(TwoFactorSetupPage()).resolves.toBeTruthy();
  });
});

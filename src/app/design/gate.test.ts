import { afterEach, expect, it, vi } from "vitest";
import { isDesignCatalogEnabled } from "./gate.ts";
import DesignPage from "./page.tsx";

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next-intl/server", () => ({
  getMessages: async () => ({ ui: {}, design: {} }),
  getTranslations: async () => (key: string) => key,
}));

afterEach(() => vi.unstubAllEnvs());

it("serves the design catalog on a laptop", () => {
  expect(isDesignCatalogEnabled({ APP_ENV: "local" })).toBe(true);
});

it("hides the design catalog on staging and in production", () => {
  expect(isDesignCatalogEnabled({ APP_ENV: "staging" })).toBe(false);
  expect(isDesignCatalogEnabled({ APP_ENV: "production" })).toBe(false);
});

// src/proxy.ts answers 404 first; the page refuses as well, so the catalog never renders even if
// that check is skipped.
it.each([
  "staging",
  "production",
])("the /design page renders not found on %s", async (appEnv) => {
  vi.stubEnv("APP_ENV", appEnv);
  vi.stubEnv("APP_URL", "http://localhost:3000");
  vi.stubEnv("DATABASE_URL", "postgres://user:password@localhost:5432/db");
  vi.stubEnv("SMTP_URL", "smtp://localhost:1025");
  await expect(DesignPage()).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
});

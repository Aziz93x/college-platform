import { afterEach, expect, it, vi } from "vitest";
import type { PermissionKey } from "@/modules/access";
import { isDesignCatalogEnabled } from "./gate.ts";
import DesignPage from "./page.tsx";

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next-intl/server", () => ({
  getLocale: async () => "ar",
  getMessages: async () => ({ ui: {}, design: {} }),
  getTranslations: async () => (key: string) => key,
}));

// The signed-in viewer, with the permissions each test gives them.
const viewer = vi.hoisted(() => ({
  collegeId: "college-a",
  permissions: new Set<string>(),
}));
vi.mock("@/modules/access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/access")>()),
  requireViewer: async () => viewer,
}));

function stubEnv(appEnv: string) {
  vi.stubEnv("APP_ENV", appEnv);
  vi.stubEnv("APP_URL", "http://localhost:3000");
  vi.stubEnv("DATABASE_URL", "postgres://user:password@localhost:5432/db");
  vi.stubEnv("SMTP_URL", "smtp://localhost:1025");
  vi.stubEnv("AUTH_SECRET", "unit-tests-secret-for-cookies-only");
}

afterEach(() => {
  vi.unstubAllEnvs();
  viewer.permissions.clear();
});

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
])("the /design page renders not found on %s, even for an admin", async (appEnv) => {
  stubEnv(appEnv);
  viewer.permissions.add("design.view" satisfies PermissionKey);
  await expect(DesignPage()).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
});

it("on a laptop, the /design page renders not found for a viewer without design.view", async () => {
  stubEnv("local");
  await expect(DesignPage()).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
});

it("on a laptop, the /design page renders the catalog for a viewer with design.view", async () => {
  stubEnv("local");
  viewer.permissions.add("design.view" satisfies PermissionKey);
  await expect(DesignPage()).resolves.toBeTruthy();
});

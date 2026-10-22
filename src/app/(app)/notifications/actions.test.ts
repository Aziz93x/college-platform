import { beforeEach, expect, it, vi } from "vitest";
import { chooseNotificationAction } from "./actions.ts";

// The signed-in person, and the service the preference reaches.
vi.mock("../../../modules/access/server/viewer.ts", () => ({
  getViewer: async () => ({
    userId: "user-a",
    collegeId: "college-a",
    permissions: new Set(),
    grants: [],
    mustChangePassword: false,
    needsTwoFactorSetup: false,
  }),
}));
vi.mock("@/modules/identity", () => ({ requestMeta: () => ({}) }));
const services = vi.hoisted(() => ({
  chooseNotification: vi.fn(async () => ({ status: "saved" as const })),
}));
vi.mock("@/modules/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/notifications")>()),
  ...services,
}));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

beforeEach(() => services.chooseNotification.mockClear());

it("turns off a kind its people may turn off, never an announcement (ADR-0017)", async () => {
  expect(
    (await chooseNotificationAction({ kind: "weeklyDigest", enabled: false }))
      ?.data,
  ).toEqual({ status: "saved" });
  const refused = await chooseNotificationAction({
    kind: "announcement",
    enabled: false,
  });
  expect(refused?.validationErrors).toBeDefined();
  expect(services.chooseNotification).toHaveBeenCalledTimes(1);
});

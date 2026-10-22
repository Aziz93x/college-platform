import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  publishAnnouncementAction,
  withdrawAnnouncementAction,
} from "./actions.ts";

const ELECTRICAL = "0199b2a4-6c1e-7d3a-9f00-3c5e8a1b2c4d";
const MECHANICAL = "0199b2a4-6c1e-7d3a-9f00-3c5e8a1b2c4e";
const ANNOUNCEMENT = "0199b2a4-6c1e-7d3a-9f00-3c5e8a1b2c4f";

// The viewer the request carries: a head with the key in Electrical, or the dean with it across the
// college; and the services the actions reach.
const request = vi.hoisted(() => ({
  userId: "head-a",
  departmentId: null as string | null,
}));
vi.mock("../../../modules/access/server/viewer.ts", () => ({
  getViewer: async () => ({
    userId: request.userId,
    collegeId: "college-a",
    permissions: new Set(["announcements.publish"]),
    grants: [
      {
        permission: "announcements.publish",
        departmentId: request.departmentId,
      },
    ],
    mustChangePassword: false,
    needsTwoFactorSetup: false,
  }),
}));
vi.mock("@/modules/identity", () => ({ requestMeta: () => ({}) }));
const services = vi.hoisted(() => ({
  publishAnnouncement: vi.fn(async () => ({
    status: "published" as const,
    id: "a1",
    reached: 3,
  })),
  findAnnouncement: vi.fn(
    async (): Promise<
      { id: string; authorId: string; departmentId: string | null } | undefined
    > => undefined,
  ),
  withdrawAnnouncement: vi.fn(async () => ({
    status: "withdrawn" as const,
    removed: 3,
  })),
}));
vi.mock("@/modules/announcements", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/announcements")>()),
  ...services,
}));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const asHead = () =>
  Object.assign(request, { userId: "head-a", departmentId: ELECTRICAL });
const asDean = () =>
  Object.assign(request, { userId: "dean-a", departmentId: null });

beforeEach(() => {
  for (const service of Object.values(services)) service.mockClear();
});

describe("publishing", () => {
  it("lets a head announce to their department, not to another or to the college", async () => {
    asHead();
    const to = (departmentId: string | null) =>
      publishAnnouncementAction({ departmentId, title: "t", body: "b" });
    expect((await to(ELECTRICAL))?.data).toEqual({
      status: "published",
      id: "a1",
      reached: 3,
    });
    expect((await to(MECHANICAL))?.serverError).toBe("forbidden");
    expect((await to(null))?.serverError).toBe("forbidden");
    expect(services.publishAnnouncement).toHaveBeenCalledTimes(1);
  });

  it("lets the dean announce to the college and to any department", async () => {
    asDean();
    for (const departmentId of [null, MECHANICAL]) {
      expect(
        (
          await publishAnnouncementAction({
            departmentId,
            title: "t",
            body: "b",
          })
        )?.data,
      ).toMatchObject({ status: "published" });
    }
  });
});

describe("withdrawing", () => {
  it("lets its author withdraw it, and another head not", async () => {
    asHead();
    services.findAnnouncement.mockResolvedValue({
      id: ANNOUNCEMENT,
      authorId: "head-a",
      departmentId: ELECTRICAL,
    });
    expect(
      (await withdrawAnnouncementAction({ id: ANNOUNCEMENT }))?.data,
    ).toEqual({ status: "withdrawn", removed: 3 });
    services.findAnnouncement.mockResolvedValue({
      id: ANNOUNCEMENT,
      authorId: "dean-a",
      departmentId: ELECTRICAL,
    });
    expect(
      (await withdrawAnnouncementAction({ id: ANNOUNCEMENT }))?.serverError,
    ).toBe("forbidden");
    expect(services.withdrawAnnouncement).toHaveBeenCalledTimes(1);
  });

  it("lets the dean withdraw anyone's, and answers notFound for one already gone", async () => {
    asDean();
    services.findAnnouncement.mockResolvedValue({
      id: ANNOUNCEMENT,
      authorId: "head-a",
      departmentId: ELECTRICAL,
    });
    expect(
      (await withdrawAnnouncementAction({ id: ANNOUNCEMENT }))?.data,
    ).toMatchObject({ status: "withdrawn" });
    services.findAnnouncement.mockResolvedValue(undefined);
    expect(
      (await withdrawAnnouncementAction({ id: ANNOUNCEMENT }))?.data,
    ).toEqual({ status: "notFound" });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendQuickRequestAction } from "@/app/(app)/requests/actions";

// What the sender reads once their request is kept with its pass queued (lead review D): whatever
// fails after, such as the database going away mid-pass, the worker runs the pass, so they read
// that its tasks are coming, never "try again", which would send the request twice (ADR-0032).
const ID = "0199b2a4-6c1e-7d3a-9f00-3c5e8a1b2c4d";
const mocks = vi.hoisted(() => ({
  runNow: vi.fn(),
  itemAssignees: vi.fn(),
  logged: vi.fn(),
  refreshed: vi.fn(),
}));
vi.mock("../../src/modules/access/server/viewer.ts", () => ({
  getViewer: async () => ({
    userId: "vice-dean",
    sessionId: "session",
    collegeId: "college",
    grants: [{ permission: "requests.send", departmentId: null }],
    permissions: new Set(["requests.send"]),
    roleKeys: ["viceDean"],
    mustChangePassword: false,
    twoFactorRequired: false,
    needsTwoFactorSetup: false,
  }),
}));
vi.mock("@/modules/requests", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/requests")>()),
  sendQuickRequest: async () => ({ status: "sent", id: ID, runId: ID }),
}));
vi.mock("@/modules/tasks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/tasks")>()),
  runNow: mocks.runNow,
  itemAssignees: mocks.itemAssignees,
}));
vi.mock("@/platform/logging/request-logger", () => ({
  getRequestLogger: async () => ({ error: mocks.logged }),
}));
vi.mock("next/cache", () => ({ refresh: mocks.refreshed }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const send = () =>
  sendQuickRequestAction({
    termId: ID,
    departmentId: null,
    title: "Attendance sheets",
    axisId: ID,
    dueOn: "2026-03-05",
    targets: { type: "everyone" },
    evidence: true,
  });
const outage = new Error("Connection terminated unexpectedly");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.runNow.mockResolvedValue("done");
  mocks.itemAssignees.mockResolvedValue([{ userId: ID, departmentId: ID }]);
});

describe("a quick request kept with its pass", () => {
  it("reads sent with whom its pass reached, or pending when the worker runs it", async () => {
    expect((await send())?.data).toEqual({ status: "sent", reached: 1 });
    mocks.runNow.mockResolvedValue("pending");
    expect((await send())?.data).toEqual({ status: "pending" });
    expect(mocks.refreshed).toHaveBeenCalledTimes(2);
  });

  it("reads pending, never try again, when its pass or the count after it fails, and the failure is logged", async () => {
    mocks.runNow.mockRejectedValue(outage);
    expect(await send()).toEqual({ data: { status: "pending" } });
    mocks.runNow.mockResolvedValue("done");
    mocks.itemAssignees.mockRejectedValue(outage);
    expect(await send()).toEqual({ data: { status: "pending" } });
    expect(mocks.logged).toHaveBeenCalledTimes(2);
    expect(mocks.logged).toHaveBeenCalledWith(
      { err: outage, action: "sendQuickRequest" },
      expect.any(String),
    );
    // The requests page reads the request again either way.
    expect(mocks.refreshed).toHaveBeenCalledTimes(2);
  });
});

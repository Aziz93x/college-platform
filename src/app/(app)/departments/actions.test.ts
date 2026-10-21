import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDepartmentAction,
  updateCollegeAction,
  updateDepartmentAction,
} from "./actions.ts";

// The viewer the request carries, and the services the actions reach, so each test sees what the
// actions hand them.
const request = vi.hoisted(() => ({
  permissions: new Set<string>(["departments.manage", "college.manage"]),
}));
vi.mock("../../../modules/access/server/viewer.ts", () => ({
  getViewer: async () => ({
    userId: "user-a",
    sessionId: "session-a",
    collegeId: "college-a",
    permissions: request.permissions,
    mustChangePassword: false,
    needsTwoFactorSetup: false,
  }),
}));
vi.mock("@/modules/identity", () => ({
  requestMeta: () => ({ ip: "10.0.30.1", userAgent: "unit-test" }),
}));
const services = vi.hoisted(() => ({
  createDepartment: vi.fn(async () => ({
    status: "created" as const,
    id: "department-a",
  })),
  updateDepartment: vi.fn(async () => ({ status: "saved" as const })),
  updateCollege: vi.fn(async () => ({ status: "saved" as const })),
}));
vi.mock("@/modules/org", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/org")>()),
  ...services,
}));
const cache = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/cache", () => cache);
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const change = {
  collegeId: "college-a",
  actorId: "user-a",
  ip: "10.0.30.1",
  userAgent: "unit-test",
};
const department = {
  name: "  Electrical   Technology ",
  shortName: "Elec",
  rayatValues: ["Electrical"],
  active: true,
};
const ID = "0199b2a4-6c1e-7d3a-9f00-3c5e8a1b2c4d";

beforeEach(() => {
  vi.clearAllMocks();
  request.permissions = new Set(["departments.manage", "college.manage"]);
});

describe("createDepartmentAction", () => {
  it("adds the department as tidied, as the viewer, from the request's address", async () => {
    expect(await createDepartmentAction(department)).toEqual({
      data: { status: "created", id: "department-a" },
    });
    expect(services.createDepartment).toHaveBeenCalledWith(
      { ...department, name: "Electrical Technology" },
      change,
    );
    // The form goes to the list, which is read afresh: nothing to draw again here.
    expect(cache.refresh).not.toHaveBeenCalled();
  });

  it("refuses a viewer who does not manage the departments", async () => {
    request.permissions = new Set(["college.manage"]);
    expect(await createDepartmentAction(department)).toEqual({
      serverError: "forbidden",
    });
    expect(services.createDepartment).not.toHaveBeenCalled();
  });

  it.each([
    ["an empty name", { name: "  " }],
    ["no Rayat value", { rayatValues: [] }],
    ["one Rayat value twice", { rayatValues: ["Elec", " Elec "] }],
  ])("refuses %s before it reaches the database", async (_name, patch) => {
    const result = await createDepartmentAction({ ...department, ...patch });
    expect(result?.validationErrors).toBeDefined();
    expect(services.createDepartment).not.toHaveBeenCalled();
  });
});

describe("updateDepartmentAction", () => {
  it("saves the department the id names and draws the page again", async () => {
    expect(await updateDepartmentAction({ ...department, id: ID })).toEqual({
      data: { status: "saved" },
    });
    expect(services.updateDepartment).toHaveBeenCalledWith(
      ID,
      { ...department, name: "Electrical Technology" },
      change,
    );
    expect(cache.refresh).toHaveBeenCalledOnce();
  });

  it("draws nothing again when the save changed nothing or was refused", async () => {
    services.updateDepartment.mockResolvedValueOnce({
      status: "unchanged",
    } as never);
    await updateDepartmentAction({ ...department, id: ID });
    services.updateDepartment.mockResolvedValueOnce({
      status: "nameTaken",
    } as never);
    expect(await updateDepartmentAction({ ...department, id: ID })).toEqual({
      data: { status: "nameTaken" },
    });
    expect(cache.refresh).not.toHaveBeenCalled();
  });

  it("refuses an id that names no department", async () => {
    const result = await updateDepartmentAction({ ...department, id: "1" });
    expect(result?.validationErrors).toBeDefined();
    expect(services.updateDepartment).not.toHaveBeenCalled();
  });
});

describe("updateCollegeAction", () => {
  it("saves the college's names with college.manage alone, and draws the page again", async () => {
    request.permissions = new Set(["college.manage"]);
    expect(
      await updateCollegeAction({ name: "Oasis College", shortName: "Oasis" }),
    ).toEqual({ data: { status: "saved" } });
    expect(services.updateCollege).toHaveBeenCalledWith(
      { name: "Oasis College", shortName: "Oasis" },
      change,
    );
    expect(cache.refresh).toHaveBeenCalledOnce();
  });

  it("refuses a viewer who manages the departments but not the college", async () => {
    request.permissions = new Set(["departments.manage"]);
    expect(
      await updateCollegeAction({ name: "Oasis College", shortName: "Oasis" }),
    ).toEqual({ serverError: "forbidden" });
    expect(services.updateCollege).not.toHaveBeenCalled();
  });
});

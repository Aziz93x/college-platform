import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadsWhole } from "@/app/(app)/_shell/term-cookie";
import { GET } from "@/app/(app)/switch-term/[id]/route";
import {
  notificationKindKeys,
  notificationPage,
} from "@/modules/notifications";

// The link a reminder of the readiness board opens: the row's page on the row's term, chosen as the
// header chooses it, for a viewer who may see that term (lead review D).
const terms = vi.hoisted(() => ({ visible: [{ id: "next" }] }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));
vi.mock("@/modules/access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/access")>()),
  requireViewer: async () => ({ userId: "head", collegeId: "college" }),
}));
vi.mock("../../src/app/(app)/_shell/term.ts", () => ({
  preparesTerms: () => true,
  visibleTerms: async () => terms.visible,
}));

const open = (id: string, next?: string) =>
  GET(
    new Request(
      `https://college.example/switch-term/${id}${next === undefined ? "" : `?next=${encodeURIComponent(next)}`}`,
    ),
    { params: Promise.resolve({ id }) },
  );

beforeEach(() => {
  terms.visible = [{ id: "next" }];
});

describe("opening a page on a term", () => {
  it("chooses the term the viewer may see, as the header does, and opens the page", async () => {
    const response = await open("next", "/plan?department=electrical");
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "/plan?department=electrical",
    );
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^term=next; Path=\/;/);
    // A year, as the header keeps the viewer's choice.
    expect(cookie).toMatch(/Max-Age=31536000/);
    expect(cookie).toMatch(/SameSite=lax/i);
  });

  it("opens the page without choosing a term the viewer may not see", async () => {
    terms.visible = [];
    const response = await open("next", "/plan?department=electrical");
    expect(response.headers.get("location")).toBe(
      "/plan?department=electrical",
    );
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("opens Today for anything but a page of the platform", async () => {
    for (const next of [
      undefined,
      "//elsewhere.example/plan",
      "https://elsewhere.example/plan",
      "/\\elsewhere.example",
    ]) {
      expect(
        (await open("next", next)).headers.get("location"),
        String(next),
      ).toBe("/today");
    }
  });

  it("is the link the notices list and the bell load whole, so the header follows, and no other notice's", () => {
    expect(
      loadsWhole(
        notificationPage("readinessReminder", {
          title: "",
          detail: "",
          from: "",
          href: "/plan",
          termId: "next",
          term: "",
        }),
      ),
    ).toBe(true);
    for (const kind of notificationKindKeys) {
      if (kind === "readinessReminder") continue;
      expect(loadsWhole(notificationPage(kind, { href: "/plan" })), kind).toBe(
        false,
      );
    }
  });
});

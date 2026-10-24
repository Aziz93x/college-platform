import { describe, expect, it } from "vitest";
import { rowOpens } from "@/app/(app)/readiness/rows";
import type { Grant } from "@/modules/access";
import type { ReadinessRow } from "@/modules/readiness";

// The readiness board links a row only where its viewer opens the page that settles it, by that
// page's own rule (lead review D, M5): here the term's page, which shows a draft to whoever manages
// the college's terms alone, while whoever prepares a department's plan sees the draft's board.
const viewer = (...grants: Grant[]) => ({
  userId: "viewer",
  collegeId: "college",
  grants,
});
const head = viewer(
  ...(["plan.edit", "plan.publish", "readiness.view"] as const).map(
    (permission) => ({ permission, departmentId: "electrical" }),
  ),
);
const viceDean = viewer(
  ...(["term.manage", "plan.view", "readiness.view"] as const).map(
    (permission) => ({ permission, departmentId: null }),
  ),
);
const termRow = (status: "draft" | "active"): ReadinessRow => ({
  id: "term",
  status,
  state: status === "draft" ? "open" : "done",
  owners: [],
  href: "/terms/next",
});
const framework: ReadinessRow = {
  id: "framework",
  state: "open",
  owners: [],
  href: "/framework",
};

describe("the board's links to the term's page", () => {
  it("leave a draft's page to whoever manages the college's terms", () => {
    expect(rowOpens(head)(termRow("draft"))).toBe(false);
    expect(rowOpens(viceDean)(termRow("draft"))).toBe(true);
  });

  it("open an active term's page, and the framework, to every viewer", () => {
    for (const each of [head, viceDean]) {
      expect(rowOpens(each)(termRow("active"))).toBe(true);
      expect(rowOpens(each)(framework)).toBe(true);
    }
  });
});

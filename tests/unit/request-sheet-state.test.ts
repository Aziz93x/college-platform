import { describe, expect, it } from "vitest";
import { openingDay, problemOf } from "@/app/(app)/requests/sheet-state";

// The request sheet keeps its fields while the page stays open, across refreshes, a step back and a
// change of the term on view (lead review D): the day it opens on is the one the page reckons now
// unless the sender picked a day the request may still be due on.
const week = {
  min: "2026-10-25",
  max: "2027-01-07",
  off: ["2026-11-19"],
  starts: "2026-10-29",
};

describe("the day the request sheet opens on", () => {
  it("is the page's day now, though the day it opened on before is still allowed, when the sender never picked one", () => {
    expect(openingDay(week, { dueOn: "2026-11-05", picked: false })).toBe(
      "2026-10-29",
    );
  });

  it("keeps the day the sender picked while the request may be due on it", () => {
    expect(openingDay(week, { dueOn: "2026-11-05", picked: true })).toBe(
      "2026-11-05",
    );
  });

  it("is the page's day once the picked one has passed, is off since, or lies outside the term on view", () => {
    for (const dueOn of ["2026-10-22", "2026-11-19", "2027-01-10"]) {
      expect(openingDay(week, { dueOn, picked: true }), dueOn).toBe(
        "2026-10-29",
      );
    }
  });
});

describe("what the sheet says of a request not sent", () => {
  it("names a field the schema refused, which no try again would change, apart from the action's refusals", () => {
    expect(
      problemOf({ validationErrors: { targets: { _errors: ["Invalid"] } } }),
    ).toEqual({ refusal: "invalid" });
    expect(problemOf({ serverError: "forbidden" })).toEqual({
      action: "forbidden",
    });
    expect(problemOf(undefined)).toEqual({ action: "unexpected" });
  });
});

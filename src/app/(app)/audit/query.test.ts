import { describe, expect, it } from "vitest";
import { auditHref } from "./href.ts";
import { parseAuditQuery, parseCursor } from "./query.ts";

const cursor = {
  at: "2026-10-01 10:00:00.123456+00",
  id: "0199b2a4-0000-7000-8000-000000000001",
};

describe("parseAuditQuery", () => {
  it("reads a period, an action, a search and a cursor, and writes them back", () => {
    const query = {
      from: "2026-10-01",
      to: "2026-10-21",
      action: "account.resetPassword" as const,
      q: "فهد",
      after: cursor,
    };
    const href = auditHref("/audit", query);
    expect(
      parseAuditQuery(
        Object.fromEntries(new URL(href, "http://x").searchParams),
      ),
    ).toEqual(query);
  });

  it("leaves out whatever does not parse, and an end before its start or without one", () => {
    expect(
      parseAuditQuery({
        from: "2026-10-21",
        to: "2026-10-01",
        action: "college.delete",
        q: "   ",
        after: "1 OR 1=1",
      }),
    ).toEqual({ from: "2026-10-21" });
    expect(parseAuditQuery({ from: ["2026-10-01", "x"] })).toEqual({
      from: "2026-10-01",
    });
    expect(parseAuditQuery({ to: "2026-10-21" })).toEqual({});
  });
});

it("auditHref leaves an empty query off the address", () => {
  expect(auditHref("/audit", {})).toBe("/audit");
});

it("parseCursor reads a history panel's cursor, and nothing else", () => {
  expect(parseCursor(`${cursor.at}|${cursor.id}`)).toEqual(cursor);
  expect(parseCursor([`${cursor.at}|${cursor.id}`, "x"])).toEqual(cursor);
  expect(parseCursor("1 OR 1=1")).toBeUndefined();
  expect(parseCursor(undefined)).toBeUndefined();
});

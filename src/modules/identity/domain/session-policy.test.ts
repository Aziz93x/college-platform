import { describe, expect, it } from "vitest";
import { isLastSeenStale, sessionEnd } from "./session-policy.ts";

const limits = { idleMinutes: 60, sessionHours: 12, rememberedDeviceDays: 30 };
const at = (iso: string) => new Date(iso);
const created = at("2026-10-20T08:00:00Z");
// Better Auth's own expiry, past every limit here.
const expiresAt = at("2027-01-18T08:00:00Z");

describe("sessionEnd", () => {
  it("keeps a remembered device for its days, however long it sits idle", () => {
    expect(
      sessionEnd(
        {
          remembered: true,
          createdAt: created,
          expiresAt,
          lastSeenAt: created,
        },
        limits,
      ),
    ).toEqual(at("2026-11-19T08:00:00Z"));
  });

  it("ends any other session after the idle time without a request", () => {
    expect(
      sessionEnd(
        {
          remembered: false,
          createdAt: created,
          expiresAt,
          lastSeenAt: at("2026-10-20T09:30:00Z"),
        },
        limits,
      ),
    ).toEqual(at("2026-10-20T10:30:00Z"));
  });

  it("ends any other session after its hours, however busy", () => {
    expect(
      sessionEnd(
        {
          remembered: false,
          createdAt: created,
          expiresAt,
          lastSeenAt: at("2026-10-20T19:50:00Z"),
        },
        limits,
      ),
    ).toEqual(at("2026-10-20T20:00:00Z"));
  });

  it("never outlasts Better Auth's expiry", () => {
    const early = at("2026-10-20T08:30:00Z");
    expect(
      sessionEnd(
        {
          remembered: true,
          createdAt: created,
          expiresAt: early,
          lastSeenAt: created,
        },
        limits,
      ),
    ).toEqual(early);
  });
});

describe("isLastSeenStale", () => {
  it("asks for a write once a minute has passed", () => {
    const seen = at("2026-10-20T08:00:00Z");
    expect(isLastSeenStale(seen, at("2026-10-20T08:00:59Z"))).toBe(false);
    expect(isLastSeenStale(seen, at("2026-10-20T08:01:00Z"))).toBe(true);
  });
});

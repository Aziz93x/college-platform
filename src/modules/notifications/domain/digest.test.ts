import { describe, expect, it } from "vitest";
import {
  digestKey,
  digestOf,
  digestWeek,
  isDigestDue,
  lastDigestMoment,
} from "./digest.ts";

// The default: Sunday at 7:00 in Riyadh, which is 4:00 UTC.
const riyadh = { weekday: 0, hour: 7, timeZone: "Asia/Riyadh" };

describe("lastDigestMoment", () => {
  it("is this week's digest from its hour on, last week's before it", () => {
    expect(lastDigestMoment(new Date("2026-10-25T04:00:00Z"), riyadh)).toEqual({
      day: "2026-10-25",
      at: new Date("2026-10-25T04:00:00Z"),
    });
    expect(lastDigestMoment(new Date("2026-10-25T03:59:59Z"), riyadh).day).toBe(
      "2026-10-18",
    );
    // Wednesday, then the Saturday before the next one.
    expect(lastDigestMoment(new Date("2026-10-28T12:00:00Z"), riyadh).day).toBe(
      "2026-10-25",
    );
    expect(lastDigestMoment(new Date("2026-10-31T23:00:00Z"), riyadh).day).toBe(
      "2026-10-25",
    );
  });

  it("reads the day on the college's clock, not UTC's", () => {
    // Sunday 1:00 in Riyadh is still Saturday in UTC; a Sunday-midnight digest has fallen due.
    expect(
      lastDigestMoment(new Date("2026-10-24T22:00:00Z"), {
        weekday: 0,
        hour: 0,
        timeZone: "Asia/Riyadh",
      }),
    ).toEqual({ day: "2026-10-25", at: new Date("2026-10-24T21:00:00Z") });
  });

  it("follows a zone across its clock change", () => {
    // Berlin leaves summer time on Sunday 25 October 2026: 7:00 that morning is 6:00 UTC.
    const berlin = { weekday: 0, hour: 7, timeZone: "Europe/Berlin" };
    expect(lastDigestMoment(new Date("2026-10-25T06:30:00Z"), berlin)).toEqual({
      day: "2026-10-25",
      at: new Date("2026-10-25T06:00:00Z"),
    });
    expect(lastDigestMoment(new Date("2026-10-25T05:30:00Z"), berlin)).toEqual({
      day: "2026-10-18",
      at: new Date("2026-10-18T05:00:00Z"),
    });
  });
});

describe("isDigestDue", () => {
  const moment = { day: "2026-10-25", at: new Date("2026-10-25T04:00:00Z") };

  it("is due for a day after its moment, so a worker that was off still sends it", () => {
    expect(isDigestDue(new Date("2026-10-25T04:00:00Z"), moment)).toBe(true);
    expect(isDigestDue(new Date("2026-10-26T03:59:59Z"), moment)).toBe(true);
    expect(isDigestDue(new Date("2026-10-26T04:00:00Z"), moment)).toBe(false);
  });
});

it("a digest covers the seven days before its moment and is keyed by its day", () => {
  const moment = { day: "2026-10-25", at: new Date("2026-10-25T04:00:00Z") };
  expect(digestWeek(moment)).toEqual({
    from: new Date("2026-10-18T04:00:00Z"),
    to: new Date("2026-10-25T04:00:00Z"),
  });
  expect(digestKey(moment)).toBe("weeklyDigest:2026-10-25");
});

it("a digest counts every unread notification, names the newest three and keeps which they all are", () => {
  const sent = (n: number) => ({ kind: "membershipAdded", params: { n } });
  const unread = (n: number) => ({ id: `id-${n}`, ...sent(n) });
  expect(
    digestOf([unread(5), unread(4), unread(3), unread(2), unread(1)]),
  ).toEqual({
    count: 5,
    latest: [sent(5), sent(4), sent(3)],
    ids: ["id-5", "id-4", "id-3", "id-2", "id-1"],
  });
  expect(digestOf([unread(1)])).toEqual({
    count: 1,
    latest: [sent(1)],
    ids: ["id-1"],
  });
});

import { describe, expect, it } from "vitest";
import {
  addDays,
  atHour,
  nextDay,
  startOfDay,
  wallClock,
} from "./time-zone.ts";

describe("startOfDay", () => {
  it("is the zone's midnight, as an instant", () => {
    expect(startOfDay("2026-10-21", "Asia/Riyadh").toISOString()).toBe(
      "2026-10-20T21:00:00.000Z",
    );
    expect(startOfDay("2026-10-21", "UTC").toISOString()).toBe(
      "2026-10-21T00:00:00.000Z",
    );
  });

  it("follows a zone across its clock changes", () => {
    // Berlin keeps summer time until 25 October 2026.
    expect(startOfDay("2026-10-21", "Europe/Berlin").toISOString()).toBe(
      "2026-10-20T22:00:00.000Z",
    );
    expect(startOfDay("2026-10-26", "Europe/Berlin").toISOString()).toBe(
      "2026-10-25T23:00:00.000Z",
    );
  });
});

it("atHour is the zone's clock at that hour, across its clock changes", () => {
  expect(atHour("2026-10-25", 7, "Asia/Riyadh").toISOString()).toBe(
    "2026-10-25T04:00:00.000Z",
  );
  // Berlin's clocks go back at 3:00 on 25 October 2026; 7:00 that morning is UTC+1.
  expect(atHour("2026-10-25", 7, "Europe/Berlin").toISOString()).toBe(
    "2026-10-25T06:00:00.000Z",
  );
  expect(atHour("2026-10-24", 7, "Europe/Berlin").toISOString()).toBe(
    "2026-10-24T05:00:00.000Z",
  );
});

it("nextDay crosses months and years", () => {
  expect(nextDay("2026-10-31")).toBe("2026-11-01");
  expect(nextDay("2026-12-31")).toBe("2027-01-01");
});

it("addDays counts back as well as forward", () => {
  expect(addDays("2026-11-02", -7)).toBe("2026-10-26");
  expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
  expect(addDays("2026-10-25", 0)).toBe("2026-10-25");
});

it("wallClock reads an instant on the zone's clock", () => {
  const instant = new Date("2026-10-20T21:30:05.250Z");
  expect(wallClock(instant, "Asia/Riyadh")).toBe("2026-10-21 00:30:05");
  expect(wallClock(instant, "UTC")).toBe("2026-10-20 21:30:05");
});

import { expect, it } from "vitest";
import { greetingPeriod } from "./greeting.ts";

it.each([
  ["2026-10-20T03:30:00Z", "morning"], // 06:30 in Riyadh
  ["2026-10-20T08:59:00Z", "morning"], // 11:59
  ["2026-10-20T09:00:00Z", "evening"], // 12:00
  ["2026-10-20T20:30:00Z", "evening"], // 23:30
  ["2026-10-20T21:30:00Z", "morning"], // 00:30 the next day
])("%s is %s in Riyadh", (instant, period) => {
  expect(greetingPeriod(new Date(instant), "Asia/Riyadh")).toBe(period);
});

it("reads the hour on the college's clock, not the server's", () => {
  const instant = new Date("2026-10-20T10:00:00Z");
  expect(greetingPeriod(instant, "Asia/Riyadh")).toBe("evening"); // 13:00
  expect(greetingPeriod(instant, "America/Los_Angeles")).toBe("morning"); // 03:00
});

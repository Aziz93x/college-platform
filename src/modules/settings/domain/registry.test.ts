import { expect, it } from "vitest";
import { settingsRegistry } from "./registry.ts";

it.each(
  Object.entries(settingsRegistry),
)("the default of %s passes its own schema", (_key, setting) => {
  expect(setting.schema.safeParse(setting.default).success).toBe(true);
});

const timeZone = settingsRegistry["locale.timeZone"].schema;

// Intl.supportedValuesOf("timeZone") leaves out all four.
it.each([
  "UTC",
  "Etc/UTC",
  "Asia/Kolkata",
  "Europe/Kyiv",
])("accepts the time zone %s", (value) => {
  expect(timeZone.safeParse(value).success).toBe(true);
});

it.each([
  "Mars/Olympus",
  "",
  "+03:00",
])("rejects %j as a time zone", (value) => {
  expect(timeZone.safeParse(value).success).toBe(false);
});

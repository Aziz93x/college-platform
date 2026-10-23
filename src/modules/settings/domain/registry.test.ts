import { expect, it } from "vitest";
import {
  needsPassword,
  type SettingKey,
  settingsRegistry,
} from "./registry.ts";

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

const navigationOrder = settingsRegistry["navigation.order"].schema;

it("accepts an order of page ids for each role key", () => {
  expect(
    navigationOrder.safeParse({ trainer: ["today"], head: [] }).success,
  ).toBe(true);
});

it.each([
  ["a list without role keys", ["today"]],
  ["an order that is not a list", { trainer: "today" }],
  ["a page id that is not text", { trainer: [7] }],
])("rejects %s as a navigation order", (_name, value) => {
  expect(navigationOrder.safeParse(value).success).toBe(false);
});

// Who gets in and for how long, and how long history is kept (Audit 3).
it("asks for the password again for the security settings and the audit log's retention only", () => {
  const keys = Object.keys(settingsRegistry) as SettingKey[];
  expect(keys.filter(needsPassword)).toEqual(
    keys.filter(
      (key) =>
        settingsRegistry[key].group === "security" ||
        key === "audit.retentionMonths",
    ),
  );
  expect(needsPassword("audit.retentionMonths")).toBe(true);
  expect(needsPassword("reminders.digestHour")).toBe(false);
});

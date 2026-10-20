import { existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { settingsRegistry } from "@/modules/settings";
import { documentLocale, loadCollegeLocale } from "./locale.ts";

describe("documentLocale", () => {
  it.each([
    ["ar", "rtl"],
    ["fa", "rtl"],
    ["en", "ltr"],
    ["fr", "ltr"],
  ])("gives %s the direction %s", (language, dir) => {
    expect(documentLocale(language)).toEqual({ lang: language, dir });
  });
});

describe("loadCollegeLocale", () => {
  it("uses the stored language and time zone of the deployment's college", async () => {
    const stored = { "locale.language": "en", "locale.timeZone": "UTC" };
    const read = {
      findCollegeId: vi.fn().mockResolvedValue("college-1"),
      getSetting: vi
        .fn()
        .mockImplementation(async (key: keyof typeof stored) => stored[key]),
    };

    await expect(loadCollegeLocale(read)).resolves.toEqual({
      lang: "en",
      dir: "ltr",
      timeZone: "UTC",
    });
    expect(read.getSetting).toHaveBeenCalledWith("locale.language", {
      collegeId: "college-1",
    });
    expect(read.getSetting).toHaveBeenCalledWith("locale.timeZone", {
      collegeId: "college-1",
    });
  });

  it("uses the registered defaults before a college exists", async () => {
    const read = {
      findCollegeId: vi.fn().mockResolvedValue(undefined),
      getSetting: vi.fn(),
    };

    await expect(loadCollegeLocale(read)).resolves.toEqual({
      ...documentLocale(settingsRegistry["locale.language"].default),
      timeZone: settingsRegistry["locale.timeZone"].default,
    });
    expect(read.getSetting).not.toHaveBeenCalled();
  });
});

// src/i18n/request.ts imports messages/<language>.json for the stored language.
it.each(
  settingsRegistry["locale.language"].schema.options,
)("the language %s has a message catalog", (language) => {
  expect(
    existsSync(new URL(`../../messages/${language}.json`, import.meta.url)),
  ).toBe(true);
});

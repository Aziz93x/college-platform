import { existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { settingsRegistry } from "@/modules/settings";
import { documentLocale } from "@/platform/i18n/language";
import { loadCollegeLocale } from "./locale.ts";

describe("loadCollegeLocale", () => {
  it("uses the stored language, time zone and digits of the deployment's college", async () => {
    const stored = {
      "locale.language": "en",
      "locale.timeZone": "UTC",
      "locale.digits": "arab",
      "locale.weekStart": "saturday",
    };
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
      // next-intl formats every date and number in the college's digits, and calendars start on
      // its first day of the week.
      locale: "en-u-fw-sat-nu-arab",
    });
    expect(read.getSetting).toHaveBeenCalledWith("locale.language", {
      collegeId: "college-1",
    });
    expect(read.getSetting).toHaveBeenCalledWith("locale.timeZone", {
      collegeId: "college-1",
    });
    for (const key of ["locale.digits", "locale.weekStart"]) {
      expect(read.getSetting).toHaveBeenCalledWith(key, {
        collegeId: "college-1",
      });
    }
  });

  it("uses the registered defaults before a college exists", async () => {
    const read = {
      findCollegeId: vi.fn().mockResolvedValue(undefined),
      getSetting: vi.fn(),
    };

    const language = settingsRegistry["locale.language"].default;
    await expect(loadCollegeLocale(read)).resolves.toEqual({
      ...documentLocale(language),
      timeZone: settingsRegistry["locale.timeZone"].default,
      locale: `${language}-u-fw-sun-nu-${settingsRegistry["locale.digits"].default}`,
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

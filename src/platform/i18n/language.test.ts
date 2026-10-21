import { describe, expect, it } from "vitest";
import { documentLocale, firstDayOfWeek } from "./language.ts";

describe("documentLocale", () => {
  it.each([
    ["ar", "rtl"],
    ["fa", "rtl"],
    ["en", "ltr"],
    ["fr", "ltr"],
  ])("gives %s the direction %s", (language, dir) => {
    expect(documentLocale(language)).toEqual({ lang: language, dir });
  });

  it("takes the language alone from a locale with extensions", () => {
    expect(documentLocale("ar-u-nu-latn")).toEqual({ lang: "ar", dir: "rtl" });
  });
});

describe("firstDayOfWeek", () => {
  it.each([
    ["ar-u-fw-sun-nu-latn", 0],
    ["ar-u-fw-sat-nu-arab", 6],
    ["en-u-fw-mon", 1],
    // No keyword, or one Intl does not define: Sunday.
    ["ar", 0],
    ["ar-u-nu-latn", 0],
  ])("reads %s as day %i", (locale, day) => {
    expect(firstDayOfWeek(locale)).toBe(day);
  });
});

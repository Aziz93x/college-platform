import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { documentLocale, firstDayOfWeek } from "./language.ts";

const DIRECTIONS = [
  ["ar", "rtl"],
  ["fa", "rtl"],
  ["ur", "rtl"],
  ["he", "rtl"],
  ["en", "ltr"],
  ["fr", "ltr"],
] as const;

describe("documentLocale", () => {
  it.each(DIRECTIONS)("gives %s the direction %s", (language, dir) => {
    expect(documentLocale(language)).toEqual({ lang: language, dir });
  });

  it("takes the language alone from a locale with extensions", () => {
    expect(documentLocale("ar-u-nu-latn")).toEqual({ lang: "ar", dir: "rtl" });
  });
});

// Engines from before Intl.Locale#getTextInfo(): Safari 15.4 to 16 and Chrome 99 to 129 have the
// textInfo property instead, Firefox before 153 neither. Node's own answer is removed for each case:
// the method in Node 24, the property in Node 22.
describe.each([
  ["has only the textInfo property", true],
  ["has neither", false],
])("documentLocale in an engine that %s", (_, withProperty) => {
  const prototype = Intl.Locale.prototype;
  const saved = (["getTextInfo", "textInfo"] as const).map(
    (key) => [key, Object.getOwnPropertyDescriptor(prototype, key)] as const,
  );
  const [method, property] = saved.map(([, descriptor]) => descriptor);
  const textInfo = (method?.value ?? property?.get) as (
    this: Intl.Locale,
  ) => unknown;

  beforeEach(() => {
    for (const [key] of saved) Reflect.deleteProperty(prototype, key);
    if (withProperty) {
      Object.defineProperty(prototype, "textInfo", {
        configurable: true,
        get(this: Intl.Locale) {
          return textInfo.call(this);
        },
      });
    }
  });
  afterEach(() => {
    Reflect.deleteProperty(prototype, "textInfo");
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(prototype, key, descriptor);
    }
  });

  it.each(DIRECTIONS)("still gives %s the direction %s", (language, dir) => {
    expect(documentLocale(language)).toEqual({ lang: language, dir });
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

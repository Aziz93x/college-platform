import { describe, expect, it } from "vitest";
import { documentLocale } from "./language.ts";

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

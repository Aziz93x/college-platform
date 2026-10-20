import { describe, expect, it } from "vitest";
import { z } from "zod";
import { latinDigits, toLatinDigits } from "./digits.ts";

describe("toLatinDigits", () => {
  it.each([
    ["Arabic-Indic", "٠١٢٣٤٥٦٧٨٩"],
    ["Extended Arabic-Indic", "۰۱۲۳۴۵۶۷۸۹"],
  ])("turns every %s digit into its Latin digit", (_name, digits) => {
    expect(toLatinDigits(digits)).toBe("0123456789");
  });

  it("changes only the digits in mixed Arabic and Latin text", () => {
    expect(toLatinDigits("الأسبوع ٧، week 12، الشعبة ۳۰")).toBe(
      "الأسبوع 7، week 12، الشعبة 30",
    );
  });

  it("leaves the characters next to both ranges alone", () => {
    const neighbours = "\u065f\u066a\u06ef\u06fa";

    expect(toLatinDigits(neighbours)).toBe(neighbours);
  });

  it("turns the Arabic decimal and thousands separators into Latin ones", () => {
    expect(toLatinDigits("٨٧٫٥")).toBe("87.5");
    expect(toLatinDigits("١٬٢٥٠٫٧٥")).toBe("1,250.75");
  });
});

describe("latinDigits", () => {
  it("lets a number schema read Arabic-Indic digits", () => {
    expect(latinDigits(z.coerce.number()).parse("١٢")).toBe(12);
  });

  it("lets a number schema read a decimal typed on an Arabic keyboard", () => {
    expect(latinDigits(z.coerce.number()).parse("٨٧٫٥")).toBe(87.5);
  });

  it("hands Latin digits to a string schema", () => {
    expect(latinDigits(z.string().regex(/^\d+$/)).parse("۲۰۲۶")).toBe("2026");
  });

  it("passes values that are not strings through unchanged", () => {
    const schema = latinDigits(z.unknown());
    const value = { week: "٧" };

    expect(schema.parse(7)).toBe(7);
    expect(schema.parse(value)).toBe(value);
    expect(schema.parse(null)).toBe(null);
  });
});

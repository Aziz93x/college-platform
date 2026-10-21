import { describe, expect, it } from "vitest";
import { toLatinDigits } from "./digits.ts";

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

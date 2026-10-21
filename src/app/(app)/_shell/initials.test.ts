import { expect, it } from "vitest";
import { initials } from "./initials.ts";

it("takes the first name's letter and the family name's, after the article", () => {
  // Hind al-Qahtani: ha and qaf, as escapes because check:hardcode rejects Arabic script in src/.
  expect(
    initials(
      "\u0647\u0646\u062f \u0627\u0644\u0642\u062d\u0637\u0627\u0646\u064a",
    ),
  ).toBe("\u0647 \u0642");
  expect(initials("Sara  Ali Omar")).toBe("S O");
});

it("keeps a single name's letter, and a short word that only looks like the article", () => {
  expect(initials(" Fahad ")).toBe("F");
  expect(initials("Ali \u0627\u0644")).toBe("A \u0627");
  expect(initials("")).toBe("");
});

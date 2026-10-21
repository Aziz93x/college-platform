import { expect, it } from "vitest";
import { searchCommands } from "./command-search.ts";

const settings = [
  { label: "أقصر كلمة مرور", keywords: ["أقل عدد من الأحرف"] },
  { label: "إعادة طلب كلمة المرور", keywords: [] },
  { label: "التاريخ الهجري", keywords: ["تقويم أم القرى"] },
  { label: "المنطقة الزمنية", keywords: [] },
];
const labels = (query: string) =>
  searchCommands(settings, query).map((item) => item.label);

it("matches an Arabic word with or without its definite article", () => {
  expect(labels("كلمة المرور").sort()).toEqual(
    ["أقصر كلمة مرور", "إعادة طلب كلمة المرور"].sort(),
  );
  expect(labels("الهجري")).toEqual(["التاريخ الهجري"]);
  expect(labels("هجري")).toEqual(["التاريخ الهجري"]);
});

it("matches spellings that differ in the hamza, the taa marbuta or the alef maqsura", () => {
  expect(labels("اعادة")).toEqual(["إعادة طلب كلمة المرور"]);
  expect(labels("المنطقه")).toEqual(["المنطقة الزمنية"]);
  expect(labels("القرى")).toEqual(["التاريخ الهجري"]);
  expect(labels("القري")).toEqual(["التاريخ الهجري"]);
});

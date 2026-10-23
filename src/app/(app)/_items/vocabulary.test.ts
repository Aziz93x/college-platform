import { createFormatter, createTranslator } from "next-intl";
import { expect, it } from "vitest";
import { examPeriodTypes } from "../../../../db/seed/base.ts";
import messages from "../../../../messages/ar.json" with { type: "json" };
import { itemVocabulary } from "./vocabulary.ts";

const locale = "ar-u-nu-latn";
const AXIS = "0199b2a4-0000-7000-8000-0000000000b1";
const SECRETARY = "0199b2a4-0000-7000-8000-0000000000c1";
const FAHD = "0199b2a4-0000-7000-8000-0000000000d1";
const GONE = "0199b2a4-0000-7000-8000-0000000000e1";

const { words } = itemVocabulary({
  t: createTranslator({ locale, messages, namespace: "framework" }) as never,
  periodTypes: examPeriodTypes,
  format: createFormatter({ locale }) as never,
  axes: [{ id: AXIS, code: "1", title: "الخطط التدريبية" }],
  roles: new Map([[SECRETARY, "أمين القسم"]]),
  people: new Map([[FAHD, { name: "فهد الزهراني", employeeNumber: "200001" }]]),
  accepted: [],
});

it("words each field of an item as the framework's and the plans' pages do, which the audit log reads too (UX review 2)", () => {
  expect(words.axis(AXIS)).toBe("المحور 1: الخطط التدريبية");
  expect(words.kind("meeting_minutes")).toBe("محضر اجتماع");
  expect(words.appliesTo({ type: "role", roleId: SECRETARY })).toBe(
    "أمين القسم",
  );
  expect(words.appliesTo({ type: "person", userId: FAHD })).toBe(
    "فهد الزهراني",
  );
  expect(words.appliesTo({ type: "eachSection" })).toBe("مدرب كل شعبة");
  expect(
    words.due({
      type: "examPeriods",
      side: "after",
      weeks: 1,
      periodTypes: ["first-periodic", "second-periodic"],
    }),
  ).toBe("بعد الدوري الأول والدوري الثاني بأسبوع");
  expect(
    words.evidence({
      required: true,
      types: ["pdf", "docx"],
      maxFiles: 2,
      requiresApproval: true,
    }),
  ).toBe("شواهد مطلوبة: PDF وDOCX، حتى ملفين · يعتمدها رئيس القسم");
});

it("has no words for an axis, a kind, a role or a person the college no longer has", () => {
  expect(words.axis(GONE)).toBeUndefined();
  expect(words.kind("gone")).toBeUndefined();
  expect(words.appliesTo({ type: "role", roleId: GONE })).toBeUndefined();
  expect(words.appliesTo({ type: "person", userId: GONE })).toBeUndefined();
});

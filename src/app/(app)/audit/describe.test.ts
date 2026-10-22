import { describe, expect, it } from "vitest";
import { type AuditEntry, auditActions } from "@/modules/audit";
import messages from "../../../../messages/ar.json" with { type: "json" };
import { describeEvent, type Lookups, type Words } from "./describe.ts";

// The catalog's own audit words, read by their dotted keys.
const catalog = messages.audit as unknown as Record<string, unknown>;
const lookup = (key: string) =>
  key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        typeof node === "object" && node !== null
          ? (node as Record<string, unknown>)[part]
          : undefined,
      catalog,
    );
const words = Object.assign(
  (key: string) => {
    const word = lookup(key);
    if (typeof word !== "string") throw new Error(`no word ${key}`);
    return word;
  },
  { has: (key: string) => typeof lookup(key) === "string" },
) satisfies Words;

const HIND = "0199b2a4-0000-7000-8000-000000000001";
const ELECTRICAL = "0199b2a4-0000-7000-8000-00000000000d";
const SPRING = "0199b2a4-0000-7000-8000-0000000000a1";
const lookups: Lookups = {
  person: (id) => (id === HIND ? "هند القحطاني" : undefined),
  department: (id) => (id === ELECTRICAL ? "التقنية الكهربائية" : undefined),
  role: (key) => (key === "head" ? "رئيس القسم" : undefined),
  roleById: () => "رئيس القسم",
  permission: (key) => `[${key}]`,
  setting: (key) => (key === "review.weeklyCap" ? "الحد الأسبوعي" : undefined),
  notificationKind: (kind) =>
    kind === "weeklyDigest" ? "ملخص الأسبوع" : undefined,
  term: (id) => (id === SPRING ? "الفصل الثاني 1447" : undefined),
  calendarKind: (kind) => (kind === "holiday" ? "إجازة" : undefined),
  college: "الكلية التقنية",
  labels: (labels) => labels.ar,
  dateTime: (iso) => `at ${iso}`,
  day: (day) => `day ${day}`,
  list: (items) => items.join(" / "),
};

const entry = (event: Partial<AuditEntry>): AuditEntry => ({
  id: "e1",
  createdAt: new Date("2026-10-01T08:00:00Z"),
  actorId: HIND,
  action: "role.update",
  entityType: "role",
  entityId: "r1",
  diff: null,
  ip: "10.0.30.1",
  userAgent: "Mozilla/5.0",
  ...event,
});

describe("describeEvent", () => {
  it("names who acted, the action and what it was about", () => {
    expect(describeEvent(entry({}), lookups, words)).toMatchObject({
      actor: "هند القحطاني",
      action: "تعديل دور",
      subject: "رئيس القسم",
      ip: "10.0.30.1",
      device: "Mozilla/5.0",
    });
    expect(
      describeEvent(
        entry({
          actorId: null,
          action: "account.lock",
          entityType: "user",
          entityId: "gone",
        }),
        lookups,
        words,
      ),
    ).toMatchObject({
      actor: "النظام",
      subject: "شخص لم يعد في الكلية",
    });
  });

  it("lists the fields that changed, by their names and with ids named", () => {
    expect(
      describeEvent(
        entry({
          diff: {
            from: { permissions: ["plan.edit"], labels: { ar: "قديم" } },
            to: {
              permissions: ["plan.edit", "plan.publish"],
              labels: { ar: "قديم" },
            },
          },
        }),
        lookups,
        words,
      ).changes,
    ).toEqual([
      {
        field: "الصلاحيات",
        before: "[plan.edit]",
        after: "[plan.edit] / [plan.publish]",
      },
    ]);
  });

  it("names a membership by its person, role and place, across the college too", () => {
    const membership = (departmentId: string | null) =>
      describeEvent(
        entry({
          action: "membership.create",
          entityType: "membership",
          diff: { to: { userId: HIND, role: "head", departmentId } },
        }),
        lookups,
        words,
      );
    expect(membership(ELECTRICAL).subject).toBe(
      "هند القحطاني: رئيس القسم · التقنية الكهربائية",
    );
    expect(membership(null).subject).toBe(
      "هند القحطاني: رئيس القسم · الكلية كلها",
    );
  });

  it("shows a setting's value before and after as one, and what an event only noted", () => {
    expect(
      describeEvent(
        entry({
          action: "setting.update",
          entityType: "setting",
          entityId: "review.weeklyCap",
          diff: { from: 30, to: 25 },
        }),
        lookups,
        words,
      ),
    ).toMatchObject({
      subject: "الحد الأسبوعي",
      changes: [{ field: "القيمة", before: "30", after: "25" }],
    });
    expect(
      describeEvent(
        entry({
          action: "session.signIn",
          entityType: "user",
          entityId: HIND,
          diff: { twoFactor: "backupCode", unknownField: true },
        }),
        lookups,
        words,
      ).changes,
    ).toEqual([
      { field: "الخطوة الثانية", after: "رمز احتياطي" },
      { field: "unknownField", after: "نعم" },
    ]);
    expect(
      describeEvent(
        entry({
          action: "audit.export",
          entityType: "college",
          entityId: "c1",
          diff: { start: "2026-10-01", action: "account.lock", rows: 12 },
        }),
        lookups,
        words,
      ),
    ).toMatchObject({
      subject: "الكلية التقنية",
      changes: [
        { field: "بداية الفترة", after: "2026-10-01" },
        { field: "الحدث", after: "إيقاف الدخول مؤقتًا" },
        { field: "الأحداث المصدّرة", after: "12" },
      ],
    });
  });

  it("names the kind of notification a person turned off, and counts what they read", () => {
    const own = { entityType: "user", entityId: HIND };
    expect(
      describeEvent(
        entry({
          ...own,
          action: "notification.mute",
          diff: { kind: "weeklyDigest" },
        }),
        lookups,
        words,
      ),
    ).toMatchObject({
      action: "إيقاف نوع من الإشعارات",
      subject: "هند القحطاني",
      changes: [{ field: "النوع", after: "ملخص الأسبوع" }],
    });
    expect(
      describeEvent(
        entry({ ...own, action: "notification.read", diff: { count: 3 } }),
        lookups,
        words,
      ).changes,
    ).toEqual([{ field: "العدد", after: "3" }]);
  });

  it("names an announcement by its title, where it went and how many it reached or was taken from (ADR-0017)", () => {
    const said = { entityType: "announcement", entityId: "a1" };
    expect(
      describeEvent(
        entry({
          ...said,
          action: "announcement.publish",
          diff: {
            to: {
              title: "اجتماع القسم",
              departmentId: ELECTRICAL,
              reached: 14,
            },
          },
        }),
        lookups,
        words,
      ),
    ).toMatchObject({
      action: "نشر إعلان",
      subject: "اجتماع القسم",
      changes: [
        { field: "العنوان", after: "اجتماع القسم" },
        { field: "المكان", after: "التقنية الكهربائية" },
        { field: "وصل إلى", after: "14" },
      ],
    });
    expect(
      describeEvent(
        entry({
          ...said,
          action: "announcement.withdraw",
          diff: {
            from: { title: "اجتماع القسم", departmentId: null },
            to: { retracted: 14 },
          },
        }),
        lookups,
        words,
      ),
    ).toMatchObject({
      action: "سحب إعلان",
      subject: "اجتماع القسم",
      changes: [
        { field: "العنوان", before: "اجتماع القسم" },
        { field: "المكان", before: "الكلية كلها" },
        { field: "سُحب من", after: "14" },
      ],
    });
  });

  it("names the framework by its term, and what an item became (Step 15)", () => {
    expect(
      describeEvent(
        entry({
          entityType: "framework",
          entityId: "f1",
          action: "framework.publish",
          diff: { to: { termId: SPRING, version: 2, items: 14 } },
        }),
        lookups,
        words,
      ),
    ).toMatchObject({
      action: "نشر الإطار العام",
      subject: "الفصل الثاني 1447",
      changes: [
        { field: "الفصل التدريبي", after: "الفصل الثاني 1447" },
        { field: "النسخة", after: "2" },
        { field: "البنود", after: "14" },
      ],
    });
  });

  it("names a portfolio axis by its title before the change, and what changed (Step 14)", () => {
    expect(
      describeEvent(
        entry({
          entityType: "axis",
          entityId: "x1",
          action: "axis.update",
          diff: {
            from: { title: "التدريب الإلكتروني", description: "" },
            to: {
              title: "التدريب الإلكتروني",
              description: "المقررات على المنصة",
            },
          },
        }),
        lookups,
        words,
      ),
    ).toMatchObject({
      action: "تعديل محور",
      subject: "التدريب الإلكتروني",
      changes: [{ field: "الوصف", before: "", after: "المقررات على المنصة" }],
    });
  });

  it("names a term, the kind and days of what its calendar gained, its status, and the term a role is held in (Step 13)", () => {
    const term = { entityType: "term", entityId: SPRING };
    expect(
      describeEvent(
        entry({
          ...term,
          action: "calendarEvent.create",
          diff: {
            to: {
              kind: "holiday",
              title: "إجازة عيد الفطر",
              startsOn: "2026-03-15",
              endsOn: "2026-03-28",
            },
          },
        }),
        lookups,
        words,
      ),
    ).toMatchObject({
      action: "إضافة إلى تقويم الفصل",
      subject: "الفصل الثاني 1447",
      changes: [
        { field: "النوع", after: "إجازة" },
        { field: "العنوان", after: "إجازة عيد الفطر" },
        { field: "يبدأ في", after: "day 2026-03-15" },
        { field: "ينتهي في", after: "day 2026-03-28" },
      ],
    });
    expect(
      describeEvent(
        entry({
          ...term,
          action: "term.activate",
          diff: { from: { status: "draft" }, to: { status: "active" } },
        }),
        lookups,
        words,
      ).changes,
    ).toEqual([{ field: "الحالة", before: "مسودة", after: "نشط" }]);
    expect(
      describeEvent(
        entry({
          action: "membership.create",
          entityType: "membership",
          entityId: "m1",
          diff: {
            to: {
              userId: HIND,
              role: "head",
              departmentId: ELECTRICAL,
              termId: SPRING,
            },
          },
        }),
        lookups,
        words,
      ).changes,
    ).toContainEqual({ field: "الفصل التدريبي", after: "الفصل الثاني 1447" });
  });
});

it("has a word for every action the log records, and for its group", () => {
  for (const action of auditActions) {
    expect(words.has(`actions.${action}`), action).toBe(true);
    expect(words.has(`groups.${action.split(".")[0]}`), action).toBe(true);
  }
});

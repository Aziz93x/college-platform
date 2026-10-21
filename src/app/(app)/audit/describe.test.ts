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
const lookups: Lookups = {
  person: (id) => (id === HIND ? "هند القحطاني" : undefined),
  department: (id) => (id === ELECTRICAL ? "التقنية الكهربائية" : undefined),
  role: (key) => (key === "head" ? "رئيس القسم" : undefined),
  roleById: () => "رئيس القسم",
  permission: (key) => `[${key}]`,
  setting: (key) => (key === "review.weeklyCap" ? "الحد الأسبوعي" : undefined),
  notificationKind: (kind) =>
    kind === "weeklyDigest" ? "ملخص الأسبوع" : undefined,
  college: "الكلية التقنية",
  labels: (labels) => labels.ar,
  dateTime: (iso) => `at ${iso}`,
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
});

it("has a word for every action the log records, and for its group", () => {
  for (const action of auditActions) {
    expect(words.has(`actions.${action}`), action).toBe(true);
    expect(words.has(`groups.${action.split(".")[0]}`), action).toBe(true);
  }
});

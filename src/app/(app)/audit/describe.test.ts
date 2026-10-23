import { describe, expect, it } from "vitest";
import {
  type AuditEntity,
  type AuditEntry,
  auditActions,
} from "@/modules/audit";
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
  (key: string, values: Record<string, string> = {}) => {
    const word = lookup(key);
    if (typeof word !== "string") throw new Error(`no word ${key}`);
    return Object.entries(values).reduce(
      (said, [name, value]) => said.replaceAll(`{${name}}`, value),
      word,
    );
  },
  { has: (key: string) => typeof lookup(key) === "string" },
) satisfies Words;

const HIND = "0199b2a4-0000-7000-8000-000000000001";
const ELECTRICAL = "0199b2a4-0000-7000-8000-00000000000d";
const SPRING = "0199b2a4-0000-7000-8000-0000000000a1";
const AXIS = "0199b2a4-0000-7000-8000-0000000000b1";
const SECRETARY = "0199b2a4-0000-7000-8000-0000000000c1";
// An item's fields as the framework's and the plans' pages word them, here for what the tests use.
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const lookups: Lookups = {
  person: (id) => (id === HIND ? "هند القحطاني" : undefined),
  department: (id) => (id === ELECTRICAL ? "التقنية الكهربائية" : undefined),
  role: (key) => (key === "head" ? "رئيس القسم" : undefined),
  roleById: () => "رئيس القسم",
  permission: (key) => `[${key}]`,
  setting: (key) =>
    key === "reminders.digestHour" ? "ساعة الملخص الأسبوعي" : undefined,
  notificationKind: (kind) =>
    kind === "weeklyDigest" ? "ملخص الأسبوع" : undefined,
  term: (id) => (id === SPRING ? "الفصل الثاني 1447" : undefined),
  calendarKind: (kind) => (kind === "holiday" ? "إجازة" : undefined),
  item: {
    axis: (id) => (id === AXIS ? "المحور 1: الخطط التدريبية" : undefined),
    kind: (kind) => (kind === "meeting_minutes" ? "محضر اجتماع" : undefined),
    appliesTo: (value) =>
      isRecord(value) && value.roleId === SECRETARY ? "أمين القسم" : undefined,
    due: (value) =>
      isRecord(value) && value.type === "examPeriods"
        ? `بعد الاختبارات بـ${value.weeks}`
        : undefined,
    evidence: (value) =>
      isRecord(value) && value.required === true ? "مطلوبة: PDF" : undefined,
  },
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
            from: {
              permissions: ["sections.transfer"],
              labels: { ar: "قديم" },
            },
            to: {
              permissions: ["sections.transfer", "announcements.publish"],
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
        before: "[sections.transfer]",
        after: "[sections.transfer] / [announcements.publish]",
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
          entityId: "reminders.digestHour",
          diff: { from: 7, to: 6 },
        }),
        lookups,
        words,
      ),
    ).toMatchObject({
      subject: "ساعة الملخص الأسبوعي",
      changes: [{ field: "القيمة", before: "7", after: "6" }],
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

  it("names a framework item by its title, and words its fields, as the framework's page does (UX review 2)", () => {
    const due = (weeks: number) => ({
      type: "examPeriods",
      side: "after",
      weeks,
      periodTypes: ["first-periodic"],
    });
    expect(
      describeEvent(
        entry({
          entityType: "framework",
          entityId: "f1",
          action: "frameworkItem.update",
          diff: {
            from: {
              termId: SPRING,
              title: "تحليل نتائج الاختبار",
              due: due(1),
            },
            to: { termId: SPRING, title: "تحليل نتائج الاختبار", due: due(2) },
          },
        }),
        lookups,
        words,
      ),
    ).toMatchObject({
      action: "تعديل بند في الإطار العام",
      subject: "«تحليل نتائج الاختبار» · الإطار العام · الفصل الثاني 1447",
      changes: [
        {
          field: "الموعد",
          before: "بعد الاختبارات بـ1",
          after: "بعد الاختبارات بـ2",
        },
      ],
    });
  });

  it("words what a plan's new item reaches, its axis, kind and evidence, and names the item first (UX review 2)", () => {
    const described = describeEvent(
      entry({
        entityType: "plan",
        entityId: "p1",
        action: "planItem.create",
        diff: {
          to: {
            termId: SPRING,
            departmentId: ELECTRICAL,
            title: "محاضر اجتماعات القسم",
            axisId: AXIS,
            kind: "meeting_minutes",
            appliesTo: { type: "role", roleId: SECRETARY },
            due: { type: "everyWeeks", every: 4 },
            evidence: { required: true, types: ["pdf"], maxFiles: 1 },
            notes: "",
          },
        },
      }),
      lookups,
      words,
    );
    expect(described.subject).toBe(
      "«محاضر اجتماعات القسم» · التقنية الكهربائية · الفصل الثاني 1447",
    );
    expect(described.changes).toEqual(
      expect.arrayContaining([
        { field: "المحور", after: "المحور 1: الخطط التدريبية" },
        { field: "النوع", after: "محضر اجتماع" },
        { field: "يشمل", after: "أمين القسم" },
        { field: "الشواهد", after: "مطلوبة: PDF" },
        { field: "ملاحظات", after: "" },
      ]),
    );
    // Someone the college no longer has is named so, not by their account's id.
    expect(
      describeEvent(
        entry({
          entityType: "plan",
          entityId: "p1",
          action: "planItem.create",
          diff: {
            to: {
              termId: SPRING,
              departmentId: ELECTRICAL,
              title: "جرد العهدة",
              appliesTo: { type: "person", userId: "gone" },
            },
          },
        }),
        lookups,
        words,
      ).changes,
    ).toContainEqual({ field: "يشمل", after: "شخص لم يعد في الكلية" });
    // A rule the words cannot read is shown as it was recorded, not lost.
    expect(described.changes).toContainEqual({
      field: "الموعد",
      after: JSON.stringify({ type: "everyWeeks", every: 4 }),
    });
  });

  it("names an assignment by its person, template, department and term, with its weeks, and a template's item by its title and its template's (Step 21)", () => {
    expect(
      describeEvent(
        entry({
          entityType: "assignment",
          entityId: "a1",
          action: "assignment.create",
          diff: {
            to: {
              termId: SPRING,
              departmentId: ELECTRICAL,
              title: "مشرف السلامة",
              userId: HIND,
              fromWeek: 3,
              toWeek: 9,
            },
          },
        }),
        lookups,
        words,
      ),
    ).toMatchObject({
      action: "تكليف منسوب",
      subject:
        "هند القحطاني: مشرف السلامة · التقنية الكهربائية · الفصل الثاني 1447",
      changes: expect.arrayContaining([
        { field: "من الأسبوع", after: "3" },
        { field: "إلى الأسبوع", after: "9" },
      ]),
    });
    expect(
      describeEvent(
        entry({
          entityType: "assignmentTemplate",
          entityId: "t1",
          action: "assignmentTemplateItem.update",
          diff: {
            from: {
              departmentId: ELECTRICAL,
              template: "مسؤول العهد",
              title: "جرد العهد",
              kind: "general",
            },
            to: {
              departmentId: ELECTRICAL,
              template: "مسؤول العهد",
              title: "جرد العهد في نهاية الفصل",
              kind: "meeting_minutes",
            },
          },
        }),
        lookups,
        words,
      ),
    ).toMatchObject({
      action: "تعديل مهمة في قالب تكليف",
      subject: "«جرد العهد في نهاية الفصل» · مسؤول العهد · التقنية الكهربائية",
      changes: [
        {
          field: "العنوان",
          before: "جرد العهد",
          after: "جرد العهد في نهاية الفصل",
        },
        { field: "النوع", before: "general", after: "محضر اجتماع" },
      ],
    });
  });

  it("names a Rayat import by its report and term, and counts what it changed (Step 16)", () => {
    expect(
      describeEvent(
        entry({
          entityType: "rayatImport",
          entityId: "i1",
          action: "rayatImport.upload",
          diff: {
            termId: SPRING,
            report: "sf01",
            records: 765,
            added: 2,
            removed: 0,
            changed: 3,
          },
        }),
        lookups,
        words,
      ),
    ).toMatchObject({
      action: "رفع تقرير من رايات",
      subject: "SF01 · الفصل الثاني 1447",
      changes: [
        { field: "الفصل التدريبي", after: "الفصل الثاني 1447" },
        { field: "التقرير", after: "SF01" },
        { field: "السجلات", after: "765" },
        { field: "أُضيف", after: "2" },
        { field: "حُذف", after: "0" },
        { field: "تغيّر", after: "3" },
      ],
    });
  });

  it("names a section's transfer by the section and its term, with the trainers, the week and why (Step 17)", () => {
    expect(
      describeEvent(
        entry({
          entityType: "sectionTransfer",
          entityId: "s1",
          action: "sectionTransfer.create",
          diff: {
            to: {
              termId: SPRING,
              sectionRef: "30101",
              fromNumber: "200101",
              userId: HIND,
              week: 6,
              reason: "إعادة توزيع الأنصبة",
            },
          },
        }),
        lookups,
        words,
      ),
    ).toMatchObject({
      action: "نقل شعبة من مدرب إلى آخر",
      subject: "30101 · الفصل الثاني 1447",
      changes: [
        { field: "الفصل التدريبي", after: "الفصل الثاني 1447" },
        { field: "الشعبة", after: "30101" },
        { field: "المدرب السابق", after: "200101" },
        { field: "الشخص", after: "هند القحطاني" },
        { field: "الأسبوع", after: "6" },
        { field: "السبب", after: "إعادة توزيع الأنصبة" },
      ],
    });
    expect(
      describeEvent(
        entry({
          entityType: "sectionTransfer",
          entityId: "s1",
          action: "sectionTransfer.keep",
          diff: { termId: SPRING, sectionRef: "30101" },
        }),
        lookups,
        words,
      ),
    ).toMatchObject({
      action: "إبقاء نقل شعبة يخالف رايات",
      subject: "30101 · الفصل الثاني 1447",
    });
  });

  it("names a section template by its title, department and term, as it became or was taken out (Step 18)", () => {
    const template = {
      termId: SPRING,
      departmentId: ELECTRICAL,
      title: "الاختبارات القصيرة",
    };
    for (const diff of [{ to: template }, { from: template }]) {
      expect(
        describeEvent(
          entry({
            entityType: "sectionTemplate",
            entityId: "t1",
            action: "sectionTemplate.create",
            diff,
          }),
          lookups,
          words,
        ).subject,
      ).toBe("الاختبارات القصيرة · التقنية الكهربائية · الفصل الثاني 1447");
    }
  });

  it("names a department's plan by its department and term, and the term a draft was copied from (Step 19)", () => {
    expect(
      describeEvent(
        entry({
          entityType: "plan",
          entityId: "p1",
          action: "plan.create",
          diff: {
            to: {
              termId: SPRING,
              departmentId: ELECTRICAL,
              version: 1,
              items: 4,
              fromTermId: SPRING,
            },
          },
        }),
        lookups,
        words,
      ),
    ).toMatchObject({
      action: "بدء نسخة من خطة القسم",
      subject: "التقنية الكهربائية · الفصل الثاني 1447",
      changes: expect.arrayContaining([
        { field: "منسوخة من", after: "الفصل الثاني 1447" },
      ]),
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

// An event of each kind of thing the log records, as its service writes it. A new kind needs its
// own here, and the log a name for it: never its id alone (Audit 6).
const typical = {
  user: { entityId: HIND },
  college: {},
  department: { entityId: ELECTRICAL },
  role: {},
  membership: {
    diff: { to: { userId: HIND, role: "head", departmentId: ELECTRICAL } },
  },
  setting: { entityId: "reminders.digestHour" },
  announcement: { diff: { to: { title: "اجتماع القسم" } } },
  term: { entityId: SPRING },
  holiday: { diff: { to: { name: "إجازة عيد الفطر", hijriYear: 1448 } } },
  axis: { diff: { from: { title: "الاختبارات" } } },
  framework: { diff: { to: { termId: SPRING } } },
  rayatImport: { diff: { report: "ss01", termId: SPRING } },
  sectionTransfer: { diff: { to: { sectionRef: "30101", termId: SPRING } } },
  sectionTemplate: {
    diff: {
      to: {
        title: "الاختبارات القصيرة",
        departmentId: ELECTRICAL,
        termId: SPRING,
      },
    },
  },
  plan: { diff: { from: { departmentId: ELECTRICAL, termId: SPRING } } },
  assignmentTemplate: {
    diff: { to: { departmentId: ELECTRICAL, title: "مسؤول العهد" } },
  },
  assignment: {
    diff: {
      to: {
        termId: SPRING,
        departmentId: ELECTRICAL,
        title: "أمين القسم",
        userId: HIND,
      },
    },
  },
  text: { entityId: "nav.today", diff: { from: "اليوم", to: "يومي" } },
} satisfies Record<AuditEntity, Partial<AuditEntry>>;

it.each(
  Object.entries(typical),
)("names what a %s's event is about, not by its id", (entityType, event) => {
  const described = entry({ entityType, entityId: "x1", ...event });
  expect(describeEvent(described, lookups, words).subject).not.toBe(
    described.entityId,
  );
});

it("has a word for every action the log records, and for its group", () => {
  for (const action of auditActions) {
    expect(words.has(`actions.${action}`), action).toBe(true);
    expect(words.has(`groups.${action.split(".")[0]}`), action).toBe(true);
  }
});

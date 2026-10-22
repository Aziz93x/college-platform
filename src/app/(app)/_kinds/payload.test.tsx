import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  type Catalogs,
  kindFields,
  type Payload,
  type TaskKind,
  taskKinds,
} from "@/modules/framework";
import messages from "../../../../messages/ar.json" with { type: "json" };
import { PayloadEditor } from "./payload-editor.tsx";
import { PayloadView } from "./payload-view.tsx";

// The college's locale as the app builds it: Arabic, its week from Sunday, in Latin digits.
const render = (node: ReactNode) =>
  renderToStaticMarkup(
    <NextIntlClientProvider
      locale="ar-u-fw-sun-nu-latn"
      timeZone="Asia/Riyadh"
      messages={messages}
    >
      {node}
    </NextIntlClientProvider>,
  );

const catalogs: Catalogs = {
  examTypes: ["الاختبار الفصلي الأول", "الاختبار النهائي"],
  trainingMethods: ["المشروع", "دراسة الحالة", "التدريب المعكوس"],
  developmentTypes: ["ورشة عمل", "دورة تدريبية"],
  gradeBands: [90, 80, 70, 60],
};

// A payload of each kind as a trainer fills it in.
const filled: Record<TaskKind, Payload> = {
  general: { notes: "أُرسلت النسخة إلى القسم." },
  exam_copy: { examType: "الاختبار النهائي", examOn: "2026-12-20" },
  grade_analysis: {
    examType: "الاختبار الفصلي الأول",
    bands: [
      { from: 90, count: 4 },
      { from: 80, count: 7 },
      { from: 70, count: 6 },
      { from: 60, count: 3 },
      { from: 0, count: 2 },
    ],
    passRate: 90.9,
    average: 78.5,
    actions: "حصة تقوية للمتعثرين قبل الاختبار النهائي.",
  },
  homework: { title: "توصيل مفتاح ثلاثي", week: 4 },
  e_learning: { courseShell: true, content: true, activities: false },
  training_practice: {
    methods: ["المشروع", "دراسة الحالة"],
    description: "نفّذت كل مجموعة لوحة من مخططها.",
  },
  advising_log: {
    sessions: [
      { on: "2026-10-05", notes: "أهمية الحضور وأثر الغياب." },
      { on: "2026-10-19", notes: "المتابعة المبكرة للمتعثرين." },
    ],
  },
  meeting_minutes: { meetingOn: "2026-10-12", summary: "خطة الاختبار الفصلي." },
  initiative: { title: "يوم السلامة", description: "مع ورش القسم." },
  professional_development: {
    developmentType: "ورشة عمل",
    title: "العدادات الذكية",
    provider: "",
    on: "2026-09-30",
  },
  profile_section: { text: "اثنتا عشرة سنة في توزيع الطاقة." },
};

const label = (name: string) =>
  messages.kinds.fields[name as keyof typeof messages.kinds.fields];

describe("PayloadEditor", () => {
  it.each(taskKinds)("asks for each field of a %s", (kind) => {
    const html = render(
      <PayloadEditor
        kind={kind}
        value={{}}
        onChange={() => {}}
        catalogs={catalogs}
        today="2026-10-22"
        weeks={18}
      />,
    );
    for (const { name } of kindFields[kind]) {
      expect(html, name).toContain(label(name));
    }
  });

  it("asks for a count in each of the college's grade bands, and says no names go in", () => {
    const html = render(
      <PayloadEditor
        kind="grade_analysis"
        value={filled.grade_analysis}
        onChange={() => {}}
        catalogs={catalogs}
        today="2026-10-22"
        weeks={18}
      />,
    );
    for (const band of [
      "من 90 إلى 100٪",
      "من 80 إلى أقل من 90٪",
      "من 60 إلى أقل من 70٪",
      "أقل من 60٪",
    ]) {
      expect(html).toContain(band);
    }
    expect(html).toContain(messages.kinds.hints.actions);
  });

  it("offers each training method of the catalog, the chosen ones ticked", () => {
    const html = render(
      <PayloadEditor
        kind="training_practice"
        value={filled.training_practice}
        onChange={() => {}}
        catalogs={catalogs}
        today="2026-10-22"
        weeks={18}
      />,
    );
    for (const method of catalogs.trainingMethods) {
      expect(html).toContain(method);
    }
    expect(html.match(/aria-checked="true"/g)).toHaveLength(2);
  });

  it("marks an optional field and holds each advising session", () => {
    expect(
      render(
        <PayloadEditor
          kind="professional_development"
          value={filled.professional_development}
          onChange={() => {}}
          catalogs={catalogs}
          today="2026-10-22"
          weeks={18}
        />,
      ),
    ).toContain(`${label("provider")} (اختياري)`);
    const sessions = render(
      <PayloadEditor
        kind="advising_log"
        value={filled.advising_log}
        onChange={() => {}}
        catalogs={catalogs}
        today="2026-10-22"
        weeks={18}
      />,
    );
    expect(sessions).toContain("الجلسة 2");
    expect(sessions).toContain("المتابعة المبكرة للمتعثرين.");
  });
});

describe("PayloadView", () => {
  it.each(taskKinds)("shows each field of a filled %s", (kind) => {
    const html = render(<PayloadView kind={kind} value={filled[kind]} />);
    for (const { name } of kindFields[kind]) {
      expect(html, name).toContain(label(name));
    }
  });

  it("writes an analysis's bands, rates and type in the college's words", () => {
    const html = render(
      <PayloadView kind="grade_analysis" value={filled.grade_analysis} />,
    );
    expect(html).toContain("من 90 إلى 100٪: 4 متدربين");
    expect(html).toContain("أقل من 60٪: متدربان");
    expect(html).toContain("الاختبار الفصلي الأول");
    // Intl writes the sign in the locale's digits: Latin here, between direction marks.
    expect(html).toMatch(/90\.9\u200e?[%٪]/);
  });

  it("writes days, weeks, boxes and lists as words", () => {
    expect(
      render(<PayloadView kind="exam_copy" value={filled.exam_copy} />),
    ).toContain("20 ديسمبر 2026");
    expect(
      render(<PayloadView kind="homework" value={filled.homework} />),
    ).toContain("الأسبوع 4");
    const checklist = render(
      <PayloadView kind="e_learning" value={filled.e_learning} />,
    );
    expect(checklist.match(/<dd[^>]*>نعم<\/dd>/g)).toHaveLength(2);
    expect(checklist).toMatch(/<dd[^>]*>لا<\/dd>/);
    expect(
      render(
        <PayloadView
          kind="training_practice"
          value={filled.training_practice}
        />,
      ),
    ).toContain("المشروع ودراسة الحالة");
    expect(
      render(
        <PayloadView
          kind="professional_development"
          value={filled.professional_development}
        />,
      ),
    ).toContain(messages.kinds.empty);
  });
});

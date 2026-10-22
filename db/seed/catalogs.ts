// The words of the catalogs every college starts with (settings catalogs.*, Step 18), from the app
// the departments use today (lib/trainer-domain.ts and app/trainer-documentation.tsx in
// department-work-tracker-next), and the plan's exam copies (docs/PLAN.md, section 3). The
// vice-dean changes them on the settings screen; the grade bands are the registry's default.
export const catalogWords = {
  examTypes: [
    "اختبار قصير",
    "الاختبار الفصلي الأول",
    "الاختبار الفصلي الثاني",
    "الاختبار النهائي",
    "اختبار عملي",
  ],
  trainingMethods: [
    "التطبيق العملي",
    "المشروع",
    "طريقة K.W.L",
    "التدريب بالاكتشاف",
    "التدريب البنائي",
    "نظرية (TRIZ)",
    "حل المشكلات",
    "التدريب المعكوس",
    "التدريب بالمحاكاة",
    "دراسة الحالة",
    "التدريب المتمايز",
  ],
  developmentTypes: ["دورة تدريبية", "برنامج تدريبي", "ورشة عمل", "لقاء مهني"],
} as const;

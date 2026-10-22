import { and, eq } from "drizzle-orm";
import { roles } from "../../../src/modules/access/index.ts";
import { listAxes } from "../../../src/modules/axes/index.ts";
import {
  addItem,
  type FrameworkItemInput,
  publishDraft,
  startDraft,
  termFramework,
  updateItem,
} from "../../../src/modules/framework/index.ts";
import { users } from "../../../src/modules/identity/index.ts";
import { getSetting } from "../../../src/modules/settings/index.ts";
import { activeTerm } from "../../../src/modules/terms/index.ts";
import type { Db } from "../../../src/platform/db/client.ts";
import { demoAccounts } from "./accounts.ts";
import { deviceOf } from "./device.ts";

// The demo term's general framework (Step 15): ten college-wide items under the axes, entered and
// published by the vice-dean, in the log. Each names its axis by code, its audience by role key, and
// its evidence by the extensions the college accepts.
// Written once, while the active term has no framework.
const ITEMS: (Omit<FrameworkItemInput, "axisId" | "appliesTo"> & {
  axis: string;
  role: "trainer" | "head";
})[] = [
  {
    axis: "1",
    role: "trainer",
    title: "توصيف المقررات والخطة التدريبية",
    kind: "general",
    due: { type: "week", week: 2 },
    evidence: {
      required: true,
      types: ["pdf", "docx"],
      maxFiles: 3,
      requiresApproval: false,
    },
    notes: "خطة كل مقرر يدرّبه المدرب هذا الفصل.",
  },
  {
    axis: "2",
    role: "trainer",
    title: "نسخة الاختبار ونموذج الإجابة",
    kind: "exam_copy",
    due: { type: "afterEvent", eventKind: "exam", weeks: 0 },
    evidence: {
      required: true,
      types: ["pdf"],
      maxFiles: 2,
      requiresApproval: true,
    },
    notes: "",
  },
  {
    axis: "3",
    role: "trainer",
    title: "تحليل نتائج الاختبار",
    kind: "grade_analysis",
    due: { type: "afterEvent", eventKind: "exam", weeks: 1 },
    evidence: {
      required: true,
      types: ["xlsx", "pdf"],
      maxFiles: 2,
      requiresApproval: false,
    },
    notes: "دون أسماء المتدربين.",
  },
  {
    axis: "4",
    role: "trainer",
    title: "تحديث الملف المهني",
    kind: "profile_section",
    due: { type: "week", week: 3 },
    evidence: {
      required: false,
      types: ["pdf", "jpg", "jpeg", "png", "heic"],
      maxFiles: 3,
      requiresApproval: false,
    },
    notes: "",
  },
  {
    axis: "5",
    role: "trainer",
    title: "عينات من الواجبات",
    kind: "homework",
    due: { type: "everyWeeks", every: 4 },
    evidence: {
      required: true,
      types: ["pdf", "jpg", "jpeg", "png", "heic"],
      maxFiles: 3,
      requiresApproval: false,
    },
    notes: "ثلاث عينات متفاوتة المستوى.",
  },
  {
    axis: "6",
    role: "trainer",
    title: "الممارسات التدريبية",
    kind: "training_practice",
    due: { type: "week", week: 6 },
    evidence: {
      required: true,
      types: ["pdf", "jpg", "jpeg", "png", "heic", "docx"],
      maxFiles: 5,
      requiresApproval: false,
    },
    notes: "",
  },
  {
    axis: "7",
    role: "trainer",
    title: "تهيئة المقرر على منصة التدريب الإلكتروني",
    kind: "e_learning",
    due: { type: "week", week: 1 },
    evidence: {
      required: true,
      types: ["jpg", "jpeg", "png", "heic", "pdf"],
      maxFiles: 3,
      requiresApproval: false,
    },
    notes: "",
  },
  {
    axis: "8",
    role: "trainer",
    title: "سجل الإرشاد التدريبي",
    kind: "advising_log",
    due: { type: "everyWeeks", every: 6 },
    evidence: {
      required: true,
      types: ["pdf"],
      maxFiles: 2,
      requiresApproval: false,
    },
    notes: "",
  },
  {
    axis: "9",
    role: "head",
    title: "تقرير القسم الشهري",
    kind: "general",
    due: { type: "everyWeeks", every: 4 },
    evidence: {
      required: true,
      types: ["docx", "pdf"],
      maxFiles: 1,
      requiresApproval: false,
    },
    notes: "",
  },
  {
    axis: "10",
    role: "trainer",
    title: "المبادرات والمشاركات",
    kind: "initiative",
    due: { type: "week", week: 12 },
    evidence: {
      required: false,
      types: ["pdf", "jpg", "jpeg", "png", "heic"],
      maxFiles: 5,
      requiresApproval: false,
    },
    notes: "",
  },
];

export async function seedDemoFramework({ db }: { db: Db }, collegeId: string) {
  const term = await activeTerm(collegeId, db);
  if (!term) return;
  const existing = await termFramework(collegeId, term.id, db);
  if (existing.draft || existing.published) return;
  const [viceDean] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, demoAccounts.viceDean.email));
  if (!viceDean) throw new Error("seed:demo: the vice-dean is missing");
  const change = {
    collegeId,
    actorId: viceDean.id,
    ...(await deviceOf(db, collegeId, viceDean.id)),
  };
  const axes = new Map(
    (await listAxes(collegeId, db))
      .flatMap((group) => group.axes)
      .map((axis) => [axis.code, axis.id]),
  );
  const roleIds = new Map(
    (
      await db
        .select({ key: roles.key, id: roles.id })
        .from(roles)
        .where(and(eq(roles.collegeId, collegeId)))
    ).map((role) => [role.key, role.id]),
  );
  const draft = await startDraft(term.id, change, db);
  if (draft.status !== "created") {
    throw new Error(
      `seed:demo: the framework was not started (${draft.status})`,
    );
  }
  const accepted = await getSetting("files.acceptedTypes", { collegeId }, db);
  for (const { axis, role, ...item } of ITEMS) {
    const axisId = axes.get(axis);
    const roleId = roleIds.get(role);
    if (!axisId || !roleId)
      throw new Error(`seed:demo: no axis ${axis} or role ${role}`);
    const added = await addItem(
      draft.id,
      { ...item, axisId, appliesTo: { type: "role", roleId } },
      change,
      accepted,
      db,
    );
    if (added.status !== "saved") {
      throw new Error(
        `seed:demo: «${item.title}» was not added (${added.status})`,
      );
    }
  }
  const published = await publishDraft(draft.id, change, false, db);
  if (published.status !== "published") {
    throw new Error(
      `seed:demo: the framework was not published (${published.status})`,
    );
  }

  // Version 2 waits as a draft: the grade analysis two weeks after each exam, which the finals in
  // the term's last week then no longer ask for (Audit 5).
  const next = await startDraft(term.id, change, db);
  if (next.status !== "created") {
    throw new Error(`seed:demo: version 2 was not started (${next.status})`);
  }
  const { draft: version } = await termFramework(collegeId, term.id, db);
  const analysis = version?.items.find(
    (each) => each.kind === "grade_analysis",
  );
  if (!analysis) throw new Error("seed:demo: no grade analysis to change");
  const { id, frameworkId: _, ...item } = analysis;
  const changed = await updateItem(
    id,
    {
      ...item,
      due: { type: "afterEvent", eventKind: "exam", weeks: 2 },
      notes: "بعد أسبوعين من كل اختبار، ليتسع لمراجعة رئيس القسم.",
    },
    change,
    accepted,
    db,
  );
  if (changed.status !== "saved") {
    throw new Error(`seed:demo: version 2 was not changed (${changed.status})`);
  }
}

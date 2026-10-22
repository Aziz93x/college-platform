import type { Metadata } from "next";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import {
  getFormatter,
  getLocale,
  getMessages,
  getTranslations,
} from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import {
  authorize,
  countMembers,
  listRoles,
  requireViewer,
  roleLabel,
} from "@/modules/access";
import { listAxes } from "@/modules/axes";
import {
  countTasks,
  type DueRule,
  evidenceTypes,
  type FrameworkItemInput,
  frameworkLimits,
  taskKinds,
  termFramework,
} from "@/modules/framework";
import { getSetting } from "@/modules/settings";
import { calendarEventKinds, findTerm } from "@/modules/terms";
import { viewedTerm } from "../_shell/term.ts";
import { FrameworkDraft, ItemWords } from "./framework-draft.tsx";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("framework");
  return { title: t("title") };
}

const DUE_TYPES = ["week", "weekly", "everyWeeks", "afterEvent"] as const;

// The general framework of the term on view (Step 15): the version published, which everyone reads;
// and for whoever prepares it, or endorses it where the college asks for that, its draft.
export default async function FrameworkPage() {
  await connection();
  const viewer = await requireViewer();
  const scope = { collegeId: viewer.collegeId };
  const manage = authorize(viewer, "framework.publish", scope);
  const endorse = authorize(viewer, "framework.endorse", scope);
  const [t, { term }] = await Promise.all([
    getTranslations("framework"),
    viewedTerm(viewer.collegeId, authorize(viewer, "term.manage", scope)),
  ]);
  const header = (
    <PageHeader title={t("title")} description={t("description")} />
  );
  if (!term) {
    return (
      <>
        {header}
        <EmptyState
          title={t("noTerm.title")}
          description={t("noTerm.description")}
        />
      </>
    );
  }

  const [
    messages,
    locale,
    format,
    calendarWords,
    framework,
    groups,
    roles,
    members,
    calendar,
    needsEndorsement,
  ] = await Promise.all([
    getMessages(),
    getLocale(),
    getFormatter(),
    getTranslations("terms.kinds"),
    termFramework(viewer.collegeId, term.id),
    listAxes(viewer.collegeId),
    listRoles(viewer.collegeId),
    countMembers(viewer.collegeId),
    findTerm(viewer.collegeId, term.id),
    getSetting("framework.requireEndorsement", scope),
  ]);
  const language = locale.split("-")[0];
  const axes = groups.flatMap((group) => group.axes);
  const axisWords = new Map(
    axes.map((axis) => [
      axis.id,
      t("axisOption", { code: axis.code, title: axis.title }),
    ]),
  );
  const roleWords = new Map(
    roles
      .filter((role) => !role.system)
      .map((role) => [role.id, roleLabel(role.labels, language)]),
  );
  const eventWords = (kind: string) =>
    (calendarEventKinds as readonly string[]).includes(kind)
      ? calendarWords(kind as (typeof calendarEventKinds)[number])
      : kind;
  const dueWords = (due: DueRule) => {
    switch (due.type) {
      case "week":
        return t("dueText.week", { week: due.week });
      case "weekly":
        return t("dueText.weekly");
      case "everyWeeks":
        return t("dueText.everyWeeks", { every: due.every });
      case "afterEvent":
        return t("dueText.afterEvent", {
          event: eventWords(due.eventKind),
          weeks: due.weeks,
        });
    }
  };
  const view = (item: FrameworkItemInput & { id: string }) => ({
    ...item,
    words: {
      axis: axisWords.get(item.axisId) ?? "",
      kind: t(`kinds.${item.kind}`),
      appliesTo:
        item.appliesTo.type === "eachSection"
          ? t("eachSection")
          : (roleWords.get(item.appliesTo.roleId) ?? ""),
      due: dueWords(item.due),
      evidence: [
        t("evidenceText", {
          required: String(item.evidence.required),
          types: format.list(
            item.evidence.types.map((type) => t(`evidenceTypes.${type}`)),
          ),
          max: item.evidence.maxFiles,
        }),
        ...(item.evidence.requiresApproval ? [t("approvalText")] : []),
      ].join(" · "),
    },
  });

  // The tasks the draft would create: each department's holders of each role, its sections once
  // Rayat's import brings them (Step 17), and the term's weeks and calendar.
  const departments = Object.values(
    members.reduce<
      Record<string, { roles: Record<string, number>; sections: number }>
    >((all, { departmentId, roleId, count }) => {
      all[departmentId] ??= { roles: {}, sections: 0 };
      all[departmentId].roles[roleId] = count;
      return all;
    }, {}),
  );
  const events: Record<string, number> = {};
  for (const { kind } of calendar?.events ?? []) {
    events[kind] = (events[kind] ?? 0) + 1;
  }
  const { draft, published } = framework;
  const impact = draft
    ? t(
        "impact",
        countTasks(draft.items, departments, { weeks: term.weeks, events }),
      )
    : undefined;
  const preparing = manage || (endorse && needsEndorsement && Boolean(draft));

  return (
    <>
      {header}
      <div className="flex flex-col gap-6">
        {preparing ? (
          <NextIntlClientProvider
            messages={{
              ui: messages.ui,
              actions: messages.actions,
              framework: messages.framework,
            }}
          >
            <FrameworkDraft
              termId={term.id}
              draft={
                draft && {
                  id: draft.id,
                  version: draft.version,
                  endorsed: Boolean(draft.endorsedAt),
                  items: draft.items.map(view),
                }
              }
              hasPublished={Boolean(published)}
              manage={manage}
              endorse={endorse}
              needsEndorsement={needsEndorsement}
              impact={impact}
              limits={frameworkLimits}
              options={{
                axes: axes.map((axis) => ({
                  value: axis.id,
                  label: axisWords.get(axis.id) ?? "",
                })),
                kinds: taskKinds.map((kind) => ({
                  value: kind,
                  label: t(`kinds.${kind}`),
                })),
                roles: [...roleWords].map(([value, label]) => ({
                  value,
                  label,
                })),
                eventKinds: calendarEventKinds.map((kind) => ({
                  value: kind,
                  label: calendarWords(kind),
                })),
                evidenceTypes: evidenceTypes.map((type) => ({
                  value: type,
                  label: t(`evidenceTypes.${type}`),
                })),
                dueTypes: DUE_TYPES.map((type) => ({
                  value: type,
                  label: t(`dueTypes.${type}`),
                })),
              }}
            />
          </NextIntlClientProvider>
        ) : null}
        {published ? (
          <section
            aria-labelledby="framework-published"
            className="rounded-xl border bg-card shadow-xs"
          >
            <div className="px-5 pt-5 sm:px-6">
              <h2 id="framework-published" className="font-medium text-base">
                {t("published")}
              </h2>
              <p className="mt-1 text-muted-foreground text-sm">
                {t("publishedVersion", {
                  version: published.version,
                  date: format.dateTime(published.publishedAt ?? new Date(), {
                    dateStyle: "long",
                  }),
                })}
              </p>
            </div>
            <ol
              aria-labelledby="framework-published"
              className="mt-4 divide-y border-t"
            >
              {published.items.map((item) => (
                <li key={item.id} className="px-5 py-3 sm:px-6">
                  <ItemWords item={view(item)} />
                </li>
              ))}
            </ol>
          </section>
        ) : manage && !draft ? (
          <EmptyState
            title={t("empty.title")}
            description={t("empty.description")}
          />
        ) : manage ? null : (
          <EmptyState
            title={t("notPublished.title")}
            description={t("notPublished.description")}
          />
        )}
      </div>
    </>
  );
}

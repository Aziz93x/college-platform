import type { Metadata } from "next";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import {
  getFormatter,
  getLocale,
  getMessages,
  getTranslations,
} from "next-intl/server";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { sectionCounts } from "@/modules/academics";
import {
  authorize,
  listRoles,
  requireViewer,
  roleHolders,
  roleLabel,
} from "@/modules/access";
import { listAxes } from "@/modules/axes";
import {
  countTasks,
  departmentsReached,
  type FrameworkItemInput,
  frameworkLimits,
  reachesTrainers,
  termFramework,
} from "@/modules/framework";
import { getSetting } from "@/modules/settings";
import { latestRun } from "@/modules/tasks";
import { listExamPeriodTypes } from "@/modules/terms";
import { ItemWords } from "../_items/item-words.tsx";
import { Versions } from "../_items/versions.tsx";
import { itemVocabulary } from "../_items/vocabulary.ts";
import { preparesTerms, termCalendar, viewedTerm } from "../_shell/term.ts";
import { FrameworkDraft, StartVersion } from "./framework-draft.tsx";
import { TaskGeneration } from "./task-generation.tsx";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("framework");
  return { title: t("title") };
}

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
    viewedTerm(viewer.collegeId, preparesTerms(viewer)),
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
    periodTypes,
    framework,
    groups,
    roles,
    needsEndorsement,
    accepted,
    run,
  ] = await Promise.all([
    getMessages(),
    getLocale(),
    getFormatter(),
    listExamPeriodTypes(viewer.collegeId),
    termFramework(viewer.collegeId, term.id),
    listAxes(viewer.collegeId),
    listRoles(viewer.collegeId),
    getSetting("framework.requireEndorsement", scope),
    getSetting("files.acceptedTypes", scope),
    manage ? latestRun(viewer.collegeId, term.id) : undefined,
  ]);
  const language = locale.split("-")[0];
  const { view, options } = itemVocabulary({
    t,
    periodTypes,
    format,
    axes: groups.flatMap((group) => group.axes),
    roles: new Map(
      roles
        .filter((role) => !role.system)
        .map((role) => [role.id, roleLabel(role.labels, language)]),
    ),
    accepted,
  });

  const { draft, published } = framework;
  // A closed term's framework changes no more (Audit 5), so there everyone only reads it.
  const open = term.status !== "closed";
  const preparing =
    open && (manage || (endorse && needsEndorsement && Boolean(draft)));

  // The tasks the draft would create, for whoever prepares it: each department's holders of each
  // role and its sections' and courses' trainers in Rayat's SS01 in force (Step 17), and the term's
  // weeks and exam periods, as the engine counts them (Step 20); the sections an item for their
  // trainers misses, having none yet; and the reviews a week it asks of the department it asks most
  // of, as a department's plan says them (UX review 2).
  const draftPreview = async (items: readonly FrameworkItemInput[]) => {
    const [holders, sections, found] = await Promise.all([
      roleHolders(viewer.collegeId),
      sectionCounts(viewer.collegeId, term.id),
      termCalendar(viewer.collegeId, term.id),
    ]);
    const departments = departmentsReached(holders, sections);
    const shape = { weeks: term.weeks, periods: found?.term.periods ?? [] };
    const untaught = items.some((item) => reachesTrainers(item.appliesTo))
      ? Object.values(sections).reduce((sum, each) => sum + each.untaught, 0)
      : 0;
    const approvals = items.filter(({ evidence }) => evidence.requiresApproval);
    const busiest = Math.max(
      0,
      ...departments.map(
        (department) => countTasks(approvals, [department], shape).tasks,
      ),
    );
    return {
      impact: t("impact", {
        ...countTasks(items, departments, shape),
        untaught,
      }),
      reviews: t("reviewLoad", {
        perWeek: Math.round(busiest / Math.max(term.weeks, 1)),
        total: busiest,
        weeks: term.weeks,
      }),
    };
  };
  const preview =
    preparing && draft ? await draftPreview(draft.items) : undefined;

  // The latest pass of the generation engine over the term's tasks, for whoever publishes the
  // framework (Step 20).
  const generation = () => {
    const when = (at: Date | null) =>
      format.dateTime(at ?? new Date(), {
        dateStyle: "long",
        timeStyle: "short",
      });
    const words = {
      title: t("generation.title"),
      progress: t("generation.progress"),
    };
    if (!run) return { words: { ...words, status: t("generation.none") } };
    switch (run.status) {
      case "queued":
        return {
          following: true,
          words: { ...words, status: t("generation.queued") },
        };
      case "running":
        return run.total === null
          ? {
              following: true,
              words: { ...words, status: t("generation.starting") },
            }
          : {
              following: true,
              progress: run.total > 0 ? (run.done / run.total) * 100 : 0,
              words: {
                ...words,
                status: t("generation.running", {
                  done: run.done,
                  total: run.total,
                }),
              },
            };
      case "done":
        return {
          words: {
            ...words,
            status: t("generation.done", {
              total: run.total ?? 0,
              cause: run.reason,
              date: when(run.finishedAt),
            }),
            changes:
              run.created + run.updated + run.reassigned + run.cancelled > 0
                ? t("generation.changes", {
                    created: run.created,
                    updated: run.updated,
                    reassigned: run.reassigned,
                    cancelled: run.cancelled,
                  })
                : t("generation.unchanged"),
          },
        };
      case "failed":
        return {
          words: {
            ...words,
            status: t("generation.failed", { date: when(run.finishedAt) }),
          },
        };
    }
  };
  const generated = manage && published ? generation() : undefined;

  // The client parts' words, for whoever prepares the framework.
  const client = (children: ReactNode) => (
    <NextIntlClientProvider
      messages={{
        ui: messages.ui,
        actions: messages.actions,
        framework: messages.framework,
      }}
    >
      {children}
    </NextIntlClientProvider>
  );
  const date = (at: Date | null) =>
    format.dateTime(at ?? new Date(), { dateStyle: "long" });
  // The next version starts from the published one's head, as a department's plan's does.
  const starts = open && manage && !draft;

  return (
    <>
      {header}
      <div className="flex flex-col gap-6">
        {preparing && draft
          ? client(
              <FrameworkDraft
                draft={{
                  id: draft.id,
                  version: draft.version,
                  endorsed: Boolean(draft.endorsedAt),
                  items: draft.items.map(view),
                }}
                manage={manage}
                endorse={endorse}
                needsEndorsement={needsEndorsement}
                preview={preview}
                limits={frameworkLimits}
                options={options}
              />,
            )
          : null}
        {published ? (
          <section
            aria-labelledby="framework-published"
            className="rounded-xl border bg-card shadow-xs"
          >
            <div className="px-5 pt-5 sm:px-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2
                    id="framework-published"
                    className="font-medium text-base"
                  >
                    {t("published")}
                  </h2>
                  <p className="mt-1 text-muted-foreground text-sm">
                    {t("publishedVersion", {
                      version: published.version,
                      date: date(published.publishedAt),
                    })}
                  </p>
                </div>
                {starts
                  ? client(
                      <StartVersion
                        termId={term.id}
                        label={t("newVersion", {
                          version: (framework.versions[0]?.version ?? 0) + 1,
                        })}
                      />,
                    )
                  : null}
              </div>
              {generated ? (
                <TaskGeneration
                  following={generated.following ?? false}
                  progress={generated.progress}
                  words={generated.words}
                />
              ) : null}
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
        ) : starts ? (
          <EmptyState
            title={t("empty.title")}
            description={t("empty.description")}
            action={client(
              <StartVersion termId={term.id} label={t("empty.action")} />,
            )}
          />
        ) : open && manage ? null : (
          <EmptyState
            title={t("notPublished.title")}
            description={t("notPublished.description")}
          />
        )}
        {manage ? (
          <Versions
            id="framework-versions"
            title={t("versions.title")}
            versions={framework.versions.map((each) => ({
              version: each.version,
              words:
                each.status === "draft"
                  ? t("versions.draft", {
                      version: each.version,
                      items: each.items,
                    })
                  : t("versions.published", {
                      version: each.version,
                      items: each.items,
                      date: date(each.publishedAt),
                    }),
            }))}
          />
        ) : null}
      </div>
    </>
  );
}

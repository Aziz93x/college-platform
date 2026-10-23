import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getFormatter, getMessages, getTranslations } from "next-intl/server";
import { AnimatedBadge } from "@/components/motion/animated-badge";
import { PageHeader } from "@/components/page-header";
import { authorize, requireViewer } from "@/modules/access";
import { countSessions } from "@/modules/identity";
import { systemStatus } from "@/modules/system";
import { listRuns } from "@/modules/tasks";
import { RerunButton } from "./rerun-button.tsx";
import { SignEveryoneOut } from "./sign-everyone-out.tsx";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("system");
  return { title: t("title") };
}

const card = "rounded-xl border bg-card px-5 py-5 shadow-xs sm:px-6";
const RUN_BADGE = {
  queued: "pending",
  running: "pending",
  done: "success",
  failed: "alert",
} as const;

// The system's state (ADR-0029): its checks, the generation engine's passes over the college's
// terms with a failed one run again, and the sessions signed in now, which can all end but the
// viewer's own. Step 42 adds the errors and the backups.
export default async function SystemPage() {
  await connection();
  const viewer = await requireViewer();
  const { collegeId } = viewer;
  if (!authorize(viewer, "system.manage", { collegeId })) forbidden();

  const [t, causes, generation, format, messages, status, runs, sessions] =
    await Promise.all([
      getTranslations("system"),
      getTranslations("audit.causes"),
      getTranslations("framework.generation"),
      getFormatter(),
      getMessages(),
      systemStatus(),
      listRuns(collegeId),
      countSessions(collegeId),
    ]);
  const when = (at: Date) =>
    format.dateTime(at, { dateStyle: "medium", timeStyle: "short" });
  // The latest pass of each term: only a failed one of a term still open runs again.
  const latest = new Set<string>();
  const runAgain = new Set<string>();
  for (const run of runs) {
    if (latest.has(run.termId)) continue;
    latest.add(run.termId);
    if (run.status === "failed" && run.termStatus !== "closed") {
      runAgain.add(run.id);
    }
  }
  const checks = [
    {
      id: "database",
      ok: status.database,
      value:
        status.database && status.latencyMs !== undefined
          ? t("checks.database.up", { ms: status.latencyMs })
          : t("checks.database.down"),
    },
    {
      id: "queue",
      ok: status.queue,
      value: status.queue ? t("checks.queue.up") : t("checks.queue.down"),
    },
    {
      id: "worker",
      ok: status.worker === "running",
      value:
        status.worker === "never" || !status.lastBeat
          ? t("checks.worker.never")
          : t(`checks.worker.${status.worker}`, {
              date: when(status.lastBeat),
            }),
    },
  ] as const;

  return (
    <NextIntlClientProvider
      messages={{
        ui: messages.ui,
        actions: messages.actions,
        reauth: messages.reauth,
        system: messages.system,
      }}
    >
      <PageHeader title={t("title")} description={t("description")} />
      <div className="flex flex-col gap-6">
        <section aria-labelledby="checks-title" className={card}>
          <h2 id="checks-title" className="text-lg">
            {t("checks.title")}
          </h2>
          <dl className="mt-3 flex flex-col divide-y">
            {checks.map((check) => (
              <div
                key={check.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5"
              >
                <dt className="font-medium">{t(`checks.${check.id}.label`)}</dt>
                <dd>
                  <AnimatedBadge status={check.ok ? "success" : "alert"}>
                    {check.value}
                  </AnimatedBadge>
                </dd>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
              <dt className="font-medium">{t("checks.size.label")}</dt>
              <dd className="text-sm tabular-nums">
                {status.databaseBytes === undefined
                  ? t("checks.size.unknown")
                  : t("checks.size.value", {
                      megabytes: format.number(
                        status.databaseBytes / 1024 / 1024,
                        { maximumFractionDigits: 1 },
                      ),
                    })}
              </dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
              <dt className="font-medium">{t("checks.version.label")}</dt>
              <dd className="text-sm">
                <bdi>
                  {t("checks.version.value", {
                    version: status.version,
                    node: status.node,
                  })}
                </bdi>
              </dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
              <dt className="font-medium">{t("checks.upSince")}</dt>
              <dd className="text-sm">{when(status.upSince)}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="passes-title" className={card}>
          <h2 id="passes-title" className="text-lg">
            {t("passes.title")}
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">
            {t("passes.description")}
          </p>
          {runs.length > 0 ? (
            <ul className="mt-3 flex flex-col divide-y">
              {runs.map((run) => (
                <li
                  key={run.id}
                  className="flex flex-wrap items-start justify-between gap-3 py-3"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{run.termName}</span>
                      <AnimatedBadge status={RUN_BADGE[run.status]}>
                        {t(`passes.status.${run.status}`)}
                      </AnimatedBadge>
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {t("passes.when", {
                        cause: causes(run.reason),
                        date: when(run.queuedAt),
                      })}
                    </p>
                    {run.status === "done" && run.total !== null ? (
                      <p className="text-sm">
                        {generation("changes", {
                          created: run.created,
                          updated: run.updated,
                          reassigned: run.reassigned,
                          cancelled: run.cancelled,
                        })}
                      </p>
                    ) : null}
                    {run.status === "failed" && run.error ? (
                      <p className="text-alert text-sm [overflow-wrap:anywhere]">
                        <bdi>{run.error}</bdi>
                      </p>
                    ) : null}
                  </div>
                  {runAgain.has(run.id) ? (
                    <RerunButton runId={run.id} term={run.termName} />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-muted-foreground text-sm">
              {t("passes.empty")}
            </p>
          )}
        </section>

        <section aria-labelledby="sessions-title" className={card}>
          <h2 id="sessions-title" className="text-lg">
            {t("sessions.title")}
          </h2>
          <p className="mt-1 text-sm">
            {t("sessions.count", { count: sessions })}
          </p>
          <div className="mt-3">
            <SignEveryoneOut />
          </div>
        </section>
      </div>
    </NextIntlClientProvider>
  );
}

import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { forbidden } from "next/navigation";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { FreshOnReturn } from "@/components/fresh-on-return";
import { AnimatedBadge } from "@/components/motion/animated-badge";
import { PageHeader } from "@/components/page-header";
import {
  authorize,
  listDirectory,
  listRoles,
  type PermissionKey,
  requireViewer,
} from "@/modules/access";
import { listAuditEvents } from "@/modules/audit";
import { listDepartments } from "@/modules/org";
import { systemStatus, WORKER_LATE_MS } from "@/modules/system";
import { listRuns } from "@/modules/tasks";
import { consoleKeys, navigation } from "../_shell/navigation.ts";
import { EventList } from "../audit/event-list.tsx";
import { eventRows } from "../audit/lookups.ts";
import { STATE_BADGE } from "../people/state-badge.ts";
import { failedTerms } from "./attention.ts";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("console");
  return { title: t("title") };
}

const card = "rounded-xl border bg-card px-5 py-5 shadow-xs sm:px-6";

// The admin's console (ADR-0029): the college at a glance, what needs attention, the latest changes
// and a tile for each page of the administration, each part for whoever holds its key across the
// college.
export default async function ConsolePage() {
  await connection();
  const viewer = await requireViewer();
  const { collegeId } = viewer;
  const holds = (key: PermissionKey) => authorize(viewer, key, { collegeId });
  if (!consoleKeys.some(holds)) forbidden();

  const [t, nav, { audit }, people, departments, roles, status, runs, log] =
    await Promise.all([
      getTranslations("console"),
      getTranslations("nav"),
      getMessages(),
      holds("people.manage") ? listDirectory(collegeId) : undefined,
      holds("departments.manage") ? listDepartments(collegeId) : undefined,
      holds("roles.manage") ? listRoles(collegeId) : undefined,
      holds("system.manage") ? systemStatus() : undefined,
      holds("system.manage") ? listRuns(collegeId) : undefined,
      holds("audit.view")
        ? listAuditEvents(collegeId, {}, { limit: 6 })
        : undefined,
    ]);
  const events = log ? await eventRows(collegeId, log.events) : undefined;

  const states = people
    ? (Object.keys(STATE_BADGE) as (keyof typeof STATE_BADGE)[]).map(
        (state) => ({
          state,
          count: people.filter((person) => person.state === state).length,
        }),
      )
    : [];
  const locked = states.find(({ state }) => state === "locked")?.count ?? 0;
  const noRole = people?.filter(
    (person) => person.memberships.length === 0,
  ).length;
  const failed = runs ? failedTerms(runs) : 0;
  const minutes = WORKER_LATE_MS / 60_000;
  // What needs the viewer, each linked to the page that settles it.
  const attention: { id: string; text: string; href: string }[] = [];
  if (locked > 0) {
    attention.push({
      id: "locked",
      text: t("attention.locked", { count: locked }),
      href: "/people",
    });
  }
  if (noRole) {
    attention.push({
      id: "noRole",
      text: t("attention.noRole", { count: noRole }),
      href: "/people",
    });
  }
  if (status && !(status.database && status.queue)) {
    attention.push({
      id: "database",
      text: t("attention.database"),
      href: "/system",
    });
  }
  if (status && status.worker !== "running") {
    attention.push({
      id: "worker",
      text: t(`attention.worker.${status.worker}`, { minutes }),
      href: "/system",
    });
  }
  if (failed > 0) {
    attention.push({
      id: "failed",
      text: t("attention.failed", { count: failed }),
      href: "/system",
    });
  }

  // Every page of the administration the viewer opens but this one, with its own description.
  const pages = navigation.filter(
    (item) =>
      "group" in item &&
      item.group === "administration" &&
      item.id !== "console" &&
      [item.permission].flat().some((key) => viewer.permissions.has(key)),
  );
  const descriptions = await Promise.all(
    pages.map(async (item) =>
      (await getTranslations(item.id as "departments"))("description"),
    ),
  );

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      {/* What others do changes the page: a step back to it reads it again (lead review D). */}
      <FreshOnReturn />
      <div className="flex flex-col gap-6">
        <section aria-labelledby="attention-title" className={card}>
          <h2 id="attention-title" className="text-lg">
            {t("attention.title")}
          </h2>
          {attention.length > 0 ? (
            <ul className="mt-3 flex flex-col divide-y">
              {attention.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm underline-offset-4 hover:underline"
                  >
                    <span>{item.text}</span>
                    <ChevronRight
                      aria-hidden
                      className="size-4 shrink-0 text-muted-foreground rtl:-scale-x-100"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-muted-foreground text-sm">
              {t("attention.none")}
            </p>
          )}
        </section>

        {people || departments || roles ? (
          <section aria-labelledby="glance-title" className={card}>
            <h2 id="glance-title" className="text-lg">
              {t("glance.title")}
            </h2>
            <dl className="mt-3 grid gap-4 sm:grid-cols-3">
              {people ? (
                <div>
                  <dt className="text-muted-foreground text-sm">
                    {nav("people")}
                  </dt>
                  <dd className="mt-1 font-medium text-2xl tabular-nums">
                    {t("glance.people", { count: people.length })}
                  </dd>
                  <dd className="mt-2 flex flex-wrap gap-1.5">
                    {states
                      .filter(({ count }) => count > 0)
                      .map(({ state, count }) => (
                        <AnimatedBadge key={state} status={STATE_BADGE[state]}>
                          {t(`glance.states.${state}`, { count })}
                        </AnimatedBadge>
                      ))}
                  </dd>
                </div>
              ) : null}
              {departments ? (
                <div>
                  <dt className="text-muted-foreground text-sm">
                    {nav("departments")}
                  </dt>
                  <dd className="mt-1 font-medium text-2xl tabular-nums">
                    {t("glance.departments", {
                      active: departments.filter(({ active }) => active).length,
                      total: departments.length,
                    })}
                  </dd>
                </div>
              ) : null}
              {roles ? (
                <div>
                  <dt className="text-muted-foreground text-sm">
                    {nav("roles")}
                  </dt>
                  <dd className="mt-1 font-medium text-2xl tabular-nums">
                    {t("glance.roles", { count: roles.length })}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>
        ) : null}

        {events ? (
          <section aria-labelledby="changes-title">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1 px-1">
              <h2 id="changes-title" className="text-lg">
                {t("changes.title")}
              </h2>
              <Link
                href="/audit"
                className="inline-flex min-h-11 items-center text-primary text-sm underline-offset-4 hover:underline"
              >
                {t("changes.all")}
              </Link>
            </div>
            {events.length > 0 ? (
              <NextIntlClientProvider messages={{ audit }}>
                <EventList events={events} level={3} />
              </NextIntlClientProvider>
            ) : (
              <p className="rounded-xl border border-dashed bg-card px-5 py-8 text-center text-muted-foreground text-sm">
                {t("changes.empty")}
              </p>
            )}
          </section>
        ) : null}

        <section aria-labelledby="pages-title">
          <h2 id="pages-title" className="mb-3 px-1 text-lg">
            {t("pages")}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pages.map((item, index) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex h-full min-h-11 gap-3 rounded-xl border bg-card px-4 py-4 shadow-xs transition-colors hover:bg-muted/50"
                >
                  <item.icon
                    aria-hidden
                    className="mt-0.5 size-5 shrink-0 text-primary"
                  />
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="font-medium">{nav(item.id)}</span>
                    <span className="text-muted-foreground text-sm">
                      {descriptions[index]}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { forbidden } from "next/navigation";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTimeZone, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { authorize, requireViewer } from "@/modules/access";
import { listAuditEvents } from "@/modules/audit";
import { wallClock } from "@/platform/i18n/time-zone";
import { AuditFilters } from "./audit-filters.tsx";
import { EventList } from "./event-list.tsx";
import { auditFilters } from "./filters.ts";
import { auditHref } from "./href.ts";
import { actionChoices, eventRows } from "./lookups.ts";
import { parseAuditQuery } from "./query.ts";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("audit");
  return { title: t("title") };
}

// The college's log for whoever may read it: a page of events newest first, narrowed by a period,
// an action and a person, with older pages after it and the whole selection as a CSV file.
export default async function AuditPage({ searchParams }: PageProps<"/audit">) {
  await connection();
  const viewer = await requireViewer();
  const { collegeId } = viewer;
  if (!authorize(viewer, "audit.view", { collegeId })) forbidden();

  const { after, ...query } = parseAuditQuery(await searchParams);
  const timeZone = await getTimeZone();
  const [t, { audit, dateRange }, actions, page] = await Promise.all([
    getTranslations("audit"),
    getMessages(),
    actionChoices(),
    auditFilters(query, collegeId, timeZone).then((filters) =>
      listAuditEvents(collegeId, filters, { after }),
    ),
  ]);
  const events = await eventRows(collegeId, page.events);
  const filtered = Boolean(query.from || query.action || query.q);

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button asChild variant="outline">
            {/* A file, not a page: the browser downloads it, so no client navigation. */}
            <a href={auditHref("/audit/export", query)}>
              <Download aria-hidden />
              {t("export")}
            </a>
          </Button>
        }
      />
      <NextIntlClientProvider messages={{ audit, dateRange }}>
        <AuditFilters
          // A new address starts the fields over from it, as "Clear" does.
          key={auditHref("", query)}
          query={query}
          actions={actions}
          today={wallClock(new Date(), timeZone).slice(0, 10)}
        />
        {events.length > 0 ? (
          <EventList events={events} level={2} origin />
        ) : (
          <EmptyState
            title={t("empty.title")}
            description={
              filtered ? t("empty.description") : t("empty.unfiltered")
            }
            action={
              filtered ? (
                <Button asChild variant="outline">
                  <Link href="/audit">{t("filters.clear")}</Link>
                </Button>
              ) : undefined
            }
          />
        )}
      </NextIntlClientProvider>
      {after || page.next ? (
        <nav
          aria-label={t("pages")}
          className="mt-6 flex flex-wrap items-center justify-between gap-2"
        >
          {after ? (
            <Button asChild variant="outline">
              <Link href={auditHref("/audit", query)}>
                <ChevronLeft aria-hidden className="rtl:-scale-x-100" />
                {t("newest")}
              </Link>
            </Button>
          ) : (
            <span />
          )}
          {page.next ? (
            <Button asChild variant="outline">
              <Link href={auditHref("/audit", { ...query, after: page.next })}>
                {t("older")}
                <ChevronRight aria-hidden className="rtl:-scale-x-100" />
              </Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}

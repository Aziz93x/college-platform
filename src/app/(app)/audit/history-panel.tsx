import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { authorize, requireViewer } from "@/modules/access";
import {
  type AuditAction,
  type AuditCursor,
  entityHistory,
  type HistorySubject,
} from "@/modules/audit";
import { EventList } from "./event-list.tsx";
import { historyHref } from "./href.ts";
import { eventRows } from "./lookups.ts";

// What happened to a record, under its page and newest first: its own events and the memberships
// that name it. Only for whoever may read the log; its older events page within the record's page,
// and what it leaves out, such as an account's sign-ins, is a link away in the log.
export async function HistoryPanel({
  subjects,
  except,
  logHref,
  after,
  href,
}: {
  subjects: HistorySubject[];
  except?: AuditAction[];
  // The log narrowed to the record, with everything the panel leaves out.
  logHref?: string;
  after?: AuditCursor;
  // The record's page.
  href: string;
}) {
  const viewer = await requireViewer();
  const { collegeId } = viewer;
  if (!authorize(viewer, "audit.view", { collegeId })) return null;

  const [t, { audit }, page] = await Promise.all([
    getTranslations("audit"),
    getMessages(),
    entityHistory(collegeId, subjects, { after, except }),
  ]);
  const events = await eventRows(collegeId, page.events);
  return (
    <section
      id="history"
      aria-labelledby="history-title"
      className="mt-6 scroll-mt-24"
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1 px-1">
        <div>
          <h2 id="history-title" className="text-lg">
            {t("history.title")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t("history.description")}
          </p>
        </div>
        {logHref ? (
          <Link
            href={logHref}
            className="inline-flex min-h-11 items-center text-primary text-sm underline-offset-4 hover:underline"
          >
            {t("history.all")}
          </Link>
        ) : null}
      </div>
      {events.length > 0 ? (
        <NextIntlClientProvider messages={{ audit }}>
          <EventList events={events} level={3} />
        </NextIntlClientProvider>
      ) : (
        <p className="rounded-xl border border-dashed bg-card px-5 py-8 text-center text-muted-foreground text-sm">
          {t("history.empty")}
        </p>
      )}
      {after || page.next ? (
        <nav
          aria-label={t("pages")}
          className="mt-4 flex flex-wrap items-center justify-between gap-2"
        >
          {after ? (
            <Button asChild variant="outline">
              <Link href={historyHref(href)}>
                <ChevronLeft aria-hidden className="rtl:-scale-x-100" />
                {t("history.newest")}
              </Link>
            </Button>
          ) : (
            <span />
          )}
          {page.next ? (
            <Button asChild variant="outline">
              <Link href={historyHref(href, page.next)}>
                {t("history.older")}
                <ChevronRight aria-hidden className="rtl:-scale-x-100" />
              </Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}

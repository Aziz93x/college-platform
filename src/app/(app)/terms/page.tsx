import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { forbidden } from "next/navigation";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import {
  getLocale,
  getMessages,
  getTimeZone,
  getTranslations,
} from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { AnimatedBadge } from "@/components/motion/animated-badge";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { authorize, requireViewer } from "@/modules/access";
import { getSetting } from "@/modules/settings";
import {
  calendarOf,
  calendarSettings,
  findTerm,
  holidaysFrom,
  listTerms,
  termEndsOn,
  umAlQuraYear,
} from "@/modules/terms";
import { wallClock } from "@/platform/i18n/time-zone";
import { dayWords } from "./days.ts";
import { HolidayBreaks } from "./holiday-breaks.tsx";
import { STATUS_BADGE } from "./status.ts";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("terms");
  return { title: t("title") };
}

// The college's terms, the latest first, each with its status and days; and its holidays of this
// Umm al-Qura year, estimated until the vice-dean approves or adjusts them (ADR-0018). The other
// years' stay out of sight until their year. The vice-dean's page.
export default async function TermsPage() {
  await connection();
  const viewer = await requireViewer();
  const scope = { collegeId: viewer.collegeId };
  if (!authorize(viewer, "term.manage", scope)) forbidden();

  const [t, messages, locale, timeZone, settings, hijri, terms] =
    await Promise.all([
      getTranslations("terms"),
      getMessages(),
      getLocale(),
      getTimeZone(),
      calendarSettings(viewer.collegeId),
      getSetting("locale.hijri", scope),
      listTerms(viewer.collegeId),
    ]);
  const today = wallClock(new Date(), timeZone).slice(0, 10);
  const days = dayWords(locale, hijri);
  const thisYear = umAlQuraYear(today);
  const [calendars, upcoming] = await Promise.all([
    Promise.all(terms.map((term) => findTerm(viewer.collegeId, term.id))),
    holidaysFrom(viewer.collegeId, today),
  ]);
  const breaks = upcoming.filter((range) => range.hijriYear === thisYear);
  const year = new Intl.NumberFormat(locale, { useGrouping: false });
  const add = (label: string) => (
    <Button asChild>
      <Link href="/terms/new">
        <Plus aria-hidden />
        {label}
      </Link>
    </Button>
  );

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={terms.length > 0 ? add(t("add")) : null}
      />
      <div className="flex flex-col gap-6">
        {terms.length > 0 ? (
          <ul
            aria-label={t("list")}
            className="divide-y rounded-xl border bg-card shadow-xs"
          >
            {calendars.flatMap((term) => {
              if (!term) return [];
              const last = termEndsOn(
                calendarOf(term, term.events, settings, term.breaks),
              );
              return [
                <li key={term.id}>
                  <Link
                    href={`/terms/${term.id}`}
                    className="group/row flex items-center justify-between gap-4 px-5 py-3.5 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:px-6"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {term.name}
                      </span>
                      {/* Under the pointer the muted grey falls below 4.5:1 on the row's tint (Audit 5). */}
                      <span className="block text-muted-foreground text-sm tabular-nums transition-colors group-hover/row:text-foreground">
                        {t("span", {
                          weeks: term.weeks,
                          from: days.day(term.startsOn),
                          to: days.day(last),
                        })}
                      </span>
                    </span>
                    <AnimatedBadge status={STATUS_BADGE[term.status]}>
                      {t(`status.${term.status}`)}
                    </AnimatedBadge>
                  </Link>
                </li>,
              ];
            })}
          </ul>
        ) : (
          <EmptyState
            title={t("empty.title")}
            description={t("empty.description")}
            action={add(t("empty.action"))}
          />
        )}
        <NextIntlClientProvider
          messages={{
            ui: messages.ui,
            actions: messages.actions,
            dateRange: messages.dateRange,
            terms: { breaks: messages.terms.breaks },
          }}
        >
          <HolidayBreaks
            today={today}
            year={year.format(thisYear)}
            breaks={breaks.map((range) => ({
              id: range.id,
              name: range.name,
              year: year.format(range.hijriYear),
              startsOn: range.startsOn,
              endsOn: range.endsOn,
              adjusted: range.adjusted,
              days: days.span(range.startsOn, range.endsOn),
              hijri: days.hijri?.(range.startsOn, range.endsOn),
              begun: range.startsOn <= today,
            }))}
          />
        </NextIntlClientProvider>
      </div>
    </>
  );
}

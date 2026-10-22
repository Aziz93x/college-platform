import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import {
  getLocale,
  getMessages,
  getTimeZone,
  getTranslations,
} from "next-intl/server";
import { cache } from "react";
import { z } from "zod";
import { AnimatedBadge } from "@/components/motion/animated-badge";
import { PageHeader } from "@/components/page-header";
import { authorize, requireViewer } from "@/modules/access";
import { getSetting } from "@/modules/settings";
import {
  activeTerm,
  type CalendarEvent,
  calendarEventKinds,
  calendarOf,
  calendarSettings,
  findTerm,
  type TermCalendar,
  termEndsOn,
  termLimits,
  termWeeks,
  weekOf,
} from "@/modules/terms";
import { wallClock } from "@/platform/i18n/time-zone";
import { HistoryPanel } from "../../audit/history-panel.tsx";
import { parseCursor } from "../../audit/query.ts";
import { dayWords } from "../days.ts";
import { STATUS_BADGE } from "../status.ts";
import { TermForm } from "../term-form.tsx";
import { CalendarEvents } from "./calendar-events.tsx";
import { TermStatus } from "./term-status.tsx";
import { TermWeeks } from "./term-weeks.tsx";

// The term the address names, with whether the viewer manages the college's terms: a draft is the
// vice-dean's only, and an address that is no term's id, or another college's, finds none. Read
// once for the title and the page.
const termFor = cache(async (id: string) => {
  const viewer = await requireViewer();
  const manage = authorize(viewer, "term.manage", {
    collegeId: viewer.collegeId,
  });
  const term = z.uuid().safeParse(id).success
    ? await findTerm(viewer.collegeId, id)
    : undefined;
  return {
    viewer,
    manage,
    term: term && (manage || term.status !== "draft") ? term : undefined,
  };
});

export async function generateMetadata({
  params,
}: PageProps<"/terms/[id]">): Promise<Metadata> {
  await connection();
  const { term } = await termFor((await params).id);
  return { title: term?.name };
}

// The weeks an event spans, by their numbers; holidays say how many weeks they take out of the
// count instead.
function eventWeeks(calendar: TermCalendar, event: CalendarEvent) {
  const weeks = termWeeks(calendar).filter(
    (week) => week.startsOn <= event.endsOn && event.startsOn <= week.endsOn,
  );
  const numbers = weeks.flatMap((week) =>
    week.number === null ? [] : [week.number],
  );
  return {
    skipped: weeks.filter((week) => week.number === null).length,
    from: numbers[0],
    to: numbers.at(-1),
  };
}

// One term: its status and days, the vice-dean's form and actions, its calendar, its weeks with
// this one marked, and its history for whoever may read the log. Others see an active or closed
// term's calendar and weeks only.
export default async function TermPage({
  params,
  searchParams,
}: PageProps<"/terms/[id]">) {
  await connection();
  const { viewer, manage, term } = await termFor((await params).id);
  if (!term) notFound();

  const scope = { collegeId: viewer.collegeId };
  const [t, ui, messages, locale, timeZone, settings, hijri, active] =
    await Promise.all([
      getTranslations("terms"),
      getTranslations("ui"),
      getMessages(),
      getLocale(),
      getTimeZone(),
      calendarSettings(viewer.collegeId),
      getSetting("locale.hijri", scope),
      // The active term an activation would close, by name.
      manage && term.status === "draft"
        ? activeTerm(viewer.collegeId)
        : undefined,
    ]);
  const calendar = calendarOf(term, term.events, settings);
  const lastDay = termEndsOn(calendar);
  const today = wallClock(new Date(), timeZone).slice(0, 10);
  const days = dayWords(locale, hijri);
  const editable = manage && term.status !== "closed";
  const span = t("span", {
    weeks: term.weeks,
    from: days.day(term.startsOn),
    to: days.day(lastDay),
  });

  return (
    <>
      <PageHeader
        title={term.name}
        description={span}
        breadcrumbs={
          manage ? [{ label: t("title"), href: "/terms" }] : undefined
        }
        breadcrumbsLabel={ui("trail")}
        status={
          <AnimatedBadge status={STATUS_BADGE[term.status]}>
            {t(`status.${term.status}`)}
          </AnimatedBadge>
        }
      />
      <NextIntlClientProvider
        messages={{
          ui: messages.ui,
          actions: messages.actions,
          dateRange: messages.dateRange,
          terms: messages.terms,
        }}
      >
        <div className="flex flex-col gap-6">
          {manage ? (
            <TermStatus
              term={{
                id: term.id,
                name: term.name,
                status: term.status,
                weeks: term.weeks,
                nextDay: lastDay,
              }}
              closes={active?.name}
              maxWeeks={termLimits.weeks}
              today={today}
            />
          ) : null}
          {editable ? (
            <section aria-labelledby="term-details" className="flex flex-col gap-2">
              <h2
                id="term-details"
                className="px-1 font-medium text-muted-foreground text-sm"
              >
                {t("form.editTitle")}
              </h2>
              <TermForm
                term={term}
                defaultWeeks={term.weeks}
                maxWeeks={termLimits.weeks}
                today={today}
              />
            </section>
          ) : null}
          <CalendarEvents
            termId={term.id}
            editable={editable}
            kinds={calendarEventKinds}
            firstDay={term.startsOn}
            today={today}
            events={term.events.map((event) => ({
              ...event,
              days: days.span(event.startsOn, event.endsOn),
              hijri: days.hijri?.(event.startsOn, event.endsOn),
              ...eventWeeks(calendar, event),
            }))}
          />
        </div>
      </NextIntlClientProvider>
      <TermWeeks
        weeks={termWeeks(calendar).map((week) => ({
          ...week,
          days: days.span(week.startsOn, week.endsOn),
          hijri: days.hijri?.(week.startsOn, week.endsOn),
          events: term.events
            .filter(
              (event) =>
                event.startsOn <= week.endsOn && week.startsOn <= event.endsOn,
            )
            .map(({ id, kind, title }) => ({ id, kind, title })),
        }))}
        current={weekOf(calendar, today)?.startsOn}
      />
      {manage ? (
        // Shown to whoever may also read the log.
        <HistoryPanel
          subjects={[{ entityType: "term", entityId: term.id }]}
          after={parseCursor((await searchParams).history)}
          href={`/terms/${term.id}`}
        />
      ) : null}
    </>
  );
}

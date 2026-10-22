import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import {
  getFormatter,
  getLocale,
  getTimeZone,
  getTranslations,
} from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { AnimatedBadge } from "@/components/motion/animated-badge";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireViewer } from "@/modules/access";
import { getSetting } from "@/modules/settings";
import { wallClock } from "@/platform/i18n/time-zone";
import {
  navigation,
  orderFor,
  visibleNavigation,
} from "../_shell/navigation.ts";
import { termOnDay, visibleTerms } from "../_shell/term.ts";
import { greetingPeriod } from "./greeting.ts";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("today");
  return { title: t("title") };
}

// Each role's home. Step 23 fills it with the role's work; until then it greets, says where today
// falls in the active term, says what will appear here, and leads to the viewer's next page, the
// first after Today in their navigation.
export default async function TodayPage() {
  // The greeting and the date are the request's, never a build's.
  await connection();
  const viewer = await requireViewer();
  const scope = { collegeId: viewer.collegeId };
  const [t, nav, format, locale, timeZone, hijri, orders] = await Promise.all([
    getTranslations("today"),
    getTranslations("nav"),
    getFormatter(),
    getLocale(),
    getTimeZone(),
    getSetting("locale.hijri", scope),
    getSetting("navigation.order", scope),
  ]);
  const next = visibleNavigation(
    navigation,
    viewer.permissions,
    orderFor(viewer.roleKeys, orders),
  ).find((item) => item.id !== "today");
  const now = new Date();
  // Arabic month names on the Gregorian calendar, in the college's digits (docs/PLAN.md section 4),
  // and the Umm al-Qura date beside it where the locale.hijri setting asks.
  const gregorian = format.dateTime(now, {
    weekday: "long",
    day: "numeric",
    month: "long",
    calendar: "gregory",
  });
  const date = hijri
    ? t("withHijri", {
        gregorian,
        // next-intl's formatter does not take this calendar; Intl does, with the same locale.
        hijri: new Intl.DateTimeFormat(locale, {
          day: "numeric",
          month: "long",
          year: "numeric",
          calendar: "islamic-umalqura",
          timeZone,
        }).format(now),
      })
    : gregorian;
  // Where today falls in the college's active term: its week of how many, a week of holidays, or
  // the day the term starts (Step 13).
  const active = (await visibleTerms(viewer.collegeId, false)).find(
    (term) => term.status === "active",
  );
  const day = wallClock(now, timeZone).slice(0, 10);
  const onDay = active
    ? await termOnDay(viewer.collegeId, active.id, day)
    : undefined;
  const termWords = onDay?.week
    ? onDay.week.number === null
      ? t("term.holiday")
      : t("term.week", { number: onDay.week.number, weeks: onDay.term.weeks })
    : active && day < active.startsOn
      ? t("term.before", {
          date: format.dateTime(new Date(`${active.startsOn}T00:00:00Z`), {
            day: "numeric",
            month: "long",
            timeZone: "UTC",
          }),
        })
      : undefined;
  const eyebrow = t("eyebrow", {
    greeting: t(`greeting.${greetingPeriod(now, timeZone)}`),
    date,
  });
  return (
    <>
      <PageHeader
        eyebrow={eyebrow}
        title={t("title")}
        description={t("description")}
        status={
          termWords ? (
            <AnimatedBadge status="neutral">{termWords}</AnimatedBadge>
          ) : undefined
        }
      />
      <EmptyState
        title={t("empty.title")}
        description={t("empty.description")}
        action={
          next ? (
            <Button asChild variant="outline">
              <Link href={next.href}>
                <next.icon aria-hidden />
                {t("empty.next", { page: nav(next.id) })}
              </Link>
            </Button>
          ) : null
        }
      />
    </>
  );
}

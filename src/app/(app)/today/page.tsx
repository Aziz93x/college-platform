import type { Metadata } from "next";
import { connection } from "next/server";
import { getFormatter, getTimeZone, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { greetingPeriod } from "./greeting.ts";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("today");
  return { title: t("title") };
}

// Each role's home. Step 23 fills it with the role's work; until then it greets and says what
// will appear here.
export default async function TodayPage() {
  // The greeting and the date are the request's, never a build's.
  await connection();
  const [t, format, timeZone] = await Promise.all([
    getTranslations("today"),
    getFormatter(),
    getTimeZone(),
  ]);
  const now = new Date();
  const eyebrow = t("eyebrow", {
    greeting: t(`greeting.${greetingPeriod(now, timeZone)}`),
    // Latin digits with Arabic month names on the Gregorian calendar (docs/PLAN.md section 4).
    date: format.dateTime(now, {
      weekday: "long",
      day: "numeric",
      month: "long",
      calendar: "gregory",
      numberingSystem: "latn",
    }),
  });
  return (
    <>
      <PageHeader
        eyebrow={eyebrow}
        title={t("title")}
        description={t("description")}
      />
      <EmptyState
        title={t("empty.title")}
        description={t("empty.description")}
      />
    </>
  );
}

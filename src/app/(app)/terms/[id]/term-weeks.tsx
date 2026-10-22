import { getFormatter, getTranslations } from "next-intl/server";
import { cn } from "@/components/ui/cn";
import type { TermWeek } from "@/modules/terms";

type WeekView = TermWeek & {
  /** Its days as the page writes them, and on the Umm al-Qura calendar where the college shows it. */
  days: string;
  hijri?: string;
  /** What the calendar holds that week, the college's Eid breaks with the term's own days. */
  holds: string[];
};

// The term's weeks in order, each by its number or as a week of holidays the count skips, with its
// days and what the calendar holds then; this week is marked. Drawn on the server: it adds no
// script to the page.
export async function TermWeeks({
  weeks,
  current,
}: {
  weeks: WeekView[];
  /** The first day of the week today falls in, if it is one of the term's. */
  current?: string;
}) {
  const [t, format] = await Promise.all([
    getTranslations("terms.weeks"),
    getFormatter(),
  ]);
  return (
    <section
      aria-labelledby="term-weeks"
      className="mt-6 rounded-xl border bg-card shadow-xs"
    >
      <div className="px-5 pt-5 sm:px-6">
        <h2 id="term-weeks" className="font-medium text-base">
          {t("title")}
        </h2>
        <p className="mt-1 max-w-prose text-pretty text-muted-foreground text-sm">
          {t("description")}
        </p>
      </div>
      <ol className="mt-4 divide-y border-t">
        {weeks.map((week) => {
          const now = week.startsOn === current;
          // The muted grey measures 4.18:1 on this week's tint and 3.97:1 on a holiday week's
          // (Audit 5), so a tinted row writes all its text in the foreground.
          const tinted = now || week.number === null;
          return (
            <li
              key={week.startsOn}
              aria-current={now ? "date" : undefined}
              className={cn(
                "flex flex-wrap items-baseline gap-x-4 gap-y-1 px-5 py-2.5 sm:px-6",
                week.number === null && "bg-muted/40",
                now && "bg-primary/5",
              )}
            >
              <span className="w-24 shrink-0 font-medium text-sm">
                {week.number === null
                  ? t("holiday")
                  : t("number", { number: week.number })}
              </span>
              <span className="text-sm tabular-nums">
                {week.days}
                {week.hijri ? (
                  <span className={cn(!tinted && "text-muted-foreground")}>
                    <span aria-hidden> · </span>
                    {week.hijri}
                  </span>
                ) : null}
              </span>
              {now ? (
                <span className="rounded-full border px-2 py-0.5 font-medium text-xs">
                  {t("current")}
                </span>
              ) : null}
              {week.holds.length > 0 ? (
                <span
                  className={cn(
                    "basis-full text-xs sm:basis-auto",
                    !tinted && "text-muted-foreground",
                  )}
                >
                  {format.list(week.holds)}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

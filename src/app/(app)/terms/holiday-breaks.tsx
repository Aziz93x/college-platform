"use client";

import { CalendarRange, LoaderCircle, Pencil, Save } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionSwapButton } from "@/components/motion/action-swap";
import { BottomSheet } from "@/components/motion/bottom-sheet";
import { DateRangePickerDropdown } from "@/components/motion/date-range-picker";
import { Button } from "@/components/ui/button";
import { useDateRangeWords } from "@/components/use-date-range-words";
import { firstDayOfWeek } from "@/platform/i18n/language";
import { addDays } from "@/platform/i18n/time-zone";
import { updateHolidayAction } from "./actions.ts";

type BreakView = {
  id: string;
  name: string;
  /** Its Hijri year, written in the college's digits. */
  year: string;
  startsOn: string;
  endsOn: string;
  adjusted: boolean;
  /** Its days as the page writes them, and on the Umm al-Qura calendar where the college shows it. */
  days: string;
  hijri?: string;
  /** It has begun, so it stays as it was. */
  begun: boolean;
};

// The college's Eid breaks of the years ahead (ADR-0018), each an estimate from past calendars
// until the vice-dean sets the days announced for it, in a sheet. Every term counts those that fall
// in it. A break that has begun stays as it was.
export function HolidayBreaks({
  breaks,
  today,
}: {
  breaks: BreakView[];
  today: string;
}) {
  const t = useTranslations("terms.breaks");
  const ui = useTranslations("ui");
  const refusals = useTranslations("actions");
  const locale = useLocale();
  const id = useId();
  const [editing, setEditing] = useState<BreakView>();
  const [range, setRange] = useState<{ from: string; to?: string } | null>(
    null,
  );
  const [error, setError] = useState<string>();
  const [running, setRunning] = useState(false);
  const [, startTransition] = useTransition();
  const dateWords = useDateRangeWords(t("days"));

  const open = (each: BreakView) => {
    setEditing(each);
    setRange({ from: each.startsOn, to: each.endsOn });
    setError(undefined);
  };

  const save = () => {
    const current = editing;
    if (!current) return;
    if (!range?.to) {
      setError(t("daysRequired"));
      return;
    }
    const days = { startsOn: range.from, endsOn: range.to };
    startTransition(async () => {
      setRunning(true);
      setError(undefined);
      const result = await updateHolidayAction({ id: current.id, ...days });
      setRunning(false);
      switch (result?.data?.status) {
        case "saved":
        case "unchanged":
          toast.success(t("saved", { name: current.name, year: current.year }));
          setEditing(undefined);
          return;
        case "begun":
          setError(t("begun"));
          return;
        case "past":
          setError(t("past"));
          return;
        case "notFound":
          setError(t("gone"));
          return;
        default:
          setError(refusals(result?.serverError ?? "unexpected"));
      }
    });
  };

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="rounded-xl border bg-card shadow-xs"
    >
      <div className="px-5 pt-5 sm:px-6">
        <h2
          id={`${id}-title`}
          className="flex items-center gap-2 font-medium text-base"
        >
          <CalendarRange aria-hidden className="size-4 text-muted-foreground" />
          {t("title")}
        </h2>
        <p className="mt-1 max-w-prose text-pretty text-muted-foreground text-sm">
          {t("description")}
        </p>
      </div>
      {breaks.length > 0 ? (
        <ul aria-label={t("title")} className="mt-4 divide-y border-t">
          {breaks.map((each) => (
            <li
              key={each.id}
              className="flex items-start justify-between gap-3 px-5 py-3 sm:px-6"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium text-sm">
                    {t("name", { name: each.name, year: each.year })}
                  </span>
                  <span className="rounded-full border px-2 py-0.5 font-medium text-xs">
                    {each.adjusted ? t("adjusted") : t("estimated")}
                  </span>
                </p>
                <p className="mt-1 text-sm tabular-nums">{each.days}</p>
                {each.hijri ? (
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {each.hijri}
                  </p>
                ) : null}
              </div>
              {each.begun ? null : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("edit", { name: each.name, year: each.year })}
                  onClick={() => open(each)}
                >
                  <Pencil aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 pt-3 pb-5 text-muted-foreground text-sm sm:px-6">
          {t("empty")}
        </p>
      )}
      {breaks.length > 0 ? <div className="h-2" /> : null}

      {editing ? (
        <BottomSheet
          open
          onOpenChange={(next) => {
            if (!next) setEditing(undefined);
          }}
          snapPoints={["auto"]}
          title={t("editTitle", { name: editing.name, year: editing.year })}
          description={t("editDescription")}
          closeLabel={ui("close")}
        >
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
            className="flex flex-col gap-4 pt-2 pb-2"
          >
            <div className="flex flex-col gap-1.5">
              <span className="px-1 font-medium text-sm">{t("days")}</span>
              <DateRangePickerDropdown
                closeOnSelect
                value={range}
                onValueChange={setRange}
                words={dateWords}
                locale={locale}
                weekStartsOn={firstDayOfWeek(locale)}
                min={addDays(today, 1)}
                today={today}
              />
            </div>
            {error ? (
              <p role="alert" className="text-alert text-sm">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <ActionSwapButton
                type="submit"
                disabled={running}
                value={running ? "saving" : "save"}
                items={[
                  { id: "save", label: t("save"), icon: <Save /> },
                  {
                    id: "saving",
                    label: t("saving"),
                    icon: <LoaderCircle className="animate-spin" />,
                  },
                ]}
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditing(undefined)}
              >
                {ui("cancel")}
              </Button>
            </div>
          </form>
        </BottomSheet>
      ) : null}
    </section>
  );
}

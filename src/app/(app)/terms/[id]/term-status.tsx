"use client";

import {
  CalendarPlus,
  CircleCheck,
  CircleStop,
  LoaderCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionSwapButton } from "@/components/motion/action-swap";
import { AdaptiveStepper } from "@/components/motion/adaptive-stepper";
import { BottomSheet } from "@/components/motion/bottom-sheet";
import { DateRangePickerDropdown } from "@/components/motion/date-range-picker";
import { Input } from "@/components/motion/input";
import { Button } from "@/components/ui/button";
import { useDateRangeWords } from "@/components/use-date-range-words";
import type { TermStatus as Status } from "@/modules/terms";
import { firstDayOfWeek } from "@/platform/i18n/language";
import { addDays } from "@/platform/i18n/time-zone";
import { oneLine } from "@/platform/validation/text";
import {
  activateTermAction,
  closeTermAction,
  openNextTermAction,
} from "../actions.ts";

type Sheet = "activate" | "close" | "next";

// What the vice-dean does with a term as a whole, each confirmed in a sheet: make a draft the
// college's active term, closing the one before it; close the active term; and open the next term
// from this one's calendar, a draft with its exam weeks, deadlines and own events at the same places
// in its weeks, its holidays left to enter.
export function TermStatus({
  term,
  closes,
  maxWeeks,
  today,
}: {
  term: {
    id: string;
    name: string;
    status: Status;
    weeks: number;
    /** The term's last day: the next term starts the day after it, unless chosen otherwise. */
    nextDay: string;
  };
  /** The active term an activation closes, by name. */
  closes?: string;
  maxWeeks: number;
  today: string;
}) {
  const t = useTranslations("terms.lifecycle");
  const form = useTranslations("terms.form");
  const ui = useTranslations("ui");
  const refusals = useTranslations("actions");
  const format = useFormatter();
  const locale = useLocale();
  const router = useRouter();
  const id = useId();
  const [sheet, setSheet] = useState<Sheet>();
  const [error, setError] = useState<string>();
  const [running, setRunning] = useState(false);
  const [, startTransition] = useTransition();
  const [next, setNext] = useState({
    name: "",
    startsOn: addDays(term.nextDay, 1),
    weeks: term.weeks,
  });
  const dateWords = useDateRangeWords(form("startsOn"));

  const openSheet = (which: Sheet) => {
    setSheet(which);
    setError(undefined);
  };

  const refuse = (
    status: string | undefined,
    serverError?: "signedOut" | "forbidden" | "unexpected",
  ) => {
    if (status === "notDraft" || status === "notActive") setError(t("moved"));
    else if (status === "nameTaken") setError(form("nameTaken"));
    else if (status === "notFound") setError(form("gone"));
    else setError(refusals(serverError ?? "unexpected"));
  };

  const run = () =>
    startTransition(async () => {
      setRunning(true);
      setError(undefined);
      if (sheet === "activate") {
        const result = await activateTermAction({ id: term.id });
        setRunning(false);
        if (result?.data?.status === "activated") {
          toast.success(t("activated", { name: term.name }));
          setSheet(undefined);
          return;
        }
        refuse(result?.data?.status, result?.serverError);
      } else if (sheet === "close") {
        const result = await closeTermAction({ id: term.id });
        setRunning(false);
        if (result?.data?.status === "closed") {
          toast.success(t("closedToast", { name: term.name }));
          setSheet(undefined);
          return;
        }
        refuse(result?.data?.status, result?.serverError);
      } else {
        const name = oneLine(next.name);
        if (!name) {
          setRunning(false);
          setError(form("nameRequired"));
          return;
        }
        const result = await openNextTermAction({
          fromId: term.id,
          ...next,
          name,
        });
        const outcome = result?.data;
        if (outcome?.status === "created") {
          // The button keeps saying it is opening until the new term's page is on show.
          toast.success(t("opened", { name, count: outcome.copied }));
          router.push(`/terms/${outcome.id}`);
          return;
        }
        setRunning(false);
        refuse(outcome?.status, result?.serverError);
      }
    });

  const confirm = {
    activate: { label: t("activateConfirm"), icon: <CircleCheck /> },
    close: { label: t("closeConfirm"), icon: <CircleStop /> },
    next: { label: t("nextConfirm"), icon: <CalendarPlus /> },
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {term.status === "draft" ? (
        <Button type="button" onClick={() => openSheet("activate")}>
          <CircleCheck aria-hidden />
          {t("activate")}
        </Button>
      ) : null}
      {term.status === "active" ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => openSheet("close")}
        >
          <CircleStop aria-hidden />
          {t("close")}
        </Button>
      ) : null}
      <Button type="button" variant="outline" onClick={() => openSheet("next")}>
        <CalendarPlus aria-hidden />
        {t("next")}
      </Button>

      {sheet ? (
        <BottomSheet
          open
          onOpenChange={(open) => {
            if (!open && !running) setSheet(undefined);
          }}
          snapPoints={["auto"]}
          title={
            sheet === "activate"
              ? t("activateTitle", { name: term.name })
              : sheet === "close"
                ? t("closeTitle", { name: term.name })
                : t("nextTitle", { name: term.name })
          }
          description={
            sheet === "activate"
              ? closes
                ? t("activateCloses", { name: term.name, closes })
                : t("activateDescription", { name: term.name })
              : sheet === "close"
                ? t("closeDescription")
                : t("nextDescription")
          }
          closeLabel={ui("close")}
        >
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              run();
            }}
            className="flex flex-col gap-4 pt-2 pb-2"
          >
            {sheet === "next" ? (
              <>
                <Input
                  label={form("name")}
                  autoComplete="off"
                  value={next.name}
                  onChange={(name) =>
                    setNext((current) => ({ ...current, name }))
                  }
                  hint={form("nameHint")}
                />
                <div className="flex flex-col gap-1.5">
                  <span className="px-1 font-medium text-sm">
                    {form("startsOn")}
                  </span>
                  <DateRangePickerDropdown
                    single
                    closeOnSelect
                    value={{ from: next.startsOn, to: next.startsOn }}
                    onValueChange={(range) => {
                      if (range) {
                        setNext((current) => ({
                          ...current,
                          startsOn: range.from,
                        }));
                      }
                    }}
                    words={dateWords}
                    locale={locale}
                    weekStartsOn={firstDayOfWeek(locale)}
                    today={today}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span id={`${id}-weeks`} className="px-1 font-medium text-sm">
                    {form("weeks")}
                  </span>
                  <AdaptiveStepper
                    aria-labelledby={`${id}-weeks`}
                    value={next.weeks}
                    onValueChange={(weeks) =>
                      setNext((current) => ({ ...current, weeks }))
                    }
                    min={1}
                    max={maxWeeks}
                    labels={{
                      decrease: form("fewerWeeks"),
                      increase: form("moreWeeks"),
                    }}
                    formatValue={(count) => format.number(count)}
                    formatValueText={(count) => form("weeksValue", { count })}
                  />
                </div>
              </>
            ) : null}
            {error ? (
              <p role="alert" className="text-alert text-sm">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <ActionSwapButton
                type="submit"
                disabled={running}
                value={running ? "running" : "idle"}
                items={[
                  { id: "idle", ...confirm[sheet] },
                  {
                    id: "running",
                    label: t("working"),
                    icon: <LoaderCircle className="animate-spin" />,
                  },
                ]}
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSheet(undefined)}
              >
                {ui("cancel")}
              </Button>
            </div>
          </form>
        </BottomSheet>
      ) : null}
    </div>
  );
}

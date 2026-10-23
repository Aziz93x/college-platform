"use client";

import { LoaderCircle, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionSwapButton } from "@/components/motion/action-swap";
import { AdaptiveStepper } from "@/components/motion/adaptive-stepper";
import { DateRangePickerDropdown } from "@/components/motion/date-range-picker";
import { Input } from "@/components/motion/input";
import { SaveActions, useSaveState } from "@/components/save-actions";
import { Button } from "@/components/ui/button";
import { useDateRangeWords } from "@/components/use-date-range-words";
import { firstDayOfWeek } from "@/platform/i18n/language";
import { oneLine } from "@/platform/validation/text";
import { createTermAction, updateTermAction } from "./actions.ts";

type Draft = { name: string; startsOn: string | null; weeks: number };
type Field = "name" | "startsOn";

// A term's name as Rayat writes it, its first day and its number of weeks. Without a term it adds
// one, a draft, and opens its page; with one it saves it in place. A change that would leave a day
// of its calendar outside the term is refused, naming the days.
export function TermForm({
  term,
  defaultWeeks,
  maxWeeks,
  today,
}: {
  term?: { id: string; name: string; startsOn: string; weeks: number };
  /** The usual length of a term (calendar.termWeeks), for a new one. */
  defaultWeeks: number;
  maxWeeks: number;
  /** The day it is on the college's clock, YYYY-MM-DD. */
  today: string;
}) {
  const t = useTranslations("terms.form");
  const ui = useTranslations("ui");
  const refusals = useTranslations("actions");
  const format = useFormatter();
  const locale = useLocale();
  const router = useRouter();
  const id = useId();
  const saved: Draft = term ?? {
    name: "",
    startsOn: null,
    weeks: defaultWeeks,
  };
  const [draft, setDraft] = useState<Draft>(saved);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [refusal, setRefusal] = useState<string>();
  const [state, setState] = useSaveState();
  const [, startTransition] = useTransition();
  const dateWords = useDateRangeWords(t("startsOn"));

  const dirty =
    !term ||
    oneLine(draft.name) !== term.name ||
    draft.startsOn !== term.startsOn ||
    draft.weeks !== term.weeks;

  const change = (patch: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors((all) => {
      const next = { ...all };
      for (const field of Object.keys(patch)) delete next[field as Field];
      return next;
    });
    setRefusal(undefined);
    setState("idle");
  };

  const submit = () => {
    const missing: Partial<Record<Field, string>> = {};
    if (!oneLine(draft.name)) missing.name = t("nameRequired");
    if (!draft.startsOn) missing.startsOn = t("startRequired");
    setErrors(missing);
    if (!draft.startsOn || Object.keys(missing).length > 0) return;
    const input = { ...draft, startsOn: draft.startsOn };
    startTransition(async () => {
      setState("saving");
      const result = term
        ? await updateTermAction({ ...input, id: term.id })
        : await createTermAction(input);
      const outcome = result?.data;
      switch (outcome?.status) {
        case "created":
          // The button keeps saying it is adding until the term's page is on show.
          toast.success(t("created", { name: oneLine(draft.name) }));
          router.push(`/terms/${outcome.id}`);
          return;
        case "saved":
        case "unchanged":
          setState("saved");
          toast.success(t("saved"));
          return;
        case "nameTaken":
          setErrors({ name: t("nameTaken") });
          break;
        case "eventsOutside":
          setRefusal(
            t("eventsOutside", { events: format.list(outcome.events) }),
          );
          break;
        case "closed":
          setRefusal(t("closed"));
          break;
        case "notFound":
          setRefusal(t("gone"));
          break;
        default:
          setRefusal(refusals(result?.serverError ?? "unexpected"));
      }
      setState("idle");
    });
  };

  const ids = {
    start: `${id}-start`,
    startNote: `${id}-start-note`,
    weeks: `${id}-weeks`,
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="divide-y rounded-xl border bg-card shadow-xs"
    >
      <div className="grid grid-cols-1 gap-5 px-5 py-5 sm:px-6 lg:grid-cols-2">
        <div className="lg:col-span-2 lg:max-w-xl">
          <Input
            label={t("name")}
            autoComplete="off"
            value={draft.name}
            onChange={(name) => change({ name })}
            error={errors.name}
            hint={t("nameHint")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span id={ids.start} className="px-1 font-medium text-sm">
            {t("startsOn")}
          </span>
          <DateRangePickerDropdown
            single
            closeOnSelect
            value={
              draft.startsOn
                ? { from: draft.startsOn, to: draft.startsOn }
                : null
            }
            onValueChange={(range) => change({ startsOn: range?.from ?? null })}
            words={dateWords}
            placeholder={t("startPlaceholder")}
            locale={locale}
            weekStartsOn={firstDayOfWeek(locale)}
            today={today}
            aria-describedby={ids.startNote}
          />
          <p
            id={ids.startNote}
            role={errors.startsOn ? "alert" : undefined}
            className={
              errors.startsOn
                ? "px-1 text-alert text-sm"
                : "px-1 text-muted-foreground text-sm"
            }
          >
            {errors.startsOn ?? t("startHint")}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <span id={ids.weeks} className="px-1 font-medium text-sm">
            {t("weeks")}
          </span>
          <AdaptiveStepper
            aria-labelledby={ids.weeks}
            value={draft.weeks}
            onValueChange={(weeks) => change({ weeks })}
            min={1}
            max={maxWeeks}
            labels={{ decrease: t("fewerWeeks"), increase: t("moreWeeks") }}
            formatValue={(count) => format.number(count)}
            formatValueText={(count) => t("weeksValue", { count })}
          />
        </div>
      </div>
      {term && !dirty && state === "idle" && !refusal ? null : (
        <div className="flex flex-col gap-3 px-5 py-4 sm:px-6">
          {refusal ? (
            <p role="alert" className="text-alert text-sm">
              {refusal}
            </p>
          ) : null}
          {term ? (
            <SaveActions
              dirty={dirty}
              state={state}
              onDiscard={() => {
                setDraft(saved);
                setErrors({});
                setRefusal(undefined);
              }}
              words={{ save: t("save"), saving: t("saving") }}
            />
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button asChild variant="ghost">
                <Link href="/terms">{ui("cancel")}</Link>
              </Button>
              <ActionSwapButton
                type="submit"
                disabled={state === "saving"}
                value={state === "saving" ? "creating" : "create"}
                items={[
                  { id: "create", label: t("create"), icon: <Plus /> },
                  {
                    id: "creating",
                    label: t("creating"),
                    icon: <LoaderCircle className="animate-spin" />,
                  },
                ]}
              />
            </div>
          )}
        </div>
      )}
    </form>
  );
}

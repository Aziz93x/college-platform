"use client";

import { LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionSwapButton } from "@/components/motion/action-swap";
import { AdaptiveStepper } from "@/components/motion/adaptive-stepper";
import { Button } from "@/components/ui/button";
import type { ExamPeriod } from "@/modules/terms";
import { saveExamPeriodsAction } from "../actions.ts";

// The term's exam periods by week number (the owner's notes, 21 October 2026): a row for each type of
// the college's catalog, with its weeks and their days where the term has a period of it. The
// vice-dean adds one, moves its first and last weeks with the steppers or takes it away, and saves
// them all at once. A period past the term's last week, or two that share a week, is an error here
// as the vice-dean steps, and the server saves and activates the term with neither. Everyone else
// reads them.
export function ExamPeriods({
  termId,
  editable,
  weeks,
  types,
  periods,
  days,
}: {
  termId: string;
  /** Whether the viewer sets them: the vice-dean's, until the term is closed. */
  editable: boolean;
  /** The term's numbered weeks. */
  weeks: number;
  /** The college's types of exam period, in order. */
  types: readonly { code: string; name: string }[];
  periods: readonly ExamPeriod[];
  /** Each numbered week's first day and its last working day, YYYY-MM-DD, by its number. */
  days: Readonly<Record<number, { first: string; last: string }>>;
}) {
  const t = useTranslations("terms.periods");
  const refusals = useTranslations("actions");
  const format = useFormatter();
  const id = useId();
  const [draft, setDraft] = useState<ExamPeriod[]>([...periods]);
  const [error, setError] = useState<string>();
  const [running, setRunning] = useState(false);
  const [, startTransition] = useTransition();

  const name = (code: string) =>
    types.find((type) => type.code === code)?.name ?? code;
  const day = (iso: string) =>
    format.dateTime(new Date(`${iso}T00:00:00Z`), {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });
  // From the first day of its first week to the last working day of its last.
  const dates = (period: ExamPeriod) => {
    const first = days[period.from];
    const last = days[period.to];
    return first && last
      ? t("dates", { from: day(first.first), to: day(last.last) })
      : undefined;
  };
  const span = (period: ExamPeriod) =>
    period.from === period.to
      ? t("week", { number: period.from })
      : t("weeks", { from: period.from, to: period.to });
  const pastEnd = (period: ExamPeriod) => period.to > weeks;
  // The first two periods that share a week, in the catalog's order.
  const listed = types.flatMap(
    (type) => draft.find((period) => period.type === type.code) ?? [],
  );
  const overlap = listed
    .flatMap((period, index) =>
      listed
        .slice(index + 1)
        .filter((other) => period.from <= other.to && other.from <= period.to)
        .map((other) => [period, other] as const),
    )
    .at(0);

  const change = (type: string, next: Partial<ExamPeriod>) =>
    setDraft((current) =>
      current.map((period) =>
        period.type === type ? { ...period, ...next } : period,
      ),
    );
  // A new period takes the week after the latest one, or the term's first week.
  const add = (type: string) =>
    setDraft((current) => {
      const week = Math.min(
        weeks,
        Math.max(0, ...current.map((period) => period.to)) + 1,
      );
      return [...current, { type, from: week, to: week }];
    });
  const remove = (type: string) =>
    setDraft((current) => current.filter((period) => period.type !== type));

  const save = () => {
    if (draft.some(pastEnd) || overlap) {
      setError(t("fixFirst"));
      return;
    }
    startTransition(async () => {
      setRunning(true);
      setError(undefined);
      const result = await saveExamPeriodsAction({ termId, periods: draft });
      setRunning(false);
      const outcome = result?.data;
      switch (outcome?.status) {
        case "saved":
          toast.success(t("saved"));
          return;
        case "unchanged":
          toast(t("unchanged"));
          return;
        case "pastEnd":
          setError(
            t("refusedPastEnd", { periods: format.list(outcome.periods) }),
          );
          return;
        case "overlap":
          setError(
            t("refusedOverlap", { periods: format.list(outcome.periods) }),
          );
          return;
        case "unknownType":
          setError(t("unknownType"));
          return;
        case "closed":
          setError(t("closed"));
          return;
        case "notFound":
          setError(t("gone"));
          return;
        default:
          setError(refusals(result?.serverError ?? "unexpected"));
      }
    });
  };

  const stepper = (row: string, period: ExamPeriod, which: "from" | "to") => (
    <div className="flex flex-col gap-1.5">
      <span id={`${row}-${which}`} className="px-1 font-medium text-sm">
        {t(which)}
      </span>
      <AdaptiveStepper
        aria-labelledby={`${row}-name ${row}-${which}`}
        value={period[which]}
        onValueChange={(value) => change(period.type, { [which]: value })}
        min={which === "from" ? 1 : period.from}
        max={which === "from" ? period.to : Math.max(weeks, period.to)}
        labels={{ decrease: t("earlier"), increase: t("later") }}
        formatValue={(value) => format.number(value)}
        formatValueText={(number) => t("week", { number })}
      />
    </div>
  );

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="rounded-xl border bg-card shadow-xs"
    >
      <div className="px-5 pt-5 sm:px-6">
        <h2 id={`${id}-title`} className="font-medium text-base">
          {t("title")}
        </h2>
        <p className="mt-1 max-w-prose text-pretty text-muted-foreground text-sm">
          {t(editable ? "description" : "readDescription")}
        </p>
      </div>
      {editable ? (
        <>
          <ul className="mt-4 divide-y border-t">
            {types.map((type, index) => {
              const row = `${id}-${index}`;
              const period = draft.find((each) => each.type === type.code);
              return (
                <li
                  key={type.code}
                  className="flex flex-col gap-3 px-5 py-4 sm:px-6"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p id={`${row}-name`} className="font-medium text-sm">
                        {type.name}
                      </p>
                      <p className="mt-1 text-muted-foreground text-sm tabular-nums">
                        {period
                          ? [span(period), dates(period)]
                              .filter(Boolean)
                              .join(" · ")
                          : t("none")}
                      </p>
                    </div>
                    {period ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t("remove", { name: type.name })}
                        onClick={() => remove(type.code)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        aria-label={t("addOf", { name: type.name })}
                        onClick={() => add(type.code)}
                      >
                        <Plus aria-hidden />
                        {t("add")}
                      </Button>
                    )}
                  </div>
                  {period ? (
                    <div className="flex flex-wrap gap-x-6 gap-y-3">
                      {stepper(row, period, "from")}
                      {stepper(row, period, "to")}
                    </div>
                  ) : null}
                  {period && pastEnd(period) ? (
                    <p role="alert" className="text-alert text-sm">
                      {t("pastEnd", { weeks })}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <div className="flex flex-col gap-3 border-t px-5 py-4 sm:px-6">
            {overlap ? (
              <p role="alert" className="text-alert text-sm">
                {t("overlap", {
                  first: name(overlap[0].type),
                  second: name(overlap[1].type),
                })}
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="text-alert text-sm">
                {error}
              </p>
            ) : null}
            <div>
              <ActionSwapButton
                type="button"
                onClick={save}
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
            </div>
          </div>
        </>
      ) : listed.length > 0 ? (
        <ul aria-label={t("title")} className="mt-4 divide-y border-t">
          {listed.map((period) => (
            <li key={period.type} className="px-5 py-3 sm:px-6">
              <p className="font-medium text-sm">{name(period.type)}</p>
              <p className="mt-1 text-sm tabular-nums">
                {[span(period), dates(period)].filter(Boolean).join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 pt-3 pb-5 text-muted-foreground text-sm sm:px-6">
          {t("empty")}
        </p>
      )}
      {!editable && listed.length > 0 ? <div className="h-2" /> : null}
    </section>
  );
}

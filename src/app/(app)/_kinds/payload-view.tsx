"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Fragment } from "react";
import {
  kindFields,
  type Payload,
  type PayloadField,
  type TaskKind,
} from "@/modules/framework";
import { useBandWords } from "./band-words.ts";

// A day as the college's calendar writes it.
const dayOf = (day: string) => new Date(`${day}T00:00:00Z`);

// What a trainer filled in for a task of a kind, each of its fields with its words (Step 18): the
// task card, the review and the portfolio show it (Steps 26, 29 and 31).
export function PayloadView({
  kind,
  value,
}: {
  kind: TaskKind;
  value: Payload;
}) {
  const t = useTranslations("kinds");
  const format = useFormatter();
  const bandWords = useBandWords();
  const fields: readonly PayloadField[] = kindFields[kind];
  const day = (text: string) =>
    format.dateTime(dayOf(text), { dateStyle: "long", timeZone: "UTC" });

  const shown = (field: PayloadField, given: unknown) => {
    switch (field.type) {
      case "line":
        return String(given ?? "") || t("empty");
      case "paragraph":
        return (
          <span className="whitespace-pre-line">
            {String(given ?? "") || t("empty")}
          </span>
        );
      case "day":
        return given ? day(String(given)) : t("empty");
      case "week":
        return t("week", { week: Number(given) });
      case "percent":
        return format.number(Number(given) / 100, {
          style: "percent",
          maximumFractionDigits: 2,
        });
      case "check":
        return given ? t("yes") : t("no");
      case "choice":
        return String(given ?? "");
      case "choices":
        return format.list((given as string[] | undefined) ?? []);
      case "bands": {
        const bands = [...((given as { from: number; count: number }[]) ?? [])]
          .sort((a, b) => b.from - a.from)
          .map((band, index, all) => ({
            ...band,
            to: index === 0 ? 100 : all[index - 1].from,
          }));
        return (
          <ul className="flex flex-col gap-0.5">
            {bands.map((band) => (
              <li key={band.from}>
                {t("bandCount", {
                  band: bandWords(band),
                  count: band.count,
                })}
              </li>
            ))}
          </ul>
        );
      }
      case "sessions":
        return (
          <ol className="flex flex-col gap-1.5">
            {((given as { on: string; notes: string }[]) ?? []).map(
              (session, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a session's place is its identity.
                <li key={index}>
                  <span className="font-medium">{day(session.on)}</span>
                  <span className="block whitespace-pre-line">
                    {session.notes}
                  </span>
                </li>
              ),
            )}
          </ol>
        );
    }
  };

  return (
    <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
      {fields.map((field) => (
        <Fragment key={field.name}>
          <dt className="text-muted-foreground">
            {t(`fields.${field.name}` as "fields.notes")}
          </dt>
          <dd className="min-w-0">{shown(field, value[field.name])}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

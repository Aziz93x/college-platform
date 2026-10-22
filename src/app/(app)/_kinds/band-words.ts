"use client";

import { useFormatter, useTranslations } from "next-intl";

// A grade band in words, in the page's digits: the highest to 100, the lowest below the band
// above it, and every other from its bound to below the next.
export function useBandWords() {
  const t = useTranslations("kinds.bands");
  const format = useFormatter();
  const number = (value: number) => format.number(value);
  return ({ from, to }: { from: number; to: number }) =>
    to === 100
      ? t("top", { from: number(from) })
      : from === 0
        ? t("lowest", { to: number(to) })
        : t("between", { from: number(from), to: number(to) });
}

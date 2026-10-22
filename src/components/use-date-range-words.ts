import { useTranslations } from "next-intl";
import type { DateRangePickerWords } from "@/components/motion/date-range-picker";

// The date range picker's words from the catalog, under the name of what it chooses.
export function useDateRangeWords(label: string): DateRangePickerWords {
  const t = useTranslations("dateRange");
  return {
    label,
    placeholder: t("placeholder"),
    start: t("start"),
    end: t("end"),
    unchosen: t("unchosen"),
    chooseMonth: t("chooseMonth"),
    chooseYear: t("chooseYear"),
    monthsOf: (year) => t("monthsOf", { year }),
    yearsFrom: (from, to) => t("yearsFrom", { from, to }),
    previous: {
      month: t("previous.month"),
      year: t("previous.year"),
      years: t("previous.years"),
    },
    next: {
      month: t("next.month"),
      year: t("next.year"),
      years: t("next.years"),
    },
    help: t("help"),
    startChosen: (date) => t("startChosen", { date }),
    rangeChosen: (from, to) => t("rangeChosen", { from, to }),
    dayChosen: (date) => t("dayChosen", { date }),
    unavailable: t("unavailable"),
    cleared: t("cleared"),
    chooseStart: t("chooseStart"),
    chooseEnd: t("chooseEnd"),
    days: (count) => t("days", { count }),
    clear: t("clear"),
    clearLabel: t("clearLabel"),
  };
}

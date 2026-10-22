"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { SettingUnit } from "@/modules/settings";
import { catalogDefaults, type SettingView } from "./setting-view.ts";

// The words the screen shows for settings and their values, from the catalog, with numbers and
// times in the college's digits.
export function useSettingWords() {
  const t = useTranslations("settings");
  const catalog = useTranslations();
  const format = useFormatter();

  const number = (value: number) =>
    format.number(value, { useGrouping: false });

  // A choice's option: its value names it (settings.options.<value>), checked for every setting
  // by tests/unit/settings-catalog.test.ts.
  const option = (value: string) => t(`options.${value}` as "options.ar");

  // A count with its unit ("15 minutes"), or an hour of the day as a time ("7:00 am").
  const withUnit = (unit: SettingUnit | undefined, value: number) => {
    if (unit === "hourOfDay") {
      return t("units.hourOfDay", {
        time: format.dateTime(new Date(Date.UTC(2000, 0, 1, value)), {
          hour: "numeric",
          minute: "2-digit",
          timeZone: "UTC",
        }),
      });
    }
    return unit ? t(`units.${unit}`, { count: value }) : number(value);
  };

  // A value as the default line shows it: words for a choice or a yes or no, the catalog's
  // words for an empty text, the list joined.
  const describe = (setting: SettingView, value: unknown) => {
    const { control } = setting;
    switch (control.kind) {
      case "switch":
        return value ? t("on") : t("off");
      case "choice":
        return option(String(value));
      case "slider":
      case "stepper":
      case "number":
        return withUnit(setting.unit, Number(value));
      case "list":
        return format.list(
          ((value ?? []) as (string | number)[]).map((item) =>
            control.item === "percent"
              ? withUnit("percent", Number(item))
              : String(item),
          ),
        );
      case "columns":
        return format.list(
          Object.values((value ?? {}) as Record<string, string>),
        );
      case "text": {
        const fallback = catalogDefaults[setting.key];
        if (value === null && fallback)
          return catalog(fallback as "platform.name");
        return String(value ?? "");
      }
    }
  };

  return {
    t,
    number,
    option,
    withUnit,
    describe,
    // Typed by key: a setting without its label or description fails the type check.
    label: (setting: SettingView) => t(`fields.${setting.key}.label`),
    // A field of a columns control, such as a Rayat report's term column.
    column: (field: string) => t(`columns.${field}` as "columns.term"),
    description: (setting: SettingView) =>
      t(`fields.${setting.key}.description`),
    fallback: (setting: SettingView) => {
      const key = catalogDefaults[setting.key];
      return key ? catalog(key as "platform.name") : undefined;
    },
  };
}

export type SettingWords = ReturnType<typeof useSettingWords>;

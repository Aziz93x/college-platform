"use client";

import { ListField } from "@/components/list-field";
import { AdaptiveStepper } from "@/components/motion/adaptive-stepper";
import { Input } from "@/components/motion/input";
import { RangeSlider } from "@/components/motion/range-slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/motion/select";
import { Switch } from "@/components/motion/switch";
import { Textarea } from "@/components/ui/textarea";
import { toLatinDigits } from "@/platform/validation/digits";
import type { SettingView } from "./setting-view.ts";
import type { SettingWords } from "./use-setting-words.ts";

// Text longer than this is edited in a box that grows with it, not on one line.
const LONG_TEXT = 80;

// The control a setting's schema calls for (src/modules/settings/domain/controls.ts), holding the
// value being edited: a number field holds the text typed, every other control its value.
export function SettingField({
  setting,
  value,
  onChange,
  error,
  ids,
  words,
}: {
  setting: SettingView;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  ids: { label: string; description: string };
  words: SettingWords;
}) {
  const { control } = setting;
  const label = words.label(setting);
  const aria = {
    "aria-labelledby": ids.label,
    "aria-describedby": ids.description,
  };
  switch (control.kind) {
    case "switch":
      return (
        <Switch {...aria} checked={Boolean(value)} onCheckedChange={onChange} />
      );
    case "choice":
      return (
        <Select
          aria-labelledby={ids.label}
          value={String(value)}
          onValueChange={onChange}
          className="w-full lg:w-64"
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {control.options.map((option) => (
              <SelectItem key={option} value={option}>
                {words.option(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "stepper":
      return (
        <div className="flex flex-col items-start gap-1.5 lg:items-end">
          <AdaptiveStepper
            {...aria}
            value={Number(value)}
            onValueChange={onChange}
            min={control.min}
            max={control.max}
            labels={{
              decrease: words.t("stepper.decrease"),
              increase: words.t("stepper.increase"),
            }}
            formatValue={words.number}
            formatValueText={(count) => words.withUnit(setting.unit, count)}
          />
          <p aria-hidden className="px-1 text-muted-foreground text-sm">
            {words.withUnit(setting.unit, Number(value))}
          </p>
        </div>
      );
    case "slider":
      return (
        <div className="flex w-full flex-col gap-1.5 lg:w-64">
          <RangeSlider
            {...aria}
            value={Number(value)}
            onValueChange={onChange}
            min={control.min}
            max={control.max}
            formatValueText={(count) => words.withUnit(setting.unit, count)}
          />
          <p
            aria-hidden
            className="px-1 text-muted-foreground text-sm tabular-nums"
          >
            {words.withUnit(setting.unit, Number(value))}
          </p>
        </div>
      );
    case "number": {
      const typed = parseWhole(String(value));
      return (
        <Input
          label={label}
          hideLabel
          inputMode="numeric"
          autoComplete="off"
          value={String(value)}
          onChange={onChange}
          error={error}
          hint={
            typed === undefined
              ? undefined
              : words.withUnit(setting.unit, typed)
          }
          // The digits sit on the side of their unit, under the field.
          className="w-full lg:w-64 [&_input]:text-end"
        />
      );
    }
    case "text":
      if (control.maxLength > LONG_TEXT) {
        return (
          <div className="flex w-full flex-col gap-1.5 lg:w-80">
            <Textarea
              {...aria}
              value={String(value ?? "")}
              onChange={(event) => onChange(event.target.value)}
              maxLength={control.maxLength}
              placeholder={words.fallback(setting)}
              aria-invalid={error ? true : undefined}
              // The one-line field's box: its radius, ground, padding and type.
              className="min-h-11 rounded-lg bg-background px-3.5 py-2.5 text-base md:text-base"
            />
            {error ? (
              <p role="alert" className="px-1 text-alert text-sm">
                {error}
              </p>
            ) : null}
          </div>
        );
      }
      return (
        <Input
          label={label}
          hideLabel
          value={String(value ?? "")}
          onChange={onChange}
          maxLength={control.maxLength}
          placeholder={words.fallback(setting)}
          error={error}
          className="w-full lg:w-80"
        />
      );
    case "list":
      return (
        <ListField
          label={label}
          items={value as string[]}
          onChange={onChange}
          error={error}
          // File extensions: Latin letters and digits, written without the dot.
          read={(typed, items) => {
            const item = toLatinDigits(
              typed.trim().toLowerCase().replace(/^\./, ""),
            );
            if (!item) return undefined;
            if (!/^[a-z0-9]{1,10}$/.test(item)) {
              return { problem: words.t("list.format") };
            }
            if (items.includes(item)) {
              return { problem: words.t("list.duplicate") };
            }
            return { item };
          }}
          words={{
            placeholder: words.t("list.placeholder"),
            add: words.t("list.add"),
            remove: (item) => words.t("list.remove", { item }),
          }}
          itemDir="ltr"
          className="lg:w-80"
        />
      );
  }
}

// A whole number typed in either set of digits, or undefined while the text is not one.
export function parseWhole(text: string) {
  const latin = toLatinDigits(text.trim());
  return /^\d{1,9}$/.test(latin) ? Number(latin) : undefined;
}

"use client";

import { Plus, X } from "lucide-react";
import { useId, useState } from "react";
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
import { toLatinDigits } from "@/platform/validation/digits";
import type { SettingView } from "./setting-view.ts";
import type { SettingWords } from "./use-setting-words.ts";

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
          className="w-full lg:w-64"
        />
      );
    }
    case "text":
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
          words={words}
        />
      );
  }
}

// A whole number typed in either set of digits, or undefined while the text is not one.
export function parseWhole(text: string) {
  const latin = toLatinDigits(text.trim());
  return /^\d{1,9}$/.test(latin) ? Number(latin) : undefined;
}

// A list of short codes, such as file extensions: each one a chip that can be removed, and a field
// that adds the next.
function ListField({
  label,
  items,
  onChange,
  error,
  words,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  error?: string;
  words: SettingWords;
}) {
  const [next, setNext] = useState("");
  const [problem, setProblem] = useState<string>();
  const listId = useId();

  const add = () => {
    const item = toLatinDigits(next.trim().toLowerCase().replace(/^\./, ""));
    if (!item) return;
    if (!/^[a-z0-9]{1,10}$/.test(item)) {
      setProblem(words.t("list.format"));
    } else if (items.includes(item)) {
      setProblem(words.t("list.duplicate"));
    } else {
      onChange([...items, item]);
      setNext("");
      setProblem(undefined);
    }
  };

  return (
    <div className="flex w-full flex-col gap-3 lg:w-80">
      {/* 12 px apart: each remove button's 44 px hit area stays clear of its neighbours'. */}
      <ul id={listId} aria-label={label} className="flex flex-wrap gap-3">
        {items.map((item) => (
          <li
            key={item}
            dir="ltr"
            className="inline-flex h-8 items-center gap-1 rounded-full border bg-muted ps-3 pe-1 font-medium text-sm"
          >
            {item}
            <button
              type="button"
              aria-label={words.t("list.remove", { item })}
              onClick={() => onChange(items.filter((other) => other !== item))}
              className="relative grid size-6 place-items-center rounded-full text-muted-foreground transition-colors after:absolute after:-inset-2.5 after:content-[''] hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <X aria-hidden className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <Input
        label={words.t("list.placeholder")}
        hideLabel
        aria-controls={listId}
        autoComplete="off"
        value={next}
        onChange={(text) => {
          setNext(text);
          setProblem(undefined);
        }}
        onKeyDown={(event) => {
          // Enter adds the item rather than saving the setting.
          if (event.key === "Enter") {
            event.preventDefault();
            add();
          }
        }}
        placeholder={words.t("list.placeholder")}
        error={problem ?? error}
        endSlot={
          <button type="button" aria-label={words.t("list.add")} onClick={add}>
            <Plus aria-hidden />
          </button>
        }
      />
    </div>
  );
}

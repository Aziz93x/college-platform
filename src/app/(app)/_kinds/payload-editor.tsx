"use client";

import { Plus, Trash2 } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { type ReactNode, useId, useState } from "react";
import { AdaptiveStepper } from "@/components/motion/adaptive-stepper";
import { Checkbox } from "@/components/motion/checkbox";
import { DateRangePickerDropdown } from "@/components/motion/date-range-picker";
import { Input } from "@/components/motion/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/motion/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useDateRangeWords } from "@/components/use-date-range-words";
import {
  type Catalogs,
  gradeBands,
  kindFields,
  type Payload,
  type PayloadField,
  payloadLimits,
  type TaskKind,
} from "@/modules/framework";
import { firstDayOfWeek } from "@/platform/i18n/language";
import { toLatinDigits } from "@/platform/validation/digits";
import { useBandWords } from "./band-words.ts";

type Band = { from: number; count: number };
type Session = { on: string; notes: string };

// A number typed in either digits, with a decimal point, Latin or Arabic, or a comma; undefined
// while it is not one.
function readNumber(text: string) {
  const latin = toLatinDigits(text.trim()).replace(/,/g, ".");
  return /^\d{1,6}(\.\d{1,2})?$/.test(latin) ? Number(latin) : undefined;
}

// What a task of a kind asks its trainer, drawn from the kind's fields (Step 18): the task card
// puts it before the evidence (Step 26). It holds the payload being filled; the service checks it
// with the kind's schema and the college's catalogs when it is saved.
export function PayloadEditor({
  kind,
  value,
  onChange,
  catalogs,
  today,
  weeks,
}: {
  kind: TaskKind;
  value: Payload;
  onChange: (value: Payload) => void;
  catalogs: Catalogs;
  /** The college's today, which the calendar marks. */
  today: string;
  /** The term's weeks, the most a week field counts to. */
  weeks: number;
}) {
  const fields: readonly PayloadField[] = kindFields[kind];
  const set = (name: string, field: unknown) =>
    onChange({ ...value, [name]: field });
  return (
    <div className="flex flex-col gap-4">
      {fields.map((field) => (
        <PayloadInput
          key={field.name}
          field={field}
          value={value[field.name]}
          onChange={(next) => set(field.name, next)}
          catalogs={catalogs}
          today={today}
          weeks={weeks}
        />
      ))}
    </div>
  );
}

function PayloadInput({
  field,
  value,
  onChange,
  catalogs,
  today,
  weeks,
}: {
  field: PayloadField;
  value: unknown;
  onChange: (value: unknown) => void;
  catalogs: Catalogs;
  today: string;
  weeks: number;
}) {
  const t = useTranslations("kinds");
  const format = useFormatter();
  const locale = useLocale();
  const id = useId();
  const label = t(`fields.${field.name}` as "fields.notes");
  const optional = "optional" in field && field.optional;
  const shown = optional ? t("optional", { label }) : label;
  const hint = t.has(`hints.${field.name}` as "hints.actions")
    ? t(`hints.${field.name}` as "hints.actions")
    : undefined;
  const dateWords = useDateRangeWords(label);
  const caption = (
    <span id={`${id}-label`} className="px-1 font-medium text-sm">
      {shown}
    </span>
  );
  const note = hint ? (
    <span id={`${id}-hint`} className="px-1 text-muted-foreground text-sm">
      {hint}
    </span>
  ) : null;
  const day = (chosen: string | undefined, choose: (day: string) => void) => (
    <DateRangePickerDropdown
      single
      closeOnSelect
      value={chosen ? { from: chosen, to: chosen } : null}
      onValueChange={(range) => choose(range?.from ?? "")}
      words={dateWords}
      locale={locale}
      weekStartsOn={firstDayOfWeek(locale)}
      today={today}
    />
  );

  switch (field.type) {
    case "line":
      return (
        <Input
          label={shown}
          autoComplete="off"
          maxLength={payloadLimits.line}
          value={String(value ?? "")}
          onChange={onChange}
        />
      );
    case "paragraph":
      return (
        <div className="flex flex-col gap-1.5">
          {caption}
          {note}
          <Textarea
            aria-labelledby={`${id}-label`}
            aria-describedby={hint ? `${id}-hint` : undefined}
            maxLength={payloadLimits.paragraph}
            value={String(value ?? "")}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      );
    case "day":
      return (
        <div className="flex flex-col gap-1.5">
          {caption}
          {day(value as string | undefined, onChange)}
        </div>
      );
    case "week":
      return (
        <div className="flex flex-col gap-1.5">
          {caption}
          <AdaptiveStepper
            aria-labelledby={`${id}-label`}
            value={Number(value ?? 1)}
            onValueChange={onChange}
            min={1}
            max={weeks}
            labels={{ decrease: t("fewer"), increase: t("more") }}
            formatValue={(week) => format.number(week)}
            formatValueText={(week) => t("week", { week })}
          />
        </div>
      );
    case "percent":
      return (
        <NumberField
          label={shown}
          value={value as number}
          onChange={onChange}
        />
      );
    case "check":
      return (
        <Checkbox
          label={label}
          checked={Boolean(value)}
          onCheckedChange={onChange}
        />
      );
    case "choice":
      return (
        <div className="flex flex-col gap-1.5">
          {caption}
          <Select
            aria-labelledby={`${id}-label`}
            value={String(value ?? "")}
            onValueChange={onChange}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("choose")} />
            </SelectTrigger>
            <SelectContent>
              {catalogs[field.catalog].map((word) => (
                <SelectItem key={word} value={word}>
                  {word}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    case "choices": {
      const chosen = (value as string[] | undefined) ?? [];
      return (
        <fieldset className="flex flex-col gap-2 px-1">
          <legend className="mb-1 font-medium text-sm">{label}</legend>
          {catalogs[field.catalog].map((word) => (
            <Checkbox
              key={word}
              label={word}
              checked={chosen.includes(word)}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? [...chosen, word]
                    : chosen.filter((each) => each !== word),
                )
              }
            />
          ))}
        </fieldset>
      );
    }
    case "bands":
      return (
        <BandsField
          label={label}
          hint={note}
          catalogs={catalogs}
          value={(value as Band[] | undefined) ?? []}
          onChange={onChange}
        />
      );
    case "sessions":
      return (
        <SessionsField
          label={label}
          hint={note}
          value={(value as Session[] | undefined) ?? []}
          onChange={onChange}
          day={day}
        />
      );
  }
}

// A percentage typed in either digits, kept as the number it stands for once it is one.
function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  const t = useTranslations("kinds");
  const [typed, setTyped] = useState(value === undefined ? "" : String(value));
  const read = readNumber(typed);
  return (
    <Input
      label={label}
      inputMode="decimal"
      autoComplete="off"
      value={typed}
      onChange={(text) => {
        setTyped(text);
        onChange(readNumber(text));
      }}
      error={typed.trim() && read === undefined ? t("notNumber") : undefined}
    />
  );
}

// The trainees in each of the college's grade bands, a count for each band.
function BandsField({
  label,
  hint,
  catalogs,
  value,
  onChange,
}: {
  label: string;
  hint: ReactNode;
  catalogs: Catalogs;
  value: Band[];
  onChange: (value: Band[]) => void;
}) {
  const bandWords = useBandWords();
  const bands = gradeBands(catalogs.gradeBands);
  const count = (from: number) =>
    value.find((band) => band.from === from)?.count;
  return (
    <fieldset className="flex flex-col gap-2 px-1">
      <legend className="mb-1 font-medium text-sm">{label}</legend>
      {hint}
      {bands.map((band) => (
        <CountField
          key={band.from}
          label={bandWords(band)}
          value={count(band.from)}
          onChange={(next) =>
            onChange(
              bands.map(({ from }) => ({
                from,
                count: from === band.from ? next : (count(from) ?? 0),
              })),
            )
          }
        />
      ))}
    </fieldset>
  );
}

// A count of trainees typed in either digits; none while the field is empty.
function CountField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number) => void;
}) {
  const [typed, setTyped] = useState(value === undefined ? "" : String(value));
  return (
    <Input
      label={label}
      inputMode="numeric"
      autoComplete="off"
      maxLength={String(payloadLimits.count).length}
      value={typed}
      onChange={(text) => {
        setTyped(text);
        const latin = toLatinDigits(text.trim());
        onChange(/^\d+$/.test(latin) ? Number(latin) : 0);
      }}
    />
  );
}

// Advising sessions, each a day and what it covered, added one at a time.
function SessionsField({
  label,
  hint,
  value,
  onChange,
  day,
}: {
  label: string;
  hint: ReactNode;
  value: Session[];
  onChange: (value: Session[]) => void;
  day: (chosen: string | undefined, choose: (day: string) => void) => ReactNode;
}) {
  const t = useTranslations("kinds");
  const id = useId();
  const change = (index: number, next: Partial<Session>) =>
    onChange(
      value.map((session, at) =>
        at === index ? { ...session, ...next } : session,
      ),
    );
  return (
    <fieldset className="flex flex-col gap-3 px-1">
      <legend className="mb-1 font-medium text-sm">{label}</legend>
      {hint}
      {value.map((session, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a session has no id until its task keeps it, so its place is its identity.
        <div key={index} className="flex flex-col gap-2 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <span id={`${id}-${index}`} className="font-medium text-sm">
              {t("session", { number: index + 1 })}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("removeSession", { number: index + 1 })}
              onClick={() => onChange(value.filter((_, at) => at !== index))}
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
          {day(session.on || undefined, (on) => change(index, { on }))}
          <Textarea
            aria-labelledby={`${id}-${index}`}
            aria-label={t("sessionNotes")}
            maxLength={payloadLimits.paragraph}
            value={session.notes}
            onChange={(event) => change(index, { notes: event.target.value })}
          />
        </div>
      ))}
      {value.length < payloadLimits.sessions ? (
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => onChange([...value, { on: "", notes: "" }])}
        >
          <Plus aria-hidden />
          {t("addSession")}
        </Button>
      ) : null}
    </fieldset>
  );
}

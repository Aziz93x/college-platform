"use client";

import { Plus, Trash2 } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { type ReactNode, useId, useState } from "react";
import { type ListEntry, ListField } from "@/components/list-field";
import { AdaptiveStepper } from "@/components/motion/adaptive-stepper";
import { Checkbox } from "@/components/motion/checkbox";
import { DateRangePickerDropdown } from "@/components/motion/date-range-picker";
import { Input } from "@/components/motion/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useDateRangeWords } from "@/components/use-date-range-words";
import type { Payload, PayloadField, PayloadLimits } from "@/modules/framework";
import { firstDayOfWeek } from "@/platform/i18n/language";
import { toLatinDigits } from "@/platform/validation/digits";
import { foldCase, oneLine } from "@/platform/validation/text";
import { useBandWords } from "./band-words.ts";

// A band as its trainer types it: its lower bound and its trainees, each missing until typed.
type Band = { from?: number; count?: number };
type Session = { on: string; notes: string };

// A number typed in either digits, with a decimal point, Latin or Arabic, or a comma; undefined
// while it is not one.
function readNumber(text: string) {
  const latin = toLatinDigits(text.trim()).replace(/,/g, ".");
  return /^\d{1,6}(\.\d{1,2})?$/.test(latin) ? Number(latin) : undefined;
}

// What a task asks its trainer, drawn from its kind's fields (Step 18): the task card puts it before
// the evidence (Step 26). It holds the payload being filled; the service checks it with the kind's
// schema when it is saved. The page passes the kind's fields (kindFields[kind]) and payloadLimits:
// a client component takes no value from a module, whose index brings its server code.
export function PayloadEditor({
  fields,
  limits,
  value,
  onChange,
  today,
  weeks,
}: {
  fields: readonly PayloadField[];
  limits: PayloadLimits;
  value: Payload;
  onChange: (value: Payload) => void;
  /** The college's today, which the calendar marks. */
  today: string;
  /** The term's weeks, the most a week field counts to. */
  weeks: number;
}) {
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
          limits={limits}
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
  limits,
  today,
  weeks,
}: {
  field: PayloadField;
  value: unknown;
  onChange: (value: unknown) => void;
  limits: PayloadLimits;
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
          hint={hint}
          autoComplete="off"
          maxLength={limits.line}
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
            maxLength={limits.paragraph}
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
    case "words":
      return (
        <div className="flex flex-col gap-1.5">
          {caption}
          {note}
          <WordsField
            label={label}
            limits={limits}
            value={(value as string[] | undefined) ?? []}
            onChange={onChange}
          />
        </div>
      );
    case "bands":
      return (
        <BandsField
          label={label}
          hint={note}
          limits={limits}
          value={(value as Band[] | undefined) ?? []}
          onChange={onChange}
        />
      );
    case "sessions":
      return (
        <SessionsField
          label={label}
          hint={note}
          limits={limits}
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

// Short entries the trainer writes one at a time, such as the training methods of a course, each
// once whatever its letters' case.
function WordsField({
  label,
  limits,
  value,
  onChange,
}: {
  label: string;
  limits: PayloadLimits;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const t = useTranslations("kinds");
  const read = (typed: string, items: string[]): ListEntry => {
    const word = oneLine(typed);
    if (!word) return undefined;
    if (word.length > limits.word) {
      return { problem: t("tooLong", { max: limits.word }) };
    }
    if (items.some((item) => foldCase(item) === foldCase(word))) {
      return { problem: t("duplicate") };
    }
    if (items.length >= limits.words) {
      return { problem: t("tooMany", { max: limits.words }) };
    }
    return { item: word };
  };
  return (
    <ListField
      label={label}
      items={value}
      onChange={onChange}
      read={read}
      words={{
        placeholder: t("entry"),
        add: t("add"),
        remove: (item) => t("remove", { item }),
      }}
    />
  );
}

// The trainees in each grade band of a section, the bands as its trainer gives them: each a lower
// bound in percent and its trainees, added one at a time. Each band reads from its bound to the
// next one up, the highest to 100.
function BandsField({
  label,
  hint,
  limits,
  value,
  onChange,
}: {
  label: string;
  hint: ReactNode;
  limits: PayloadLimits;
  value: Band[];
  onChange: (value: Band[]) => void;
}) {
  const t = useTranslations("kinds");
  const bandWords = useBandWords();
  const id = useId();
  const froms = value.flatMap(({ from }) => (from === undefined ? [] : [from]));
  const change = (index: number, next: Band) =>
    onChange(
      value.map((band, at) => (at === index ? { ...band, ...next } : band)),
    );
  return (
    <fieldset className="flex flex-col gap-3 px-1">
      <legend className="mb-1 font-medium text-sm">{label}</legend>
      {hint}
      {value.map((band, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a band has no id until its task keeps it, so its place is its identity.
        <div key={index} className="flex flex-col gap-2 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-sm">
              {band.from === undefined
                ? t("band", { number: index + 1 })
                : bandWords({
                    from: band.from,
                    to: Math.min(
                      100,
                      ...froms.filter((from) => from > (band.from ?? 0)),
                    ),
                  })}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("removeBand", { number: index + 1 })}
              onClick={() => onChange(value.filter((_, at) => at !== index))}
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
          <div id={`${id}-${index}`} className="grid gap-2 sm:grid-cols-2">
            <CountField
              label={t("bandFrom")}
              digits={2}
              value={band.from}
              onChange={(from) => change(index, { from })}
            />
            <CountField
              label={t("bandTrainees")}
              digits={String(limits.count).length}
              value={band.count}
              onChange={(count) => change(index, { count })}
            />
          </div>
        </div>
      ))}
      {value.length < limits.bands ? (
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => onChange([...value, {}])}
        >
          <Plus aria-hidden />
          {t("addBand")}
        </Button>
      ) : null}
    </fieldset>
  );
}

// A whole number typed in either digits; none while the field is empty or holds something else.
function CountField({
  label,
  digits,
  value,
  onChange,
}: {
  label: string;
  /** The most digits the number may have. */
  digits: number;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  const [typed, setTyped] = useState(value === undefined ? "" : String(value));
  return (
    <Input
      label={label}
      inputMode="numeric"
      autoComplete="off"
      maxLength={digits}
      value={typed}
      onChange={(text) => {
        setTyped(text);
        const latin = toLatinDigits(text.trim());
        onChange(/^\d+$/.test(latin) ? Number(latin) : undefined);
      }}
    />
  );
}

// Advising sessions, each a day and what it covered, added one at a time.
function SessionsField({
  label,
  hint,
  limits,
  value,
  onChange,
  day,
}: {
  label: string;
  hint: ReactNode;
  limits: PayloadLimits;
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
            maxLength={limits.paragraph}
            value={session.notes}
            onChange={(event) => change(index, { notes: event.target.value })}
          />
        </div>
      ))}
      {value.length < limits.sessions ? (
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

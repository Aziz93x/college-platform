"use client";

import { ListPlus, LoaderCircle, Save } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { ActionSwapButton } from "@/components/motion/action-swap";
import { AdaptiveStepper } from "@/components/motion/adaptive-stepper";
import { BottomSheet } from "@/components/motion/bottom-sheet";
import { Checkbox } from "@/components/motion/checkbox";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/motion/combobox";
import { Input } from "@/components/motion/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/motion/select";
import { Switch } from "@/components/motion/switch";
import { Button } from "@/components/ui/button";
import type {
  AssignmentItemInput,
  DueRule,
  PlanItemInput,
  TaskKind,
} from "@/modules/framework";

// An item of the framework (Step 15), or of a department's plan (Step 19), which may also reach one
// person of the department.
export type ItemInput = PlanItemInput;

// An assignment template's item as the sheet holds it (Step 21): the fields the sheet hides for it
// keep their defaults, and its page keeps only its title, kind and evidence.
export const sheetItemOf = (item: AssignmentItemInput): ItemInput => ({
  ...item,
  axisId: "",
  appliesTo: { type: "eachSection" },
  due: { type: "weekly" },
  notes: "",
});

type Option = { value: string; label: string };

// The choices the sheet offers, as the page words them: the roles an item may reach, and on a
// department's plan the people of the department, each found by name or employee number.
export type ItemOptions = {
  axes: Option[];
  kinds: Option[];
  roles?: Option[];
  people?: (Option & { employeeNumber: string })[];
  /** The college's types of exam period, which a rule is anchored to, and before or after them. */
  periodTypes: Option[];
  sides: Option[];
  evidenceTypes: Option[];
  dueTypes: Option[];
};

export type ItemLimits = {
  title: number;
  notes: number;
  weeks: number;
  files: number;
};

type Draft = {
  title: string;
  axisId: string;
  kind: TaskKind;
  applies: string;
  person: string;
  dueType: DueRule["type"];
  week: number;
  every: number;
  periodTypes: string[];
  side: string;
  offset: number;
  required: boolean;
  types: string[];
  maxFiles: number;
  approval: boolean;
  notes: string;
};

const EACH_SECTION = "eachSection";
const EACH_COURSE = "eachCourse";
const PERSON = "person";

export const draftOf = (
  item: ItemInput | undefined,
  options: ItemOptions,
): Draft => ({
  title: item?.title ?? "",
  axisId: item?.axisId ?? options.axes[0]?.value ?? "",
  kind: item?.kind ?? (options.kinds[0]?.value as TaskKind),
  // A new item reaches each section's trainer, as most of the framework's do (lead review C).
  applies: !item
    ? EACH_SECTION
    : "roleId" in item.appliesTo
      ? item.appliesTo.roleId
      : item.appliesTo.type,
  person: item?.appliesTo.type === "person" ? item.appliesTo.userId : "",
  dueType: item?.due.type ?? "week",
  week: item?.due.type === "week" ? item.due.week : 1,
  every: item?.due.type === "everyWeeks" ? item.due.every : 2,
  // A new rule anchored to exam periods is due a week before every one of them, as the owner's canvas
  // starts it (21 October 2026).
  periodTypes:
    item?.due.type === "examPeriods"
      ? item.due.periodTypes
      : options.periodTypes.map(({ value }) => value),
  side: item?.due.type === "examPeriods" ? item.due.side : "before",
  offset: item?.due.type === "examPeriods" ? item.due.weeks : 1,
  required: item?.evidence.required ?? true,
  // Only the types the college still accepts: one it no longer offers cannot be unticked.
  types: item
    ? item.evidence.types.filter((type) =>
        options.evidenceTypes.some(({ value }) => value === type),
      )
    : options.evidenceTypes.slice(0, 1).map(({ value }) => value),
  maxFiles: item?.evidence.maxFiles ?? 1,
  approval: item?.evidence.requiresApproval ?? false,
  notes: item?.notes ?? "",
});

const inputOf = (draft: Draft): ItemInput => ({
  title: draft.title,
  axisId: draft.axisId,
  kind: draft.kind,
  appliesTo:
    draft.applies === EACH_SECTION || draft.applies === EACH_COURSE
      ? { type: draft.applies }
      : draft.applies === PERSON
        ? { type: "person", userId: draft.person }
        : { type: "role", roleId: draft.applies },
  due:
    draft.dueType === "week"
      ? { type: "week", week: draft.week }
      : draft.dueType === "everyWeeks"
        ? { type: "everyWeeks", every: draft.every }
        : draft.dueType === "examPeriods"
          ? {
              type: "examPeriods",
              periodTypes: draft.periodTypes,
              side: draft.side === "after" ? "after" : "before",
              weeks: draft.offset,
            }
          : { type: "weekly" },
  evidence: {
    required: draft.required,
    types: draft.types,
    maxFiles: draft.maxFiles,
    requiresApproval: draft.approval,
  },
  notes: draft.notes,
});

// An item's fields in a sheet, added or corrected: its title, axis and kind, whom it reaches, when
// it is due, and the evidence it asks for. The page saves what it gives, and says what the server
// refused. A new item may be saved with the sheet kept open for the next one (Step 19): once the page
// has saved it, it gives a new resetKey, and the sheet keeps every field but the title and the notes.
// An assignment template's item shows its title, kind and evidence alone: its template gives its
// axis and whom it reaches, and it is due at the assignment's end (Step 21).
export function ItemSheet({
  title,
  description,
  item,
  assignment = false,
  options,
  limits,
  saving,
  error,
  onSave,
  onSaveAndAdd,
  resetKey,
  onClose,
}: {
  title: string;
  description: string;
  /** The item to correct; none for a new one. */
  item?: ItemInput;
  assignment?: boolean;
  options: ItemOptions;
  limits: ItemLimits;
  saving: boolean;
  error?: string;
  onSave: (input: ItemInput) => void;
  /** Saves a new item and keeps the sheet open for the next. */
  onSaveAndAdd?: (input: ItemInput) => void;
  resetKey?: number;
  onClose: () => void;
}) {
  const t = useTranslations("framework");
  const ui = useTranslations("ui");
  const format = useFormatter();
  const id = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Draft>(() => draftOf(item, options));
  const [problem, setProblem] = useState<string>();

  // The next item starts where the last left off, but for its words.
  const reset = useRef(resetKey);
  useEffect(() => {
    if (resetKey === reset.current) return;
    reset.current = resetKey;
    setForm((current) => ({ ...current, title: "", notes: "" }));
    titleRef.current?.focus();
  }, [resetKey]);

  const change = (next: Partial<Draft>) =>
    setForm((current) => ({ ...current, ...next }));
  const save = (then: (input: ItemInput) => void) => {
    if (!form.title.trim()) return setProblem(t("titleRequired"));
    if (form.applies === PERSON && !form.person) {
      return setProblem(t("personRequired"));
    }
    if (form.types.length === 0) return setProblem(t("typesRequired"));
    if (form.dueType === "examPeriods" && form.periodTypes.length === 0) {
      return setProblem(t("periodsRequired"));
    }
    setProblem(undefined);
    then(inputOf(form));
  };

  const number = (value: number) => format.number(value);
  const stepper = (
    name: "week" | "every" | "offset" | "maxFiles",
    min: number,
    max: number,
  ) => (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-${name}`} className="px-1 font-medium text-sm">
        {t(`fields.${name}`)}
      </span>
      <AdaptiveStepper
        aria-labelledby={`${id}-${name}`}
        value={form[name]}
        onValueChange={(value) => change({ [name]: value })}
        min={min}
        max={max}
        labels={{ decrease: t("fewer"), increase: t("more") }}
        formatValue={number}
        formatValueText={(count) => t("count", { count })}
      />
    </div>
  );
  const select = (
    name: "axisId" | "kind" | "applies" | "dueType" | "side",
    label: string,
    choices: Option[],
  ) => (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-${name}`} className="px-1 font-medium text-sm">
        {label}
      </span>
      <Select
        aria-labelledby={`${id}-${name}`}
        value={form[name]}
        onValueChange={(value) => change({ [name]: value } as Partial<Draft>)}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {choices.map((choice) => (
            <SelectItem key={choice.value} value={choice.value}>
              {choice.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
  const toggle = (name: "required" | "approval") => (
    <div className="flex items-center justify-between gap-3 px-1">
      <span id={`${id}-${name}`} className="font-medium text-sm">
        {t(`fields.${name}`)}
      </span>
      <Switch
        aria-labelledby={`${id}-${name}`}
        checked={form[name]}
        onCheckedChange={(checked) => change({ [name]: checked })}
      />
    </div>
  );
  const shown = problem ?? error;

  return (
    <BottomSheet
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      snapPoints={["auto"]}
      title={title}
      description={description}
      closeLabel={ui("close")}
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          save(onSave);
        }}
        className="flex flex-col gap-4 pt-2 pb-2"
      >
        <Input
          ref={titleRef}
          label={t("fields.title")}
          autoComplete="off"
          maxLength={limits.title}
          value={form.title}
          onChange={(title) => change({ title })}
        />
        {assignment ? null : select("axisId", t("fields.axis"), options.axes)}
        {select("kind", t("fields.kind"), options.kinds)}
        {assignment
          ? null
          : select("applies", t("fields.appliesTo"), [
              { value: EACH_SECTION, label: t("eachSection") },
              { value: EACH_COURSE, label: t("eachCourse") },
              ...(options.roles ?? []),
              ...(options.people
                ? [{ value: PERSON, label: t("person") }]
                : []),
            ])}
        {!assignment && form.applies === PERSON && options.people ? (
          <Combobox
            value={form.person}
            onValueChange={(person) => change({ person })}
          >
            <ComboboxLabel>{t("fields.person")}</ComboboxLabel>
            <ComboboxTrigger>
              <ComboboxInput placeholder={t("personPlaceholder")} />
            </ComboboxTrigger>
            <ComboboxContent>
              <ComboboxList aria-label={t("fields.person")}>
                {options.people.map((person) => (
                  <ComboboxItem
                    key={person.value}
                    value={person.value}
                    textValue={person.label}
                    keywords={[person.employeeNumber]}
                  >
                    <span className="block truncate">{person.label}</span>
                    <span dir="ltr" className="text-muted-foreground text-xs">
                      {person.employeeNumber}
                    </span>
                  </ComboboxItem>
                ))}
              </ComboboxList>
              <ComboboxEmpty>{t("noPerson")}</ComboboxEmpty>
            </ComboboxContent>
          </Combobox>
        ) : null}
        {assignment
          ? null
          : select("dueType", t("fields.due"), options.dueTypes)}
        {!assignment && form.dueType === "week"
          ? stepper("week", 1, limits.weeks)
          : null}
        {!assignment && form.dueType === "everyWeeks"
          ? stepper("every", 2, limits.weeks)
          : null}
        {!assignment && form.dueType === "examPeriods" ? (
          <>
            <fieldset className="flex flex-col gap-2 px-1">
              <legend className="mb-1 font-medium text-sm">
                {t("fields.periodTypes")}
              </legend>
              {options.periodTypes.map((type) => (
                <Checkbox
                  key={type.value}
                  label={type.label}
                  checked={form.periodTypes.includes(type.value)}
                  // In the catalog's order, whatever order they are ticked in.
                  onCheckedChange={(checked) =>
                    change({
                      periodTypes: options.periodTypes
                        .map(({ value }) => value)
                        .filter((value) =>
                          value === type.value
                            ? checked
                            : form.periodTypes.includes(value),
                        ),
                    })
                  }
                />
              ))}
            </fieldset>
            {select("side", t("fields.side"), options.sides)}
            {stepper("offset", 0, limits.weeks)}
            <p className="px-1 text-muted-foreground text-sm">
              {t("dueDayHint")}
            </p>
          </>
        ) : null}
        {toggle("required")}
        <fieldset className="flex flex-col gap-2 px-1">
          <legend className="mb-1 font-medium text-sm">
            {t("fields.types")}
          </legend>
          {options.evidenceTypes.map((type) => (
            <Checkbox
              key={type.value}
              label={type.label}
              checked={form.types.includes(type.value)}
              onCheckedChange={(checked) =>
                change({
                  types: checked
                    ? [...form.types, type.value]
                    : form.types.filter((each) => each !== type.value),
                })
              }
            />
          ))}
        </fieldset>
        {stepper("maxFiles", 1, limits.files)}
        {toggle("approval")}
        {assignment ? null : (
          <Input
            label={t("fields.notes")}
            autoComplete="off"
            maxLength={limits.notes}
            value={form.notes}
            onChange={(notes) => change({ notes })}
          />
        )}
        {shown ? (
          <p role="alert" className="text-alert text-sm">
            {shown}
          </p>
        ) : null}
        {/* At the sheet's foot, under all its fields, so Save is in reach as the sheet opens and
            after each "save and add another" (UX review 2). */}
        <div className="sticky -bottom-6 z-10 -mx-4 -mb-8 flex flex-wrap items-center gap-2 border-t bg-background px-4 pt-3 pb-6">
          <ActionSwapButton
            type="submit"
            disabled={saving}
            value={saving ? "saving" : "save"}
            items={[
              { id: "save", label: t("save"), icon: <Save /> },
              {
                id: "saving",
                label: t("saving"),
                icon: <LoaderCircle className="animate-spin" />,
              },
            ]}
          />
          {onSaveAndAdd ? (
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => save(onSaveAndAdd)}
            >
              <ListPlus aria-hidden />
              {t("saveAndAdd")}
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={onClose}>
            {ui("cancel")}
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}

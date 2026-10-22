"use client";

import { LoaderCircle, Save } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { ActionSwapButton } from "@/components/motion/action-swap";
import { AdaptiveStepper } from "@/components/motion/adaptive-stepper";
import { BottomSheet } from "@/components/motion/bottom-sheet";
import { Checkbox } from "@/components/motion/checkbox";
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
  DueRule,
  FrameworkItemInput,
  SectionTemplateInput,
  TaskKind,
} from "@/modules/framework";

// An item of the framework (Step 15), or a section template (Step 18), which has no say in whom it
// reaches: each section's trainer of its department.
export type ItemInput = SectionTemplateInput & {
  appliesTo?: FrameworkItemInput["appliesTo"];
};

type Option = { value: string; label: string };

// The choices the sheet offers, as the page words them. Without roles, it does not ask whom the
// item reaches.
export type ItemOptions = {
  axes: Option[];
  kinds: Option[];
  roles?: Option[];
  eventKinds: Option[];
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
  dueType: DueRule["type"];
  week: number;
  every: number;
  eventKind: string;
  after: number;
  required: boolean;
  types: string[];
  maxFiles: number;
  approval: boolean;
  notes: string;
};

const EACH_SECTION = "eachSection";

export const draftOf = (
  item: ItemInput | undefined,
  options: ItemOptions,
): Draft => ({
  title: item?.title ?? "",
  axisId: item?.axisId ?? options.axes[0]?.value ?? "",
  kind: item?.kind ?? (options.kinds[0]?.value as TaskKind),
  // A new item reaches each section's trainer, as most of the framework's do (lead review C).
  applies:
    !item?.appliesTo || item.appliesTo.type === "eachSection"
      ? EACH_SECTION
      : item.appliesTo.roleId,
  dueType: item?.due.type ?? "week",
  week: item?.due.type === "week" ? item.due.week : 1,
  every: item?.due.type === "everyWeeks" ? item.due.every : 2,
  eventKind:
    item?.due.type === "afterEvent"
      ? item.due.eventKind
      : (options.eventKinds[0]?.value ?? ""),
  after: item?.due.type === "afterEvent" ? item.due.weeks : 1,
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

const inputOf = (draft: Draft, reach: boolean): ItemInput => ({
  title: draft.title,
  axisId: draft.axisId,
  kind: draft.kind,
  ...(reach && {
    appliesTo:
      draft.applies === EACH_SECTION
        ? { type: "eachSection" as const }
        : { type: "role" as const, roleId: draft.applies },
  }),
  due:
    draft.dueType === "week"
      ? { type: "week", week: draft.week }
      : draft.dueType === "everyWeeks"
        ? { type: "everyWeeks", every: draft.every }
        : draft.dueType === "afterEvent"
          ? {
              type: "afterEvent",
              eventKind: draft.eventKind,
              weeks: draft.after,
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

// An item's fields in a sheet, added or corrected: its title, axis and kind, whom it reaches where
// the page asks, when it is due, and the evidence it asks for. The page saves what it gives, and
// says what the server refused.
export function ItemSheet({
  title,
  description,
  item,
  options,
  limits,
  saving,
  error,
  onSave,
  onClose,
}: {
  title: string;
  description: string;
  /** The item to correct; none for a new one. */
  item?: ItemInput;
  options: ItemOptions;
  limits: ItemLimits;
  saving: boolean;
  error?: string;
  onSave: (input: ItemInput) => void;
  onClose: () => void;
}) {
  const t = useTranslations("framework");
  const ui = useTranslations("ui");
  const format = useFormatter();
  const id = useId();
  const [form, setForm] = useState<Draft>(() => draftOf(item, options));
  const [problem, setProblem] = useState<string>();

  const change = (next: Partial<Draft>) =>
    setForm((current) => ({ ...current, ...next }));
  const save = () => {
    if (!form.title.trim()) return setProblem(t("titleRequired"));
    if (form.types.length === 0) return setProblem(t("typesRequired"));
    setProblem(undefined);
    onSave(inputOf(form, Boolean(options.roles)));
  };

  const number = (value: number) => format.number(value);
  const stepper = (
    name: "week" | "every" | "after" | "maxFiles",
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
    name: "axisId" | "kind" | "applies" | "dueType" | "eventKind",
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
          save();
        }}
        className="flex flex-col gap-4 pt-2 pb-2"
      >
        <Input
          label={t("fields.title")}
          autoComplete="off"
          maxLength={limits.title}
          value={form.title}
          onChange={(title) => change({ title })}
        />
        {select("axisId", t("fields.axis"), options.axes)}
        {select("kind", t("fields.kind"), options.kinds)}
        {options.roles
          ? select("applies", t("fields.appliesTo"), [
              { value: EACH_SECTION, label: t("eachSection") },
              ...options.roles,
            ])
          : null}
        {select("dueType", t("fields.due"), options.dueTypes)}
        {form.dueType === "week" ? stepper("week", 1, limits.weeks) : null}
        {form.dueType === "everyWeeks"
          ? stepper("every", 2, limits.weeks)
          : null}
        {form.dueType === "afterEvent" ? (
          <>
            {select("eventKind", t("fields.event"), options.eventKinds)}
            {stepper("after", 0, limits.weeks)}
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
        <Input
          label={t("fields.notes")}
          autoComplete="off"
          maxLength={limits.notes}
          value={form.notes}
          onChange={(notes) => change({ notes })}
        />
        {shown ? (
          <p role="alert" className="text-alert text-sm">
            {shown}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
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
          <Button type="button" variant="ghost" onClick={onClose}>
            {ui("cancel")}
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}

"use client";

import {
  BadgeCheck,
  FilePlus2,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
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
  TaskKind,
} from "@/modules/framework";
import {
  addItemAction,
  endorseDraftAction,
  publishDraftAction,
  removeItemAction,
  startDraftAction,
  updateItemAction,
} from "./actions.ts";

export type ItemView = FrameworkItemInput & {
  id: string;
  /** The item in words, as the page writes it. */
  words: {
    axis: string;
    kind: string;
    appliesTo: string;
    due: string;
    evidence: string;
  };
};

type Option = { value: string; label: string };

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
  item: FrameworkItemInput | undefined,
  options: Options,
): Draft => ({
  title: item?.title ?? "",
  axisId: item?.axisId ?? options.axes[0]?.value ?? "",
  kind: item?.kind ?? (options.kinds[0]?.value as TaskKind),
  // A new item reaches each section's trainer, as most of the framework's do (lead review C).
  applies: !item
    ? EACH_SECTION
    : item.appliesTo.type === "eachSection"
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

const inputOf = (draft: Draft): FrameworkItemInput => ({
  title: draft.title,
  axisId: draft.axisId,
  kind: draft.kind,
  appliesTo:
    draft.applies === EACH_SECTION
      ? { type: "eachSection" }
      : { type: "role", roleId: draft.applies },
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

type Options = {
  axes: Option[];
  kinds: Option[];
  roles: Option[];
  eventKinds: Option[];
  evidenceTypes: Option[];
  dueTypes: Option[];
};

// The term's framework as it is prepared (Step 15): the draft's items, added and corrected in a
// sheet, the dean's endorsement where the college asks for it, and its publication, with the tasks
// it would create. Without a draft, the one who prepares it starts the next version.
export function FrameworkDraft({
  termId,
  draft,
  hasPublished,
  manage,
  endorse,
  needsEndorsement,
  impact,
  options,
  limits,
}: {
  termId: string;
  draft?: { id: string; version: number; endorsed: boolean; items: ItemView[] };
  hasPublished: boolean;
  manage: boolean;
  endorse: boolean;
  needsEndorsement: boolean;
  /** The tasks the draft would create, in words. */
  impact?: string;
  options: Options;
  limits: { title: number; notes: number; weeks: number; files: number };
}) {
  const t = useTranslations("framework");
  const ui = useTranslations("ui");
  const refusals = useTranslations("actions");
  const format = useFormatter();
  const id = useId();
  const [editing, setEditing] = useState<ItemView | "new">();
  const [form, setForm] = useState<Draft>(() => draftOf(undefined, options));
  const [error, setError] = useState<string>();
  const [running, setRunning] = useState<string>();
  const [publishing, setPublishing] = useState(false);
  const [, startTransition] = useTransition();

  const change = (next: Partial<Draft>) =>
    setForm((current) => ({ ...current, ...next }));
  const refused = (status: string | undefined, serverError?: string) =>
    status && status in REFUSALS
      ? t(`refusals.${status as keyof typeof REFUSALS}`)
      : refusals(
          (serverError ?? "unexpected") as Parameters<typeof refusals>[0],
        );

  // Runs an action, with its button busy, and says how it went.
  const run = (
    key: string,
    action: () => Promise<
      { data?: { status: string }; serverError?: string } | undefined
    >,
    done: Record<string, () => void>,
  ) =>
    startTransition(async () => {
      setRunning(key);
      setError(undefined);
      const result = await action();
      setRunning(undefined);
      const status = result?.data?.status;
      if (status && status in done) done[status]();
      else setError(refused(status, result?.serverError));
    });

  const open = (item: ItemView | "new") => {
    setEditing(item);
    setForm(draftOf(item === "new" ? undefined : item, options));
    setError(undefined);
  };

  const save = () => {
    const current = editing;
    if (!current || !draft) return;
    if (!form.title.trim()) return setError(t("titleRequired"));
    if (form.types.length === 0) return setError(t("typesRequired"));
    const input = inputOf(form);
    const closed = () => {
      toast.success(t("saved"));
      setEditing(undefined);
    };
    run(
      "save",
      () =>
        current === "new"
          ? addItemAction({ draftId: draft.id, ...input })
          : updateItemAction({ itemId: current.id, ...input }),
      { saved: closed, unchanged: closed },
    );
  };

  const number = (value: number) => format.number(value);
  const stepper = (
    name: "week" | "every" | "after" | "maxFiles",
    min: number,
    max: number,
  ) => (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-${name}`} className="px-1 font-medium text-sm">
        {t(`fields.${name === "maxFiles" ? "maxFiles" : name}`)}
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

  if (!draft) {
    if (!manage) return null;
    return (
      <div className="flex">
        <Button
          type="button"
          disabled={running === "start"}
          onClick={() =>
            run("start", () => startDraftAction({ termId }), {
              created: () => undefined,
              exists: () => undefined,
            })
          }
        >
          {running === "start" ? (
            <LoaderCircle aria-hidden className="animate-spin" />
          ) : (
            <FilePlus2 aria-hidden />
          )}
          {hasPublished ? t("newVersion") : t("empty.action")}
        </Button>
        {error ? (
          <p role="alert" className="ms-3 self-center text-alert text-sm">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="rounded-xl border bg-card shadow-xs"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="font-medium text-base">
            {t("draft", { version: draft.version })}
          </h2>
          <p className="mt-1 max-w-prose text-pretty text-muted-foreground text-sm">
            {t("draftDescription")}
          </p>
          {needsEndorsement ? (
            <p className="mt-2 flex items-center gap-1.5 text-sm">
              {draft.endorsed ? (
                <>
                  <BadgeCheck aria-hidden className="size-4" />
                  {t("endorsedBadge")}
                </>
              ) : (
                t("awaiting")
              )}
            </p>
          ) : null}
        </div>
        {manage ? (
          <Button type="button" variant="outline" onClick={() => open("new")}>
            <Plus aria-hidden />
            {t("add")}
          </Button>
        ) : null}
      </div>
      {draft.items.length > 0 ? (
        <ol
          aria-label={t("draft", { version: draft.version })}
          className="mt-4 divide-y border-t"
        >
          {draft.items.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 px-5 py-3 sm:px-6"
            >
              <ItemWords item={item} />
              {manage ? (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("edit", { title: item.title })}
                    onClick={() => open(item)}
                  >
                    <Pencil aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("remove", { title: item.title })}
                    disabled={running === item.id}
                    onClick={() =>
                      run(
                        item.id,
                        () => removeItemAction({ itemId: item.id }),
                        {
                          saved: () => toast.success(t("removed")),
                        },
                      )
                    }
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-5 pt-3 text-muted-foreground text-sm sm:px-6">
          {t("noItems")}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 px-5 py-4 sm:px-6">
        {manage ? (
          <Button
            type="button"
            disabled={draft.items.length === 0}
            onClick={() => {
              setError(undefined);
              setPublishing(true);
            }}
          >
            <Send aria-hidden />
            {t("publish")}
          </Button>
        ) : null}
        {endorse &&
        needsEndorsement &&
        !draft.endorsed &&
        draft.items.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            disabled={running === "endorse"}
            onClick={() =>
              run("endorse", () => endorseDraftAction({ draftId: draft.id }), {
                endorsed: () => toast.success(t("endorsedToast")),
                unchanged: () => undefined,
              })
            }
          >
            <BadgeCheck aria-hidden />
            {t("endorse")}
          </Button>
        ) : null}
        {error && !editing && !publishing ? (
          <p role="alert" className="text-alert text-sm">
            {error}
          </p>
        ) : null}
      </div>

      {publishing ? (
        <BottomSheet
          open
          onOpenChange={(next) => {
            if (!next) setPublishing(false);
          }}
          snapPoints={["auto"]}
          title={t("publishTitle", { version: draft.version })}
          description={t("publishDescription")}
          closeLabel={ui("close")}
        >
          <div className="flex flex-col gap-4 pt-2 pb-2">
            {impact ? <p className="font-medium text-sm">{impact}</p> : null}
            {needsEndorsement && !draft.endorsed ? (
              <p className="text-sm">{t("awaiting")}</p>
            ) : null}
            {error ? (
              <p role="alert" className="text-alert text-sm">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                disabled={
                  running === "publish" || (needsEndorsement && !draft.endorsed)
                }
                onClick={() =>
                  run(
                    "publish",
                    () => publishDraftAction({ draftId: draft.id }),
                    {
                      published: () => {
                        toast.success(
                          t("publishedToast", { version: draft.version }),
                        );
                        setPublishing(false);
                      },
                    },
                  )
                }
              >
                {running === "publish" ? (
                  <LoaderCircle aria-hidden className="animate-spin" />
                ) : (
                  <Send aria-hidden />
                )}
                {t("publishConfirm")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPublishing(false)}
              >
                {ui("cancel")}
              </Button>
            </div>
          </div>
        </BottomSheet>
      ) : null}

      {editing ? (
        <BottomSheet
          open
          onOpenChange={(next) => {
            if (!next) setEditing(undefined);
          }}
          snapPoints={["auto"]}
          title={editing === "new" ? t("addTitle") : t("editTitle")}
          description={t("sheetDescription")}
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
            {select("applies", t("fields.appliesTo"), [
              { value: EACH_SECTION, label: t("eachSection") },
              ...options.roles,
            ])}
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
            {error ? (
              <p role="alert" className="text-alert text-sm">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <ActionSwapButton
                type="submit"
                disabled={running === "save"}
                value={running === "save" ? "saving" : "save"}
                items={[
                  { id: "save", label: t("save"), icon: <Save /> },
                  {
                    id: "saving",
                    label: t("saving"),
                    icon: <LoaderCircle className="animate-spin" />,
                  },
                ]}
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditing(undefined)}
              >
                {ui("cancel")}
              </Button>
            </div>
          </form>
        </BottomSheet>
      ) : null}
    </section>
  );
}

// The refusals the domain names, worded on the page.
const REFUSALS = {
  notDraft: true,
  empty: true,
  notEndorsed: true,
  closed: true,
  notFound: true,
  notOffered: true,
} as const;

// An item in words: its title, then its axis and kind, whom it reaches and when, and its evidence.
export function ItemWords({
  item,
}: {
  item: Pick<ItemView, "title" | "notes" | "words">;
}) {
  return (
    <div className="min-w-0">
      <p className="font-medium text-sm">{item.title}</p>
      <p className="mt-0.5 text-muted-foreground text-sm">
        {item.words.axis} · {item.words.kind}
      </p>
      <p className="text-sm">
        {item.words.appliesTo} · {item.words.due}
      </p>
      <p className="text-muted-foreground text-sm">{item.words.evidence}</p>
      {item.notes ? <p className="mt-0.5 text-sm">{item.notes}</p> : null}
    </div>
  );
}

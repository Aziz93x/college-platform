"use client";

import {
  ChevronLeft,
  ChevronRight,
  CopyPlus,
  FilePlus2,
  LoaderCircle,
  Plus,
  Send,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { BottomSheet } from "@/components/motion/bottom-sheet";
import { Button } from "@/components/ui/button";
import {
  type ItemInput,
  type ItemLimits,
  type ItemOptions,
  ItemSheet,
} from "../_items/item-sheet.tsx";
import { Versions } from "../_items/versions.tsx";
import {
  addPlanItemAction,
  movePlanItemsAction,
  publishPlanAction,
  removePlanItemsAction,
  startPlanAction,
  updatePlanItemAction,
} from "./actions.ts";
import { flagged } from "./plan-flags.tsx";
import { PlanGrid } from "./plan-grid.tsx";
import { type Move, movable, type Period, type PlanItem } from "./plan-item.ts";
import { PlanList } from "./plan-list.tsx";

export type { PlanItem } from "./plan-item.ts";

// The refusals the services name, worded on the page.
const REFUSALS = {
  notFound: true,
  notDraft: true,
  closed: true,
  notOffered: true,
  empty: true,
  notMovable: true,
} as const;

type Result =
  | {
      data?: {
        status: string;
        landing?: { weeks: number[]; outside: number };
      };
      serverError?: string;
    }
  | undefined;

// A department's plan for the term (Step 19): its draft, by weeks on a wide screen and as a list by
// week on a phone, its items added and corrected in the framework's sheet, moved by week and taken
// out, one or several at once; its publication, with the tasks it makes and the reviews a week it
// asks; the version published, read-only, until a next one is started; its first version started
// empty or from the previous term's plan; and its versions.
export function PlanEditor({
  termId,
  departmentId,
  weeks,
  periods,
  draft,
  published,
  framework,
  frameworkPublished,
  versions,
  editable,
  edits,
  publishes,
  previous,
  preview,
  untaught,
  options,
  limits,
}: {
  termId: string;
  departmentId: string;
  weeks: number;
  periods: Period[];
  draft?: { id: string; version: number; items: PlanItem[] };
  published?: { version: number; date: string; items: PlanItem[] };
  framework: PlanItem[];
  frameworkPublished: boolean;
  versions: { version: number; words: string }[];
  /** Whether the term is still open, so that the plan changes. */
  editable: boolean;
  /** Whether the viewer starts and fills the department's plan (plan.edit). */
  edits: boolean;
  /** Whether the viewer publishes the department's plan (plan.publish). */
  publishes: boolean;
  /** The previous term's plan, offered while the department has none in this term. */
  previous?: { termId: string; words: string };
  /** The draft's tasks and reviews a week, in words. */
  preview?: { impact: string; reviews: string };
  /** Whether the department has no sections' trainers in SS01 yet. */
  untaught: boolean;
  options: ItemOptions;
  limits: ItemLimits;
}) {
  const t = useTranslations("plan");
  const ui = useTranslations("ui");
  const refusals = useTranslations("actions");
  const format = useFormatter();
  const id = useId();
  const [editing, setEditing] = useState<PlanItem | "new">();
  const [resetKey, setResetKey] = useState(0);
  const [error, setError] = useState<string>();
  const [running, setRunning] = useState<string>();
  const [publishing, setPublishing] = useState(false);
  const [removing, setRemoving] = useState<string[]>();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [announced, setAnnounced] = useState("");
  const [, startTransition] = useTransition();

  // The items on view, each moved at once to the week it was moved to until the page is drawn again.
  const [items, moved] = useOptimistic(
    draft?.items ?? published?.items ?? [],
    (current: PlanItem[], moves: Move[]) =>
      current.map((item) => {
        const move = moves.find(({ itemId }) => itemId === item.id);
        return move
          ? {
              ...item,
              due: { type: "week" as const, week: move.week },
              weeks: move.week <= weeks ? [move.week] : [],
              outside: move.week <= weeks ? 0 : 1,
            }
          : item;
      }),
  );
  // What the viewer may do: fill the draft with plan.edit, and publish it with plan.publish, which
  // reads it as it is (Audit 7).
  const changes = Boolean(draft) && editable && edits;
  const publishable = Boolean(draft) && editable && publishes;
  const busy = running !== undefined;

  const refused = (status: string | undefined, serverError?: string) =>
    status && status in REFUSALS
      ? t(`refusals.${status as keyof typeof REFUSALS}`)
      : refusals(
          (serverError ?? "unexpected") as Parameters<typeof refusals>[0],
        );

  // Runs an action, with its button busy, and says how it went.
  const run = (
    key: string,
    action: () => Promise<Result>,
    done: Record<string, (result: NonNullable<Result>["data"]) => void>,
  ) =>
    startTransition(async () => {
      setRunning(key);
      setError(undefined);
      const result = await action();
      setRunning(undefined);
      const status = result?.data?.status;
      if (status && status in done) done[status](result?.data);
      else setError(refused(status, result?.serverError));
    });

  // Where a saved item lands, as the toast says it (the owner's notes, 21 October 2026).
  const landing = (data: NonNullable<Result>["data"]) =>
    data?.landing
      ? [
          t("landing", {
            count: data.landing.weeks.length,
            weeks: format.list(
              data.landing.weeks.map((week) => format.number(week)),
            ),
          }),
          ...(data.landing.outside > 0
            ? [t("landingOutside", { count: data.landing.outside })]
            : []),
        ].join(" ")
      : undefined;

  const save = (input: ItemInput, another: boolean) => {
    const current = editing;
    if (!current || !draft) return;
    const saved = (data: NonNullable<Result>["data"]) => {
      // Open for the next item, the sheet keeps its actions at the screen's foot, where the toast
      // would cover them, and stay while the pointer rests on it: it speaks from the top instead
      // (UX review 2).
      toast.success(t("saved"), {
        description: landing(data),
        position: another ? "top-center" : undefined,
      });
      if (another) setResetKey((key) => key + 1);
      else setEditing(undefined);
    };
    run(
      "save",
      () =>
        current === "new"
          ? addPlanItemAction({ planId: draft.id, ...input })
          : updatePlanItemAction({ itemId: current.id, ...input }),
      { saved, unchanged: () => setEditing(undefined) },
    );
  };

  const move = (moves: Move[], focus?: string) =>
    startTransition(async () => {
      moved(moves);
      // The moved mark is drawn in its new week: the keys that moved it keep working on it.
      if (focus) {
        requestAnimationFrame(() =>
          document
            .querySelector<HTMLButtonElement>(`[data-mark="${focus}"]`)
            ?.focus(),
        );
      }
      setError(undefined);
      const result = await movePlanItemsAction({ moves });
      const status = result?.data?.status;
      if (status !== "saved") {
        setError(refused(status, result?.serverError));
        return;
      }
      const [first] = moves;
      const item = items.find(({ id }) => id === first.itemId);
      setAnnounced(
        moves.length === 1 && item
          ? t("grid.moved", { title: item.title, week: first.week })
          : t("selection.moved", { count: moves.length }),
      );
    });

  const remove = (ids: string[]) =>
    run("remove", () => removePlanItemsAction({ itemIds: ids }), {
      saved: () => {
        toast.success(t("removed", { count: ids.length }));
        setRemoving(undefined);
        setSelected(
          (current) => new Set([...current].filter((id) => !ids.includes(id))),
        );
      },
    });

  // The chosen items due in one week, moved together a week earlier or later while all stay in
  // the term.
  const chosen = items.filter(({ id }) => selected.has(id));
  const shifting = chosen.filter(movable);
  const shifted = (by: number) =>
    shifting.map((item) => ({
      itemId: item.id,
      week: (item.due.type === "week" ? item.due.week : 0) + by,
    }));
  const shifts = (by: number) =>
    shifting.length > 0 &&
    shifted(by).every(({ week }) => week >= 1 && week <= weeks);

  const start = (fromTermId?: string) =>
    run(
      fromTermId ? "copy" : "start",
      () => startPlanAction({ termId, departmentId, fromTermId }),
      { created: () => undefined, exists: () => undefined },
    );

  const message =
    error && !editing && !publishing && !removing ? (
      <p role="alert" className="px-5 pb-4 text-alert text-sm sm:px-6">
        {error}
      </p>
    ) : null;

  // No version yet: the plan starts empty, or from the previous term's, from the empty state that
  // every page shows when it has nothing yet (UX review 2).
  if (!draft && !published) {
    return (
      <EmptyState
        title={t("empty.title")}
        description={
          !editable
            ? t("closed")
            : !edits
              ? t("needsEditor")
              : previous
                ? t("empty.description")
                : t("empty.descriptionNew")
        }
        action={
          editable && edits ? (
            <div className="flex flex-col items-center gap-3">
              <div className="flex flex-wrap justify-center gap-2">
                <Button type="button" disabled={busy} onClick={() => start()}>
                  {running === "start" ? (
                    <LoaderCircle aria-hidden className="animate-spin" />
                  ) : (
                    <FilePlus2 aria-hidden />
                  )}
                  {t("start")}
                </Button>
                {previous ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => start(previous.termId)}
                  >
                    {running === "copy" ? (
                      <LoaderCircle aria-hidden className="animate-spin" />
                    ) : (
                      <CopyPlus aria-hidden />
                    )}
                    {previous.words}
                  </Button>
                ) : null}
              </div>
              {error ? (
                <p role="alert" className="text-alert text-sm">
                  {error}
                </p>
              ) : null}
            </div>
          ) : undefined
        }
      />
    );
  }

  const shown = draft ?? published;
  const flags = draft ? flagged(draft.items) : 0;

  return (
    <>
      <section
        aria-labelledby={`${id}-title`}
        className="rounded-xl border bg-card shadow-xs"
      >
        <div className="flex flex-col gap-3 px-5 pt-5 pb-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id={`${id}-title`} className="font-medium text-base">
                {draft
                  ? t("status.draft", { version: draft.version })
                  : t("status.published", {
                      version: published?.version ?? 0,
                      date: published?.date ?? "",
                    })}
              </h2>
              <p className="mt-1 max-w-prose text-pretty text-muted-foreground text-sm">
                {!editable
                  ? t("closed")
                  : draft
                    ? published
                      ? t("status.publishedAlso", {
                          version: published.version,
                          date: published.date,
                        })
                      : t("status.neverPublished")
                    : edits
                      ? t("status.publishedNote")
                      : t("needsEditor")}
              </p>
            </div>
            {changes || publishable ? (
              <div className="flex flex-wrap items-center gap-2">
                {changes ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setError(undefined);
                      setResetKey(0);
                      setEditing("new");
                    }}
                  >
                    <Plus aria-hidden />
                    {t("add")}
                  </Button>
                ) : null}
                {publishable ? (
                  <Button
                    type="button"
                    disabled={!draft || draft.items.length === 0}
                    onClick={() => {
                      setError(undefined);
                      setPublishing(true);
                    }}
                  >
                    <Send aria-hidden />
                    {t("publish")}
                  </Button>
                ) : null}
              </div>
            ) : editable && edits && published ? (
              <Button type="button" disabled={busy} onClick={() => start()}>
                {running === "start" ? (
                  <LoaderCircle aria-hidden className="animate-spin" />
                ) : (
                  <FilePlus2 aria-hidden />
                )}
                {t("newVersion", { version: (versions[0]?.version ?? 0) + 1 })}
              </Button>
            ) : null}
          </div>
          {(changes || publishable) && preview ? (
            <div className="flex flex-col gap-0.5 text-sm">
              <p className="font-medium">{preview.impact}</p>
              <p className="text-muted-foreground">{preview.reviews}</p>
            </div>
          ) : null}
          {changes && !publishes ? (
            <p className="text-muted-foreground text-sm">
              {t("needsPublisher")}
            </p>
          ) : null}
          {(changes || publishable) && untaught ? (
            <p className="text-muted-foreground text-sm">{t("untaught")}</p>
          ) : null}
          {!frameworkPublished ? (
            <p className="text-muted-foreground text-sm">
              {t("framework.notPublished")}
            </p>
          ) : null}
        </div>
        {message}
        {draft && draft.items.length === 0 ? (
          <p className="border-t px-5 py-4 text-muted-foreground text-sm sm:px-6">
            {t("noItems")}
          </p>
        ) : null}

        <div className="hidden border-t md:block">
          <PlanGrid
            items={items}
            framework={framework}
            weeks={weeks}
            periods={periods}
            editable={changes}
            selected={selected}
            busy={busy}
            onSelect={setSelected}
            onMove={move}
            onEdit={(item) => {
              setError(undefined);
              setEditing(item);
            }}
            onRemove={(item) => {
              setError(undefined);
              setRemoving([item.id]);
            }}
          />
        </div>
        {changes && selected.size > 0 ? (
          // At the screen's foot while items are chosen, above the tab bar and over the grid's room
          // for it, as the role grid's Save is (UX review 2).
          <div
            role="toolbar"
            aria-label={t("selection.label")}
            className="sticky bottom-[calc(env(safe-area-inset-bottom)+6rem)] z-20 hidden flex-wrap items-center gap-2 rounded-b-xl border-t bg-card px-5 py-3 shadow-sm sm:px-6 md:flex lg:bottom-4"
          >
            <span className="font-medium text-sm">
              {t("selection.count", { count: selected.size })}
            </span>
            <Button
              type="button"
              variant="outline"
              disabled={busy || !shifts(-1)}
              onClick={() => move(shifted(-1))}
            >
              <ChevronLeft aria-hidden className="rtl:-scale-x-100" />
              {t("selection.earlier")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || !shifts(1)}
              onClick={() => move(shifted(1))}
            >
              <ChevronRight aria-hidden className="rtl:-scale-x-100" />
              {t("selection.later")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setRemoving([...selected])}
            >
              <Trash2 aria-hidden />
              {t("selection.remove")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSelected(new Set())}
            >
              {t("selection.clear")}
            </Button>
            {shifting.length < chosen.length ? (
              <p className="text-muted-foreground text-xs">
                {t("selection.notMovable")}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="border-t md:hidden">
          <PlanList
            items={items}
            framework={framework}
            weeks={weeks}
            editable={changes}
            busy={busy}
            onEdit={(item) => {
              setError(undefined);
              setEditing(item);
            }}
            onRemove={(item) => {
              setError(undefined);
              setRemoving([item.id]);
            }}
          />
        </div>
        <p aria-live="polite" className="sr-only">
          {announced}
        </p>
      </section>

      <Versions
        id={`${id}-versions`}
        title={t("versions.title")}
        versions={versions}
      />

      {publishing && draft ? (
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
            {preview ? (
              <div className="flex flex-col gap-1 text-sm">
                <p className="font-medium">{preview.impact}</p>
                <p>{preview.reviews}</p>
              </div>
            ) : null}
            {flags > 0 ? (
              <p className="flex items-start gap-1.5 text-alert text-sm">
                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                {t("flagsSummary", { count: flags })}
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="text-alert text-sm">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                disabled={running === "publish"}
                onClick={() =>
                  run(
                    "publish",
                    () => publishPlanAction({ planId: draft.id }),
                    {
                      published: () => {
                        toast.success(
                          t("publishedToast", { version: draft.version }),
                        );
                        setPublishing(false);
                        setSelected(new Set());
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

      {removing ? (
        <BottomSheet
          open
          onOpenChange={(next) => {
            if (!next) setRemoving(undefined);
          }}
          snapPoints={["auto"]}
          title={t("removeTitle", {
            count: removing.length,
            title: items.find(({ id }) => id === removing[0])?.title ?? "",
          })}
          description={t("removeDescription", { count: removing.length })}
          closeLabel={ui("close")}
        >
          <div className="flex flex-col gap-4 pt-2 pb-2">
            {error ? (
              <p role="alert" className="text-alert text-sm">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                disabled={running === "remove"}
                onClick={() => remove(removing)}
              >
                {running === "remove" ? (
                  <LoaderCircle aria-hidden className="animate-spin" />
                ) : (
                  <Trash2 aria-hidden />
                )}
                {t("removeConfirm", { count: removing.length })}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setRemoving(undefined)}
              >
                {ui("cancel")}
              </Button>
            </div>
          </div>
        </BottomSheet>
      ) : null}

      {editing && shown ? (
        <ItemSheet
          title={editing === "new" ? t("addTitle") : t("editTitle")}
          description={t("sheetDescription")}
          item={editing === "new" ? undefined : editing}
          options={options}
          limits={limits}
          saving={running === "save"}
          error={error}
          onSave={(input) => save(input, false)}
          onSaveAndAdd={
            editing === "new" ? (input) => save(input, true) : undefined
          }
          resetKey={resetKey}
          onClose={() => setEditing(undefined)}
        />
      ) : null}
    </>
  );
}

"use client";

import {
  BadgeCheck,
  FilePlus2,
  LoaderCircle,
  Pencil,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/motion/bottom-sheet";
import { Button } from "@/components/ui/button";
import {
  type ItemInput,
  type ItemLimits,
  type ItemOptions,
  ItemSheet,
} from "../_items/item-sheet.tsx";
import { type ItemView, ItemWords } from "../_items/item-words.tsx";
import {
  addItemAction,
  endorseDraftAction,
  publishDraftAction,
  removeItemAction,
  startDraftAction,
  updateItemAction,
} from "./actions.ts";

type Result = { data?: { status: string }; serverError?: string } | undefined;

// A refusal in the framework's words, or the action's.
function useRefused() {
  const t = useTranslations("framework");
  const refusals = useTranslations("actions");
  return (status: string | undefined, serverError?: string) =>
    status && status in REFUSALS
      ? t(`refusals.${status as keyof typeof REFUSALS}`)
      : refusals(
          (serverError ?? "unexpected") as Parameters<typeof refusals>[0],
        );
}

// Starts the framework's first version, from the empty state, or its next one, from the published
// version's head, as a department's plan does (UX review 2).
export function StartVersion({
  termId,
  label,
}: {
  termId: string;
  label: string;
}) {
  const refused = useRefused();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string>();
  const [, startTransition] = useTransition();
  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        type="button"
        disabled={running}
        onClick={() =>
          startTransition(async () => {
            setRunning(true);
            setError(undefined);
            const result = await startDraftAction({ termId });
            setRunning(false);
            const status = result?.data?.status;
            if (status !== "created" && status !== "exists") {
              setError(refused(status, result?.serverError));
            }
          })
        }
      >
        {running ? (
          <LoaderCircle aria-hidden className="animate-spin" />
        ) : (
          <FilePlus2 aria-hidden />
        )}
        {label}
      </Button>
      {error ? (
        <p role="alert" className="text-alert text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// The term's framework as it is prepared (Step 15): the draft's items, added and corrected in a
// sheet and each taken out once asked, the dean's endorsement where the college asks for it, and
// its publication, with the tasks it would create and the reviews a week it asks. Its head carries
// what acts on the whole draft, as a department's plan's does (UX review 2).
export function FrameworkDraft({
  draft,
  manage,
  endorse,
  needsEndorsement,
  preview,
  options,
  limits,
}: {
  draft: { id: string; version: number; endorsed: boolean; items: ItemView[] };
  manage: boolean;
  endorse: boolean;
  needsEndorsement: boolean;
  /** The tasks the draft would create, and the reviews a week it asks, in words. */
  preview?: { impact: string; reviews: string };
  options: ItemOptions;
  limits: ItemLimits;
}) {
  const t = useTranslations("framework");
  const ui = useTranslations("ui");
  const refused = useRefused();
  const id = useId();
  const [editing, setEditing] = useState<ItemView | "new">();
  const [error, setError] = useState<string>();
  const [running, setRunning] = useState<string>();
  const [publishing, setPublishing] = useState(false);
  const [removing, setRemoving] = useState<ItemView>();
  const [, startTransition] = useTransition();

  // Runs an action, with its button busy, and says how it went.
  const run = (
    key: string,
    action: () => Promise<Result>,
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
    setError(undefined);
  };

  // The framework's sheet offers no person: its items reach a role or each trainer.
  const save = ({ appliesTo, ...input }: ItemInput) => {
    const current = editing;
    if (!current || appliesTo.type === "person") return;
    const item = { ...input, appliesTo };
    const closed = () => {
      toast.success(t("saved"));
      setEditing(undefined);
    };
    run(
      "save",
      () =>
        current === "new"
          ? addItemAction({ draftId: draft.id, ...item })
          : updateItemAction({ itemId: current.id, ...item }),
      { saved: closed, unchanged: closed },
    );
  };

  const endorsable =
    endorse && needsEndorsement && !draft.endorsed && draft.items.length > 0;

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="rounded-xl border bg-card shadow-xs"
    >
      <div className="flex flex-col gap-3 px-5 pt-5 pb-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
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
          {manage || endorsable ? (
            <div className="flex flex-wrap items-center gap-2">
              {manage ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => open("new")}
                  >
                    <Plus aria-hidden />
                    {t("add")}
                  </Button>
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
                </>
              ) : null}
              {endorsable ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={running === "endorse"}
                  onClick={() =>
                    run(
                      "endorse",
                      () => endorseDraftAction({ draftId: draft.id }),
                      {
                        endorsed: () => toast.success(t("endorsedToast")),
                        unchanged: () => undefined,
                      },
                    )
                  }
                >
                  <BadgeCheck aria-hidden />
                  {t("endorse")}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        {preview ? (
          <div className="flex flex-col gap-0.5 text-sm">
            <p className="font-medium">{preview.impact}</p>
            <p className="text-muted-foreground">{preview.reviews}</p>
          </div>
        ) : null}
        {error && !editing && !publishing && !removing ? (
          <p role="alert" className="text-alert text-sm">
            {error}
          </p>
        ) : null}
      </div>
      {draft.items.length > 0 ? (
        <ol
          aria-label={t("draft", { version: draft.version })}
          className="divide-y border-t"
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
                    onClick={() => {
                      setError(undefined);
                      setRemoving(item);
                    }}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="border-t px-5 py-4 text-muted-foreground text-sm sm:px-6">
          {t("noItems")}
        </p>
      )}

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
            {preview ? (
              <div className="flex flex-col gap-1 text-sm">
                <p className="font-medium">{preview.impact}</p>
                <p>{preview.reviews}</p>
              </div>
            ) : null}
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

      {removing ? (
        <BottomSheet
          open
          onOpenChange={(next) => {
            if (!next) setRemoving(undefined);
          }}
          snapPoints={["auto"]}
          title={t("removeTitle", { title: removing.title })}
          description={t("removeDescription")}
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
                onClick={() =>
                  run(
                    "remove",
                    () => removeItemAction({ itemId: removing.id }),
                    {
                      saved: () => {
                        toast.success(t("removed"));
                        setRemoving(undefined);
                      },
                    },
                  )
                }
              >
                {running === "remove" ? (
                  <LoaderCircle aria-hidden className="animate-spin" />
                ) : (
                  <Trash2 aria-hidden />
                )}
                {t("removeConfirm")}
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

      {editing ? (
        <ItemSheet
          title={editing === "new" ? t("addTitle") : t("editTitle")}
          description={t("sheetDescription")}
          item={editing === "new" ? undefined : editing}
          options={options}
          limits={limits}
          saving={running === "save"}
          error={error}
          onSave={save}
          onClose={() => setEditing(undefined)}
        />
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

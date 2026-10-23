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
  options: ItemOptions;
  limits: ItemLimits;
}) {
  const t = useTranslations("framework");
  const ui = useTranslations("ui");
  const refusals = useTranslations("actions");
  const id = useId();
  const [editing, setEditing] = useState<ItemView | "new">();
  const [error, setError] = useState<string>();
  const [running, setRunning] = useState<string>();
  const [publishing, setPublishing] = useState(false);
  const [, startTransition] = useTransition();

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
    setError(undefined);
  };

  // The framework's sheet offers no person: its items reach a role or each trainer.
  const save = ({ appliesTo, ...input }: ItemInput) => {
    const current = editing;
    if (!current || !draft || appliesTo.type === "person") return;
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

"use client";

import { LoaderCircle, PencilLine, RotateCcw, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { ActionSwapButton } from "@/components/motion/action-swap";
import { AnimatedBadge } from "@/components/motion/animated-badge";
import { BottomSheet } from "@/components/motion/bottom-sheet";
import { NoResults, SearchField } from "@/components/search-field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { resetTextAction, setTextAction } from "./actions.ts";

// A text as the page sends it: its key, its words as the college has them and as the release
// ships them, and, when the college changed it, who did and when, in words.
export type TextRow = {
  key: string;
  value: string;
  original: string;
  changed?: string;
};

// How long the search waits after the last key before it asks the page again.
const SEARCH_DELAY = 300;

function textsHref(q: string) {
  return q.trim() ? `/texts?${new URLSearchParams({ q: q.trim() })}` : "/texts";
}

// The texts page's search, which lives in the address the page reads, and its list: the search's
// texts, or the ones the college changed while nothing is searched (ADR-0029).
export function TextsScreen({
  query,
  texts,
  count,
}: {
  query: string;
  texts: TextRow[];
  /** How many texts the search found, or the college changed; the list shows the first. */
  count: number;
}) {
  const t = useTranslations("texts");
  const router = useRouter();
  const titleId = useId();
  const [search, setSearch] = useState(query);
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState<TextRow | null>(null);
  const searching = query.trim() !== "";

  useEffect(() => {
    if (search.trim() === query.trim()) return;
    const timer = setTimeout(
      () => startTransition(() => router.replace(textsHref(search))),
      SEARCH_DELAY,
    );
    return () => clearTimeout(timer);
  }, [search, query, router]);

  return (
    <div className="flex flex-col gap-6">
      <div className="sm:max-w-md">
        <SearchField
          label={t("search.label")}
          placeholder={t("search.placeholder")}
          value={search}
          onChange={setSearch}
          results={count}
        />
      </div>
      {texts.length > 0 ? (
        <section aria-labelledby={titleId}>
          <h2 id={titleId} className="mb-3 px-1 text-lg">
            {searching ? t("results.title") : t("changed.title")}
          </h2>
          <ul className="flex flex-col divide-y rounded-xl border bg-card shadow-xs">
            {texts.map((text) => (
              <li
                key={text.key}
                className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 sm:px-5"
              >
                <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
                  <p className="text-muted-foreground text-xs">
                    <bdi dir="ltr" className="font-mono">
                      {text.key}
                    </bdi>
                  </p>
                  <p className="[overflow-wrap:anywhere]">{text.value}</p>
                  {text.changed ? (
                    <>
                      <p className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
                        <AnimatedBadge status="pending">
                          {t("badge")}
                        </AnimatedBadge>
                        {text.changed}
                      </p>
                      <p className="text-muted-foreground text-sm [overflow-wrap:anywhere]">
                        {t("original", { text: text.original })}
                      </p>
                    </>
                  ) : null}
                </div>
                <Button
                  variant="outline"
                  aria-label={t("edit.label", { key: text.key })}
                  onClick={() => setOpen(text)}
                >
                  <PencilLine aria-hidden />
                  {t("edit.button")}
                </Button>
              </li>
            ))}
          </ul>
          {count > texts.length ? (
            <p className="mt-3 px-1 text-muted-foreground text-sm">
              {t("results.more", { shown: texts.length, count })}
            </p>
          ) : null}
        </section>
      ) : searching ? (
        <NoResults query={query} onClear={() => setSearch("")} />
      ) : (
        <EmptyState
          title={t("changed.empty.title")}
          description={t("changed.empty.description")}
        />
      )}
      {open ? <TextSheet text={open} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

// A text's sheet: its words to change, checked by the server against the default's arguments,
// and its default to put back when the college changed it.
function TextSheet({ text, onClose }: { text: TextRow; onClose: () => void }) {
  const t = useTranslations("texts");
  const ui = useTranslations("ui");
  const refusals = useTranslations("actions");
  const id = useId();
  const [value, setValue] = useState(text.value);
  const [running, setRunning] = useState<"save" | "reset">();
  const [error, setError] = useState<string>();
  const [, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setRunning("save");
      setError(undefined);
      const result = await setTextAction({ key: text.key, value });
      setRunning(undefined);
      const status = result?.data?.status;
      if (status === "saved" || status === "unchanged") {
        toast.success(t(status === "saved" ? "edit.done" : "edit.unchanged"));
        onClose();
      } else if (status) setError(t(`problems.${status}`));
      else setError(refusals(result?.serverError ?? "unexpected"));
    });

  const reset = () =>
    startTransition(async () => {
      setRunning("reset");
      setError(undefined);
      const result = await resetTextAction({ key: text.key });
      setRunning(undefined);
      if (result?.data) {
        toast.success(t("edit.resetDone"));
        onClose();
      } else setError(refusals(result?.serverError ?? "unexpected"));
    });

  return (
    <BottomSheet
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      snapPoints={["auto"]}
      title={t("edit.title")}
      description={t("edit.description")}
      closeLabel={ui("close")}
    >
      <form
        noValidate
        className="flex flex-col gap-4 pt-2 pb-2"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <p className="text-muted-foreground text-xs">
          <bdi dir="ltr" className="font-mono">
            {text.key}
          </bdi>
        </p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-value`} className="px-1 font-medium text-sm">
            {t("edit.field")}
          </label>
          <Textarea
            id={`${id}-value`}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError(undefined);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            // The one-line field's box: its radius, ground, padding and type.
            className="min-h-28 rounded-lg bg-background px-3.5 py-2.5 text-base md:text-base"
          />
          {error ? (
            <p
              id={`${id}-error`}
              role="alert"
              className="px-1 text-alert text-sm"
            >
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1 rounded-lg bg-muted/50 px-3.5 py-2.5">
          <p className="font-medium text-sm">{t("edit.original")}</p>
          <p className="text-muted-foreground text-sm [overflow-wrap:anywhere]">
            {text.original}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ActionSwapButton
            type="submit"
            disabled={running !== undefined}
            value={running === "save" ? "running" : "idle"}
            items={[
              { id: "idle", label: t("edit.save"), icon: <Save /> },
              {
                id: "running",
                label: t("edit.saving"),
                icon: <LoaderCircle className="animate-spin" />,
              },
            ]}
          />
          {text.changed ? (
            <Button
              type="button"
              variant="outline"
              disabled={running !== undefined}
              onClick={reset}
            >
              {running === "reset" ? (
                <LoaderCircle aria-hidden className="animate-spin" />
              ) : (
                <RotateCcw aria-hidden />
              )}
              {running === "reset" ? t("edit.resetting") : t("edit.reset")}
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

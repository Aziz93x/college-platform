"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  type ItemInput,
  type ItemLimits,
  type ItemOptions,
  ItemSheet,
} from "../_items/item-sheet.tsx";
import { type ItemView, ItemWords } from "../_items/item-words.tsx";
import {
  addTemplateAction,
  removeTemplateAction,
  updateTemplateAction,
} from "./actions.ts";

// The refusals the services name, worded on the page.
const REFUSALS = { notFound: true, closed: true, notOffered: true } as const;

// A department's own section templates for the term (Step 18), in the head's order: added and
// corrected in the framework's sheet, each reaching each section's or each course's trainer, and
// taken out. A closed term's are only read.
export function TemplatesEditor({
  termId,
  departmentId,
  templates,
  editable,
  options,
  limits,
}: {
  termId: string;
  departmentId: string;
  templates: ItemView[];
  editable: boolean;
  options: ItemOptions;
  limits: ItemLimits;
}) {
  const t = useTranslations("templates");
  const refusals = useTranslations("actions");
  const id = useId();
  const [editing, setEditing] = useState<ItemView | "new">();
  const [error, setError] = useState<string>();
  const [running, setRunning] = useState<string>();
  const [, startTransition] = useTransition();

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
      else if (status && status in REFUSALS) {
        setError(t(`refusals.${status as keyof typeof REFUSALS}`));
      } else {
        setError(
          refusals(
            (result?.serverError ?? "unexpected") as Parameters<
              typeof refusals
            >[0],
          ),
        );
      }
    });

  // A template's sheet offers no roles, so it reaches each section's or each course's trainers.
  const save = (input: ItemInput) => {
    const current = editing;
    if (!current || "roleId" in input.appliesTo) return;
    const template = { ...input, appliesTo: input.appliesTo };
    const closed = () => {
      toast.success(t("saved"));
      setEditing(undefined);
    };
    run(
      "save",
      () =>
        current === "new"
          ? addTemplateAction({ termId, departmentId, ...template })
          : updateTemplateAction({ templateId: current.id, ...template }),
      { saved: closed, unchanged: closed },
    );
  };

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="rounded-xl border bg-card shadow-xs"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="font-medium text-base">
            {t("own.title")}
          </h2>
          <p className="mt-1 max-w-prose text-pretty text-muted-foreground text-sm">
            {editable ? t("own.description") : t("closed")}
          </p>
        </div>
        {editable ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setError(undefined);
              setEditing("new");
            }}
          >
            <Plus aria-hidden />
            {t("add")}
          </Button>
        ) : null}
      </div>
      {templates.length > 0 ? (
        <ol aria-labelledby={`${id}-title`} className="mt-4 divide-y border-t">
          {templates.map((template) => (
            <li
              key={template.id}
              className="flex items-start justify-between gap-3 px-5 py-3 sm:px-6"
            >
              <ItemWords item={template} />
              {editable ? (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("edit", { title: template.title })}
                    onClick={() => {
                      setError(undefined);
                      setEditing(template);
                    }}
                  >
                    <Pencil aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("remove", { title: template.title })}
                    disabled={running === template.id}
                    onClick={() =>
                      run(
                        template.id,
                        () => removeTemplateAction({ templateId: template.id }),
                        { saved: () => toast.success(t("removed")) },
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
        <p className="px-5 pt-3 pb-5 text-muted-foreground text-sm sm:px-6">
          {t("own.empty")}
        </p>
      )}
      {error && !editing ? (
        <p role="alert" className="px-5 pb-4 text-alert text-sm sm:px-6">
          {error}
        </p>
      ) : templates.length > 0 ? (
        <div className="pb-2" />
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

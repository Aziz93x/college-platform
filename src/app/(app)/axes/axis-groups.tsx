"use client";

import { LoaderCircle, Pencil, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionSwapButton } from "@/components/motion/action-swap";
import { BottomSheet } from "@/components/motion/bottom-sheet";
import { Input } from "@/components/motion/input";
import { Button } from "@/components/ui/button";
import { updateAxisAction } from "./actions.ts";

type Axis = { id: string; code: string; title: string; description: string };

// Each group of axes as a card, its axes in order with their codes; an axis's title and
// description are corrected in a sheet.
export function AxisGroups({
  groups,
  limits,
}: {
  groups: { id: string; title: string; axes: Axis[] }[];
  limits: { title: number; description: number };
}) {
  const t = useTranslations("axes");
  const ui = useTranslations("ui");
  const refusals = useTranslations("actions");
  const [editing, setEditing] = useState<Axis>();
  const [draft, setDraft] = useState({ title: "", description: "" });
  const [error, setError] = useState<string>();
  const [running, setRunning] = useState(false);
  const [, startTransition] = useTransition();

  const open = (axis: Axis) => {
    setEditing(axis);
    setDraft({ title: axis.title, description: axis.description });
    setError(undefined);
  };

  const save = () => {
    const current = editing;
    if (!current) return;
    if (!draft.title.trim()) {
      setError(t("titleRequired"));
      return;
    }
    startTransition(async () => {
      setRunning(true);
      setError(undefined);
      const result = await updateAxisAction({ id: current.id, ...draft });
      setRunning(false);
      switch (result?.data?.status) {
        case "saved":
        case "unchanged":
          toast.success(t("saved", { code: current.code }));
          setEditing(undefined);
          return;
        case "notFound":
          setError(t("gone"));
          return;
        default:
          setError(refusals(result?.serverError ?? "unexpected"));
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section
          key={group.id}
          aria-labelledby={`group-${group.id}`}
          className="rounded-xl border bg-card shadow-xs"
        >
          <h2
            id={`group-${group.id}`}
            className="px-5 pt-5 pb-3 font-medium text-base sm:px-6"
          >
            {group.title}
          </h2>
          <ul aria-label={group.title} className="divide-y border-t">
            {group.axes.map((axis) => (
              <li
                key={axis.id}
                className="flex items-start justify-between gap-3 px-5 py-3 sm:px-6"
              >
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {t("number", { code: axis.code })}
                  </p>
                  <p className="font-medium text-sm">{axis.title}</p>
                  {axis.description ? (
                    <p className="mt-0.5 text-muted-foreground text-sm">
                      {axis.description}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("edit", { title: axis.title })}
                  onClick={() => open(axis)}
                >
                  <Pencil aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {editing ? (
        <BottomSheet
          open
          onOpenChange={(next) => {
            if (!next) setEditing(undefined);
          }}
          snapPoints={["auto"]}
          title={t("editTitle", { code: editing.code })}
          description={t("editDescription")}
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
              value={draft.title}
              onChange={(title) =>
                setDraft((current) => ({ ...current, title }))
              }
            />
            <Input
              label={t("fields.description")}
              autoComplete="off"
              maxLength={limits.description}
              value={draft.description}
              onChange={(description) =>
                setDraft((current) => ({ ...current, description }))
              }
            />
            {error ? (
              <p role="alert" className="text-alert text-sm">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <ActionSwapButton
                type="submit"
                disabled={running}
                value={running ? "saving" : "save"}
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
    </div>
  );
}

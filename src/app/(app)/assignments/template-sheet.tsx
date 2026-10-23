"use client";

import { LoaderCircle, Pencil, Plus, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionSwapButton } from "@/components/motion/action-swap";
import { BottomSheet } from "@/components/motion/bottom-sheet";
import { Input } from "@/components/motion/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/motion/select";
import { Button } from "@/components/ui/button";
import { createTemplateAction, updateTemplateAction } from "./actions.ts";

type Option = { value: string; label: string };

// A department's own template, added or renamed in a sheet: its name, and the axis its tasks go
// under in the portfolio, which starts as the shared templates' (Step 21).
export function TemplateButton({
  departmentId,
  template,
  axes,
  axis,
  titleLength,
}: {
  departmentId: string;
  /** The template to rename; none for a new one. */
  template?: { id: string; title: string };
  axes: Option[];
  /** The axis the sheet starts on. */
  axis: string;
  titleLength: number;
}) {
  const t = useTranslations("assignments.template");
  const ui = useTranslations("ui");
  const refusals = useTranslations("actions");
  const id = useId();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(template?.title ?? "");
  const [axisId, setAxisId] = useState(axis);
  const [problem, setProblem] = useState<string>();
  const [running, setRunning] = useState(false);
  const [, startTransition] = useTransition();

  const start = () => {
    setTitle(template?.title ?? "");
    setAxisId(axis);
    setProblem(undefined);
    setOpen(true);
  };

  const save = () => {
    if (!title.trim()) return setProblem(t("nameRequired"));
    setProblem(undefined);
    startTransition(async () => {
      setRunning(true);
      const result = template
        ? await updateTemplateAction({ templateId: template.id, title, axisId })
        : await createTemplateAction({ departmentId, title, axisId });
      setRunning(false);
      const status = result?.data?.status;
      if (
        status === "created" ||
        status === "saved" ||
        status === "unchanged"
      ) {
        if (status !== "unchanged") {
          toast.success(
            status === "created" ? t("created", { title }) : t("saved"),
          );
        }
        setOpen(false);
        return;
      }
      setProblem(
        status
          ? t(`refusals.${status}`)
          : refusals(result?.serverError ?? "unexpected"),
      );
    });
  };

  return (
    <>
      {template ? (
        <Button
          type="button"
          variant="ghost"
          aria-label={t("editLabel", { title: template.title })}
          onClick={start}
        >
          <Pencil aria-hidden />
          {t("edit")}
        </Button>
      ) : (
        <Button type="button" onClick={start}>
          <Plus aria-hidden />
          {t("add")}
        </Button>
      )}
      {open ? (
        <BottomSheet
          open
          onOpenChange={(next) => {
            if (!next) setOpen(false);
          }}
          snapPoints={["auto"]}
          title={
            template ? t("editTitle", { title: template.title }) : t("addTitle")
          }
          description={template ? t("editDescription") : t("addDescription")}
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
              label={t("name")}
              autoComplete="off"
              maxLength={titleLength}
              value={title}
              onChange={(text) => {
                setTitle(text);
                setProblem(undefined);
              }}
            />
            <div className="flex flex-col gap-1.5">
              <span id={`${id}-axis`} className="px-1 font-medium text-sm">
                {t("axis")}
              </span>
              <Select
                aria-labelledby={`${id}-axis`}
                value={axisId}
                onValueChange={setAxisId}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {axes.map((each) => (
                    <SelectItem key={each.value} value={each.value}>
                      {each.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {problem ? (
              <p role="alert" className="text-alert text-sm">
                {problem}
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
                onClick={() => setOpen(false)}
              >
                {ui("cancel")}
              </Button>
            </div>
          </form>
        </BottomSheet>
      ) : null}
    </>
  );
}

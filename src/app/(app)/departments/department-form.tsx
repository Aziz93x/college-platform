"use client";

import { Check, LoaderCircle, Plus, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { ListField } from "@/components/list-field";
import { ActionSwapButton } from "@/components/motion/action-swap";
import { Input } from "@/components/motion/input";
import { Switch } from "@/components/motion/switch";
import { Button } from "@/components/ui/button";
import type { Department } from "@/modules/org";
import { oneLine } from "@/platform/validation/text";
import { createDepartmentAction, updateDepartmentAction } from "./actions.ts";

type Draft = Omit<Department, "id">;
type Field = "name" | "shortName" | "rayatValues";

const BLANK: Draft = { name: "", shortName: "", rayatValues: [], active: true };

const sameValues = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value) => b.includes(value));

// A department's names and how Rayat writes it. Without a department it adds a new one, in use, and
// goes back to the list; with one it saves it in place, and can set it aside.
export function DepartmentForm({ department }: { department?: Department }) {
  const t = useTranslations("departments.form");
  const refusals = useTranslations("actions");
  const router = useRouter();
  const id = useId();
  const [draft, setDraft] = useState<Draft>(department ?? BLANK);
  // A Rayat value typed but not added yet: a press on the button adds it with the rest.
  const [typed, setTyped] = useState("");
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [refusal, setRefusal] = useState<string>();
  const [state, setState] = useState<"idle" | "running" | "done">("idle");
  const [, startTransition] = useTransition();

  const dirty =
    !department ||
    oneLine(typed) !== "" ||
    oneLine(draft.name) !== department.name ||
    oneLine(draft.shortName) !== department.shortName ||
    !sameValues(draft.rayatValues, department.rayatValues) ||
    draft.active !== department.active;

  // "Saved" shows for a moment.
  useEffect(() => {
    if (state !== "done") return;
    const timer = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [state]);

  const change = (patch: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors((all) => {
      const next = { ...all };
      for (const field of Object.keys(patch)) delete next[field as Field];
      return next;
    });
    setRefusal(undefined);
    setState("idle");
  };

  const readValue = (text: string, values: string[]) => {
    const value = oneLine(text);
    if (!value) return undefined;
    if (values.includes(value)) return { problem: t("duplicateValue") };
    return { item: value };
  };

  const submit = () => {
    const entry = readValue(typed, draft.rayatValues);
    if (entry && "problem" in entry) {
      setErrors({ rayatValues: entry.problem });
      return;
    }
    const rayatValues = entry
      ? [...draft.rayatValues, entry.item]
      : draft.rayatValues;
    if (entry) {
      change({ rayatValues });
      setTyped("");
    }
    const missing: Partial<Record<Field, string>> = {};
    if (!oneLine(draft.name)) missing.name = t("required.name");
    if (!oneLine(draft.shortName)) missing.shortName = t("required.shortName");
    if (rayatValues.length === 0) {
      missing.rayatValues = t("required.rayatValues");
    }
    setErrors(missing);
    if (Object.keys(missing).length > 0) return;
    const input = { ...draft, rayatValues };
    startTransition(async () => {
      setState("running");
      const result = department
        ? await updateDepartmentAction({ ...input, id: department.id })
        : await createDepartmentAction(input);
      const outcome = result?.data;
      const name = oneLine(draft.name);
      switch (outcome?.status) {
        case "created":
          // The button keeps saying it is adding until the list is on show.
          toast.success(t("toast.created", { name }));
          router.push("/departments");
          return;
        case "saved":
        case "unchanged":
          setState("done");
          toast.success(t("toast.saved", { name }));
          return;
        case "nameTaken":
          setErrors({
            name: t("nameTaken", { department: outcome.department }),
          });
          break;
        case "shortNameTaken":
          setErrors({
            shortName: t("shortNameTaken", { department: outcome.department }),
          });
          break;
        case "valueTaken":
          setErrors({
            rayatValues: t("valueTaken", {
              value: outcome.value,
              department: outcome.department,
            }),
          });
          break;
        default:
          setRefusal(
            result?.validationErrors
              ? t("invalid")
              : refusals(result?.serverError ?? "unexpected"),
          );
      }
      setState("idle");
    });
  };

  const ids = { active: `${id}-active`, activeHint: `${id}-active-hint` };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="divide-y rounded-xl border bg-card shadow-xs"
    >
      <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:px-6">
        <Input
          label={t("name")}
          autoComplete="off"
          value={draft.name}
          onChange={(name) => change({ name })}
          error={errors.name}
        />
        <Input
          label={t("shortName")}
          autoComplete="off"
          value={draft.shortName}
          onChange={(shortName) => change({ shortName })}
          error={errors.shortName}
          hint={t("shortNameHint")}
        />
      </div>
      <div className="flex flex-col gap-3 px-5 py-5 sm:px-6">
        <div>
          <p className="font-medium text-sm">{t("rayatValues")}</p>
          <p className="mt-1 max-w-prose text-pretty text-muted-foreground text-sm">
            {t("rayatValuesHint")}
          </p>
        </div>
        <ListField
          label={t("rayatValues")}
          items={draft.rayatValues}
          onChange={(rayatValues) => change({ rayatValues })}
          read={readValue}
          typed={typed}
          onTypedChange={setTyped}
          error={errors.rayatValues}
          words={{
            placeholder: t("rayatValuePlaceholder"),
            add: t("addValue"),
            remove: (item) => t("removeValue", { item }),
          }}
          className="lg:max-w-xl"
        />
      </div>
      {department ? (
        <div className="flex items-start justify-between gap-4 px-5 py-5 sm:px-6">
          <div>
            <p id={ids.active} className="font-medium text-sm">
              {t("active")}
            </p>
            <p
              id={ids.activeHint}
              className="mt-1 max-w-prose text-pretty text-muted-foreground text-sm"
            >
              {t("activeHint")}
            </p>
          </div>
          <Switch
            checked={draft.active}
            onCheckedChange={(active) => change({ active })}
            aria-labelledby={ids.active}
            aria-describedby={ids.activeHint}
          />
        </div>
      ) : null}
      <div className="flex flex-col gap-3 px-5 py-4 sm:px-6">
        {refusal ? (
          <p role="alert" className="text-alert text-sm">
            {refusal}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button asChild variant="ghost">
            <Link href="/departments">{t("back")}</Link>
          </Button>
          <ActionSwapButton
            type="submit"
            disabled={state === "running" || (!dirty && state === "idle")}
            value={
              department
                ? { idle: "save", running: "saving", done: "saved" }[state]
                : state === "idle"
                  ? "create"
                  : "creating"
            }
            items={
              department
                ? [
                    { id: "save", label: t("save"), icon: <Save /> },
                    {
                      id: "saving",
                      label: t("saving"),
                      icon: <LoaderCircle className="animate-spin" />,
                    },
                    { id: "saved", label: t("saved"), icon: <Check /> },
                  ]
                : [
                    { id: "create", label: t("create"), icon: <Plus /> },
                    {
                      id: "creating",
                      label: t("creating"),
                      icon: <LoaderCircle className="animate-spin" />,
                    },
                  ]
            }
          />
        </div>
      </div>
    </form>
  );
}

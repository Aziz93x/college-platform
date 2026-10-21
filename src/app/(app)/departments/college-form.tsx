"use client";

import { Check, LoaderCircle, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionSwapButton } from "@/components/motion/action-swap";
import { Input } from "@/components/motion/input";
import { oneLine } from "@/platform/validation/text";
import { updateCollegeAction } from "./actions.ts";

type Names = { name: string; shortName: string };

// The college's name and short name, which the login page and the sidebar show. Save appears once
// a name changes.
export function CollegeForm({ college }: { college: Names }) {
  const t = useTranslations("departments.college");
  const refusals = useTranslations("actions");
  const headingId = useId();
  const [draft, setDraft] = useState(college);
  const [errors, setErrors] = useState<Partial<Names>>({});
  const [refusal, setRefusal] = useState<string>();
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [, startTransition] = useTransition();

  const dirty =
    oneLine(draft.name) !== college.name ||
    oneLine(draft.shortName) !== college.shortName;

  // "Saved" shows for a moment, then the button leaves.
  useEffect(() => {
    if (state !== "saved") return;
    const timer = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [state]);

  const change = (field: keyof Names, value: string) => {
    setDraft((names) => ({ ...names, [field]: value }));
    setErrors((all) => ({ ...all, [field]: undefined }));
    setRefusal(undefined);
    setState("idle");
  };

  const submit = () => {
    const missing: Partial<Names> = {};
    if (!oneLine(draft.name)) missing.name = t("required.name");
    if (!oneLine(draft.shortName)) missing.shortName = t("required.shortName");
    setErrors(missing);
    if (missing.name || missing.shortName) return;
    startTransition(async () => {
      setState("saving");
      const result = await updateCollegeAction(draft);
      const outcome = result?.data;
      if (outcome?.status === "saved" || outcome?.status === "unchanged") {
        setState("saved");
        toast.success(t("toast"));
        return;
      }
      setState("idle");
      setRefusal(
        result?.validationErrors
          ? t("invalid")
          : refusals(result?.serverError ?? "unexpected"),
      );
    });
  };

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border bg-card shadow-xs"
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="flex flex-col gap-5 px-5 py-5 sm:px-6"
      >
        <div>
          <h2 id={headingId} className="font-medium text-base">
            {t("title")}
          </h2>
          <p className="mt-1 max-w-prose text-pretty text-muted-foreground text-sm">
            {t("description")}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("name")}
            autoComplete="off"
            value={draft.name}
            onChange={(value) => change("name", value)}
            error={errors.name}
          />
          <Input
            label={t("shortName")}
            autoComplete="off"
            value={draft.shortName}
            onChange={(value) => change("shortName", value)}
            error={errors.shortName}
          />
        </div>
        {refusal ? (
          <p role="alert" className="text-alert text-sm">
            {refusal}
          </p>
        ) : null}
        {dirty || state !== "idle" ? (
          <div className="flex justify-end">
            <ActionSwapButton
              type="submit"
              disabled={state === "saving"}
              value={state === "idle" ? "save" : state}
              items={[
                { id: "save", label: t("save"), icon: <Save /> },
                {
                  id: "saving",
                  label: t("saving"),
                  icon: <LoaderCircle className="animate-spin" />,
                },
                { id: "saved", label: t("saved"), icon: <Check /> },
              ]}
            />
          </div>
        ) : null}
      </form>
    </section>
  );
}

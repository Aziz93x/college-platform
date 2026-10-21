"use client";

import { Check, LoaderCircle, Plus, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionSwapButton } from "@/components/motion/action-swap";
import { Input } from "@/components/motion/input";
import { Button } from "@/components/ui/button";
import { oneLine } from "@/platform/validation/text";
import { createRoleAction, renameRoleAction } from "./actions.ts";

// A role's name. Without a role it adds one and opens its page, where its keys and members are
// chosen; with one it renames it in place, and Save appears once the name changes.
export function RoleNameForm({
  role,
}: {
  role?: { id: string; label: string };
}) {
  const t = useTranslations("roles");
  const refusals = useTranslations("actions");
  const router = useRouter();
  const headingId = useId();
  const [label, setLabel] = useState(role?.label ?? "");
  const [error, setError] = useState<string>();
  const [state, setState] = useState<"idle" | "running" | "done">("idle");
  const [, startTransition] = useTransition();
  const dirty = !role || oneLine(label) !== role.label;
  const idle = state === "idle";

  useEffect(() => {
    if (state !== "done") return;
    const timer = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [state]);

  const submit = () => {
    if (!oneLine(label)) {
      setError(t("name.required"));
      return;
    }
    startTransition(async () => {
      setState("running");
      const result = role
        ? await renameRoleAction({ id: role.id, label })
        : await createRoleAction({ label });
      const outcome = result?.data;
      switch (outcome?.status) {
        case "created":
          // The button keeps saying it is adding until the role's page is on show.
          toast.success(t("new.toast", { name: oneLine(label) }));
          router.push(`/roles/${outcome.id}`);
          return;
        case "saved":
        case "unchanged":
          setState("done");
          toast.success(t("name.toast"));
          return;
        case "labelTaken":
          setError(t("name.taken"));
          break;
        default:
          setError(
            result?.validationErrors
              ? t("name.invalid")
              : refusals(result?.serverError ?? "unexpected"),
          );
      }
      setState("idle");
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
        className="flex flex-col gap-4 px-5 py-5 sm:px-6"
      >
        <div>
          <h2 id={headingId} className="font-medium text-base">
            {t("name.title")}
          </h2>
          <p className="mt-1 max-w-prose text-pretty text-muted-foreground text-sm">
            {t("name.description")}
          </p>
        </div>
        <Input
          label={t("name.label")}
          hideLabel
          autoComplete="off"
          value={label}
          onChange={(value) => {
            setLabel(value);
            setError(undefined);
            setState("idle");
          }}
          error={error}
          className="sm:max-w-md"
        />
        {role && !dirty && idle ? null : (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {role ? null : (
              <Button asChild variant="ghost">
                <Link href="/roles">{t("new.back")}</Link>
              </Button>
            )}
            <ActionSwapButton
              type="submit"
              disabled={state === "running"}
              value={
                role
                  ? { idle: "save", running: "saving", done: "saved" }[state]
                  : state === "idle"
                    ? "create"
                    : "creating"
              }
              items={
                role
                  ? [
                      { id: "save", label: t("name.save"), icon: <Save /> },
                      {
                        id: "saving",
                        label: t("name.saving"),
                        icon: <LoaderCircle className="animate-spin" />,
                      },
                      { id: "saved", label: t("name.saved"), icon: <Check /> },
                    ]
                  : [
                      { id: "create", label: t("new.create"), icon: <Plus /> },
                      {
                        id: "creating",
                        label: t("new.creating"),
                        icon: <LoaderCircle className="animate-spin" />,
                      },
                    ]
              }
            />
          </div>
        )}
      </form>
    </section>
  );
}

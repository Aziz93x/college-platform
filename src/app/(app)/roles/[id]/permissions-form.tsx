"use client";

import { Check, LoaderCircle, Save, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionSwapButton } from "@/components/motion/action-swap";
import { Switch } from "@/components/motion/switch";
import { usePasswordStep } from "@/components/password-step";
import { cn } from "@/components/ui/cn";
import type { PermissionArea, PermissionKey } from "@/modules/access";
import { setRolePermissionsAction } from "../actions.ts";

export type GridArea = {
  area: PermissionArea;
  keys: { key: PermissionKey; twoFactor: boolean }[];
};

// The role's column of the grid: a switch per key, grouped by area, saved together. The system role
// holds every key, so its switches are on and cannot be changed.
export function PermissionsForm({
  role,
  areas,
}: {
  role: {
    id: string;
    label: string;
    system: boolean;
    permissions: PermissionKey[];
  };
  areas: GridArea[];
}) {
  const t = useTranslations("roles");
  const refusals = useTranslations("actions");
  const id = useId();
  const [held, setHeld] = useState(() => new Set(role.permissions));
  const [refusal, setRefusal] = useState<string>();
  const [state, setState] = useState<"idle" | "running" | "done">("idle");
  const [, startTransition] = useTransition();
  const step = usePasswordStep();
  const dirty =
    held.size !== role.permissions.length ||
    role.permissions.some((key) => !held.has(key));

  useEffect(() => {
    if (state !== "done") return;
    const timer = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [state]);

  const save = (password?: string) =>
    startTransition(async () => {
      setState("running");
      setRefusal(undefined);
      const result = await setRolePermissionsAction({
        id: role.id,
        permissions: [...held],
        password,
      });
      const outcome = result?.data;
      if (step.handled(outcome, save)) {
        setState("idle");
        return;
      }
      if (outcome?.status === "saved" || outcome?.status === "unchanged") {
        setState("done");
        toast.success(t("grid.toast", { name: role.label }));
        return;
      }
      setState("idle");
      setRefusal(refusals(result?.serverError ?? "unexpected"));
    });

  const toggle = (key: PermissionKey, on: boolean) => {
    setHeld((current) => {
      const next = new Set(current);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
    setRefusal(undefined);
    setState("idle");
  };

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="rounded-xl border bg-card shadow-xs"
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!step.confirm() && dirty) save();
        }}
      >
        <div className={cn("px-5 pt-5 sm:px-6", role.system && "pb-5")}>
          <h2 id={`${id}-title`} className="font-medium text-base">
            {t("grid.title")}
          </h2>
          <p className="mt-1 max-w-prose text-pretty text-muted-foreground text-sm">
            {role.system ? t("grid.system") : t("grid.description")}
          </p>
        </div>
        {role.system ? null : (
          <div className="mt-4 flex flex-col">
            {areas.map(({ area, keys }) => (
              <fieldset key={area} className="border-t px-5 py-4 sm:px-6">
                <legend className="sr-only">{t(`areas.${area}`)}</legend>
                <p
                  aria-hidden
                  className="mb-2 font-medium text-muted-foreground text-xs"
                >
                  {t(`areas.${area}`)}
                </p>
                <ul className="flex flex-col gap-1">
                  {keys.map(({ key, twoFactor }) => {
                    const labelId = `${id}-${key}`;
                    return (
                      <li
                        key={key}
                        className="flex items-start justify-between gap-4 py-2"
                      >
                        <div className="min-w-0">
                          <p id={labelId} className="font-medium text-sm">
                            {t(`permissions.${key}.label`)}
                          </p>
                          <p
                            id={`${labelId}-description`}
                            className="mt-0.5 text-pretty text-muted-foreground text-sm"
                          >
                            {t(`permissions.${key}.description`)}
                            {twoFactor ? (
                              <span className="ms-1.5 inline-flex items-center gap-1 text-xs">
                                <ShieldCheck aria-hidden className="size-3.5" />
                                {t("grid.twoFactor")}
                              </span>
                            ) : null}
                          </p>
                        </div>
                        <Switch
                          checked={held.has(key)}
                          onCheckedChange={(on) => toggle(key, on)}
                          disabled={state === "running"}
                          aria-labelledby={labelId}
                          aria-describedby={`${labelId}-description`}
                        />
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            ))}
          </div>
        )}
        {role.system ||
        !(dirty || state !== "idle" || step.asking || refusal) ? null : (
          <div className="flex flex-col gap-3 border-t px-5 py-4 sm:px-6">
            {step.field(t("grid.reauth"))}
            {refusal ? (
              <p role="alert" className="text-alert text-sm">
                {refusal}
              </p>
            ) : null}
            {dirty || state !== "idle" || step.asking ? (
              <div className="flex justify-end">
                <ActionSwapButton
                  type="submit"
                  disabled={state === "running"}
                  value={
                    state === "running"
                      ? "saving"
                      : step.asking
                        ? "confirm"
                        : state === "done"
                          ? "saved"
                          : "save"
                  }
                  items={[
                    { id: "save", label: t("grid.save"), icon: <Save /> },
                    {
                      id: "saving",
                      label: step.asking
                        ? step.words.confirming
                        : t("grid.saving"),
                      icon: <LoaderCircle className="animate-spin" />,
                    },
                    { id: "saved", label: t("grid.saved"), icon: <Check /> },
                    {
                      id: "confirm",
                      label: step.words.submit,
                      icon: <ShieldCheck />,
                    },
                  ]}
                />
              </div>
            ) : null}
          </div>
        )}
      </form>
    </section>
  );
}

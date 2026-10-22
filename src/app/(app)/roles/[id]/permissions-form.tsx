"use client";

import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/motion/switch";
import { usePasswordStep } from "@/components/password-step";
import { SaveActions, useSaveState } from "@/components/save-actions";
import { cn } from "@/components/ui/cn";
import type { PermissionArea, PermissionKey } from "@/modules/access";
import { setRolePermissionsAction } from "../actions.ts";

export type GridArea = {
  area: PermissionArea;
  keys: { key: PermissionKey; twoFactor: boolean }[];
};

// The role's column of the grid: a switch per key, grouped by area, saved together. The system role
// holds every key, so its switches are on and cannot be changed. While the grid has changes, its
// foot stays in view above the tab bar, with how many keys changed. A key that requires two-factor
// says so only while the college requires it (ADR-0014).
export function PermissionsForm({
  role,
  areas,
  twoFactorRequired,
}: {
  role: {
    id: string;
    label: string;
    system: boolean;
    permissions: PermissionKey[];
  };
  areas: GridArea[];
  twoFactorRequired: boolean;
}) {
  const t = useTranslations("roles");
  const refusals = useTranslations("actions");
  const id = useId();
  const [held, setHeld] = useState(() => new Set(role.permissions));
  const [refusal, setRefusal] = useState<string>();
  const [state, setState] = useSaveState();
  const [, startTransition] = useTransition();
  const step = usePasswordStep();
  const changed =
    [...held].filter((key) => !role.permissions.includes(key)).length +
    role.permissions.filter((key) => !held.has(key)).length;
  const dirty = changed > 0;

  const save = (password?: string) =>
    startTransition(async () => {
      setState("saving");
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
        setState("saved");
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
                <ul className="flex max-w-3xl flex-col gap-1">
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
                            {twoFactor && twoFactorRequired ? (
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
                          disabled={state === "saving"}
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
          <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+6rem)] z-10 flex flex-col gap-3 rounded-b-xl border-t bg-card px-5 py-4 shadow-sm sm:px-6 lg:bottom-4">
            {step.field(t("grid.reauth"))}
            {refusal ? (
              <p role="alert" className="text-alert text-sm">
                {refusal}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p aria-live="polite" className="text-muted-foreground text-sm">
                {dirty ? t("grid.changed", { count: changed }) : null}
              </p>
              <SaveActions
                dirty={dirty}
                state={state}
                asking={step.asking}
                onDiscard={() => {
                  setHeld(new Set(role.permissions));
                  step.cancel();
                  setRefusal(undefined);
                }}
                words={{
                  save: t("grid.save"),
                  saving: t("grid.saving"),
                  ...step.words,
                  confirm: step.words.submit,
                }}
              />
            </div>
          </div>
        )}
      </form>
    </section>
  );
}

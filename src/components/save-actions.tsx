"use client";

import { Check, LoaderCircle, Save, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useState } from "react";
import { ActionSwapButton } from "@/components/motion/action-swap";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

export type SaveState = "idle" | "saving" | "saved";

// A save's state, which falls back from "saved" to idle after a moment.
export function useSaveState() {
  const [state, setState] = useState<SaveState>("idle");
  useEffect(() => {
    if (state !== "saved") return;
    const timer = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [state]);
  return [state, setState] as const;
}

// The foot of a form that edits a record, alike on every screen (docs/design/beui-map.md,
// "Patterns"): nothing while the record is as saved; once something changed, Save beside Discard,
// Save confirming the password while it is asked again; after a save, "Saved" for a moment. The
// form submits on Save.
export function SaveActions({
  dirty,
  state,
  asking = false,
  disabled = false,
  onDiscard,
  words,
  icon = <Save />,
  className,
}: {
  dirty: boolean;
  state: SaveState;
  // The password is asked again before the save (usePasswordStep).
  asking?: boolean;
  // A change that cannot be saved as it is.
  disabled?: boolean;
  onDiscard: () => void;
  words: {
    save: string;
    saving: string;
    confirm?: string;
    confirming?: string;
  };
  icon?: ReactNode;
  className?: string;
}) {
  const ui = useTranslations("ui");
  if (!dirty && state === "idle" && !asking) return null;
  return (
    <div
      className={cn("flex flex-wrap items-center justify-end gap-2", className)}
    >
      {dirty && state !== "saving" ? (
        <Button type="button" variant="ghost" onClick={onDiscard}>
          {ui("discard")}
        </Button>
      ) : null}
      <ActionSwapButton
        type="submit"
        disabled={state === "saving" || disabled}
        value={
          state === "saving"
            ? "saving"
            : asking
              ? "confirm"
              : state === "saved"
                ? "saved"
                : "save"
        }
        items={[
          { id: "save", label: words.save, icon },
          {
            id: "saving",
            label: asking && words.confirming ? words.confirming : words.saving,
            icon: <LoaderCircle className="animate-spin" />,
          },
          { id: "saved", label: ui("saved"), icon: <Check /> },
          {
            id: "confirm",
            label: words.confirm ?? words.save,
            icon: <ShieldCheck />,
          },
        ]}
      />
    </div>
  );
}

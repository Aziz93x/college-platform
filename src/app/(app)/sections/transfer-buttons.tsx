"use client";

import { Check, LoaderCircle, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionSwapButton } from "@/components/motion/action-swap";
import { BottomSheet } from "@/components/motion/bottom-sheet";
import { Button } from "@/components/ui/button";
import { cancelTransferAction, keepTransferAction } from "./actions.ts";

// Keeping a transfer that a newer SS01 is in conflict with: it holds again until the next one.
export function KeepTransferButton({ id }: { id: string }) {
  const t = useTranslations("sections.transfers");
  const refusals = useTranslations("actions");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string>();
  const [, startTransition] = useTransition();

  const keep = () =>
    startTransition(async () => {
      setRunning(true);
      setError(undefined);
      const result = await keepTransferAction({ id });
      setRunning(false);
      const status = result?.data?.status;
      if (status === "kept") toast.success(t("kept"));
      else if (status === "notConflict") setError(t("notConflict"));
      else if (status) setError(t("gone"));
      else setError(refusals(result?.serverError ?? "unexpected"));
    });

  return (
    <div className="flex flex-col gap-1">
      <ActionSwapButton
        type="button"
        variant="ghost"
        onClick={keep}
        disabled={running}
        value={running ? "running" : "idle"}
        items={[
          { id: "idle", label: t("keep"), icon: <Check /> },
          {
            id: "running",
            label: t("keeping"),
            icon: <LoaderCircle className="animate-spin" />,
          },
        ]}
      />
      {error ? (
        <p role="alert" className="text-alert text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// Cancelling a transfer, confirmed in a sheet as every change others feel is: the section's
// trainers are Rayat's again from its week, and the sheet's button says to whom it goes back.
export function CancelTransferButton({
  id,
  sectionRef,
  from,
}: {
  id: string;
  sectionRef: string;
  /** The trainer the section was transferred from, by name. */
  from: string;
}) {
  const t = useTranslations("sections.transfers");
  const ui = useTranslations("ui");
  const refusals = useTranslations("actions");
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string>();
  const [, startTransition] = useTransition();

  const cancel = () =>
    startTransition(async () => {
      setRunning(true);
      setError(undefined);
      const result = await cancelTransferAction({ id });
      setRunning(false);
      const status = result?.data?.status;
      if (status === "cancelled") {
        toast.success(t("cancel.done"));
        setOpen(false);
      } else if (status) setError(t("gone"));
      else setError(refusals(result?.serverError ?? "unexpected"));
    });

  return (
    <>
      <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
        <X aria-hidden />
        {t("cancel.button")}
      </Button>
      {open ? (
        <BottomSheet
          open
          onOpenChange={(next) => {
            if (!next) setOpen(false);
          }}
          snapPoints={["auto"]}
          title={t("cancel.title", { ref: sectionRef })}
          description={t("cancel.description")}
          closeLabel={ui("close")}
        >
          <div className="flex flex-col gap-4 pt-2 pb-2">
            {error ? (
              <p role="alert" className="text-alert text-sm">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <ActionSwapButton
                type="button"
                onClick={cancel}
                disabled={running}
                value={running ? "running" : "idle"}
                items={[
                  {
                    id: "idle",
                    label: t("cancel.confirm", { from }),
                    icon: <X />,
                  },
                  {
                    id: "running",
                    label: t("cancel.running"),
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
          </div>
        </BottomSheet>
      ) : null}
    </>
  );
}

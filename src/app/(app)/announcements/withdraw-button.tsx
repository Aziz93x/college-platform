"use client";

import { LoaderCircle, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionSwapButton } from "@/components/motion/action-swap";
import { BottomSheet } from "@/components/motion/bottom-sheet";
import { Button } from "@/components/ui/button";
import { withdrawAnnouncementAction } from "./actions.ts";

// Withdrawing an announcement, confirmed in a sheet as every change others feel is: it leaves every
// bell and center it reached, read or not (ADR-0017).
export function WithdrawButton({ id, title }: { id: string; title: string }) {
  const t = useTranslations("announcements");
  const ui = useTranslations("ui");
  const refusals = useTranslations("actions");
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string>();
  const [, startTransition] = useTransition();

  const withdraw = () =>
    startTransition(async () => {
      setRunning(true);
      setError(undefined);
      const result = await withdrawAnnouncementAction({ id });
      setRunning(false);
      switch (result?.data?.status) {
        case "withdrawn":
          toast.success(t("withdraw.done"));
          setOpen(false);
          return;
        case "notFound":
          setError(t("withdraw.gone"));
          return;
        default:
          setError(refusals(result?.serverError ?? "unexpected"));
      }
    });

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        aria-label={t("list.withdrawLabel", { title })}
        onClick={() => setOpen(true)}
      >
        <Undo2 aria-hidden />
        {t("list.withdraw")}
      </Button>
      {open ? (
        <BottomSheet
          open
          onOpenChange={(next) => {
            if (!next) setOpen(false);
          }}
          snapPoints={["auto"]}
          title={t("withdraw.title", { title })}
          description={t("withdraw.description")}
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
                onClick={withdraw}
                disabled={running}
                value={running ? "running" : "idle"}
                items={[
                  {
                    id: "idle",
                    label: t("withdraw.confirm"),
                    icon: <Undo2 />,
                  },
                  {
                    id: "running",
                    label: t("withdraw.withdrawing"),
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

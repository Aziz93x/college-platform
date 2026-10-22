"use client";

import { Check, LoaderCircle, Undo2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionSwapButton } from "@/components/motion/action-swap";
import { BottomSheet } from "@/components/motion/bottom-sheet";
import { Button } from "@/components/ui/button";
import {
  applyRayatAction,
  discardRayatAction,
  rollbackRayatAction,
} from "./actions.ts";

type Running = "apply" | "discard" | null;

// Applying an upload waiting on the page, whose diff is right above, or discarding it.
export function PendingButtons({ importId }: { importId: string }) {
  const t = useTranslations("rayat.pending");
  const refusals = useTranslations("actions");
  const [running, setRunning] = useState<Running>(null);
  const [error, setError] = useState<string>();
  const [, startTransition] = useTransition();

  const run = (action: Exclude<Running, null>) =>
    startTransition(async () => {
      setRunning(action);
      setError(undefined);
      const result =
        action === "apply"
          ? await applyRayatAction({ importId })
          : await discardRayatAction({ importId });
      setRunning(null);
      switch (result?.data?.status) {
        case "applied":
        case "discarded":
          toast.success(t(result.data.status));
          return;
        case "notPending":
        case "termClosed":
          setError(t("gone"));
          return;
        default:
          setError(refusals(result?.serverError ?? "unexpected"));
      }
    });

  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <p role="alert" className="text-alert text-sm">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <ActionSwapButton
          type="button"
          variant="ghost"
          onClick={() => run("discard")}
          disabled={running !== null}
          value={running === "discard" ? "running" : "idle"}
          items={[
            { id: "idle", label: t("discard"), icon: <X /> },
            {
              id: "running",
              label: t("discarding"),
              icon: <LoaderCircle className="animate-spin" />,
            },
          ]}
        />
        <ActionSwapButton
          type="button"
          onClick={() => run("apply")}
          disabled={running !== null}
          value={running === "apply" ? "running" : "idle"}
          items={[
            { id: "idle", label: t("apply"), icon: <Check /> },
            {
              id: "running",
              label: t("applying"),
              icon: <LoaderCircle className="animate-spin" />,
            },
          ]}
        />
      </div>
    </div>
  );
}

// Rolling back the version in force, confirmed in a sheet as every change others feel is: the
// version before it comes back for everyone.
export function RollbackButton({
  importId,
  report,
}: {
  importId: string;
  report: string;
}) {
  const t = useTranslations("rayat.rollback");
  const ui = useTranslations("ui");
  const refusals = useTranslations("actions");
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string>();
  const [, startTransition] = useTransition();

  const rollback = () =>
    startTransition(async () => {
      setRunning(true);
      setError(undefined);
      const result = await rollbackRayatAction({ importId });
      setRunning(false);
      switch (result?.data?.status) {
        case "rolledBack":
          toast.success(t("done"));
          setOpen(false);
          return;
        case "notCurrent":
        case "termClosed":
          setError(t("gone"));
          return;
        default:
          setError(refusals(result?.serverError ?? "unexpected"));
      }
    });

  return (
    <>
      <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
        <Undo2 aria-hidden />
        {t("button")}
      </Button>
      {open ? (
        <BottomSheet
          open
          onOpenChange={(next) => {
            if (!next) setOpen(false);
          }}
          snapPoints={["auto"]}
          title={t("title", { report })}
          description={t("description")}
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
                onClick={rollback}
                disabled={running}
                value={running ? "running" : "idle"}
                items={[
                  { id: "idle", label: t("confirm"), icon: <Undo2 /> },
                  {
                    id: "running",
                    label: t("running"),
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

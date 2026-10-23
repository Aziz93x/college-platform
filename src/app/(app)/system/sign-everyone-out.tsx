"use client";

import { LoaderCircle, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionSwapButton } from "@/components/motion/action-swap";
import { BottomSheet } from "@/components/motion/bottom-sheet";
import { usePasswordStep } from "@/components/password-step";
import { Button } from "@/components/ui/button";
import { revokeEveryoneAction } from "./actions.ts";

// Signs everyone of the college out but the viewer's own session, after a leaked password or lost
// devices (ADR-0029), in a sheet that says so and asks for the password again when it is due.
export function SignEveryoneOut() {
  const t = useTranslations("system.sessions.everyone");
  const system = useTranslations("system");
  const ui = useTranslations("ui");
  const refusals = useTranslations("actions");
  const step = usePasswordStep();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string>();
  const [, startTransition] = useTransition();
  const close = () => {
    setOpen(false);
    setError(undefined);
    step.cancel();
  };

  const run = (password?: string) =>
    startTransition(async () => {
      setRunning(true);
      setError(undefined);
      const result = await revokeEveryoneAction({ password });
      setRunning(false);
      const outcome = result?.data;
      if (step.handled(outcome, run)) return;
      if (outcome?.status === "revoked") {
        toast.success(t("done", { count: outcome.count }));
        close();
        return;
      }
      setError(refusals(result?.serverError ?? "unexpected"));
    });

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <LogOut aria-hidden />
        {t("button")}
      </Button>
      {open ? (
        <BottomSheet
          open
          onOpenChange={(next) => {
            if (!next) close();
          }}
          snapPoints={["auto"]}
          title={t("title")}
          description={t("description")}
          closeLabel={ui("close")}
        >
          <form
            noValidate
            className="flex flex-col gap-4 pt-2 pb-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!step.confirm()) run();
            }}
          >
            {step.field(system("reauth"))}
            {error ? (
              <p role="alert" className="text-alert text-sm">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <ActionSwapButton
                type="submit"
                disabled={running}
                value={running ? "running" : step.asking ? "confirm" : "idle"}
                items={[
                  { id: "idle", label: t("confirm"), icon: <LogOut /> },
                  {
                    id: "running",
                    label: step.asking
                      ? step.words.confirming
                      : t("confirming"),
                    icon: <LoaderCircle className="animate-spin" />,
                  },
                  { id: "confirm", label: step.words.submit },
                ]}
              />
              <Button type="button" variant="ghost" onClick={close}>
                {ui("cancel")}
              </Button>
            </div>
          </form>
        </BottomSheet>
      ) : null}
    </>
  );
}

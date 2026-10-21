"use client";

import { LoaderCircle, ShieldOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionSwapButton } from "@/components/motion/action-swap";
import { BottomSheet } from "@/components/motion/bottom-sheet";
import { Input } from "@/components/motion/input";
import { Button } from "@/components/ui/button";
import { turnOffOwnTwoFactorAction } from "./actions.ts";

// Turning one's own two-factor off (ADR-0014): a sheet that asks for the password, which counts
// toward the lockout as at sign-in, and a toast once it is off; the page then offers to turn it on.
export function TurnOffTwoFactor() {
  const t = useTranslations("profile.twoFactorTurnOff");
  const reauth = useTranslations("reauth");
  const refusals = useTranslations("actions");
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [running, startTransition] = useTransition();

  const close = () => {
    setOpen(false);
    setPassword("");
    setError(undefined);
  };

  const submit = () => {
    if (!password) {
      setError(reauth("required"));
      return;
    }
    startTransition(async () => {
      const result = await turnOffOwnTwoFactorAction({ password });
      const outcome = result?.data;
      switch (outcome?.status) {
        case "off":
        case "notOn":
          toast.success(t("done"));
          close();
          return;
        case "wrongPassword":
          setPassword("");
          setError(reauth("wrong"));
          return;
        case "locked":
          setPassword("");
          setError(reauth("locked", { minutes: outcome.minutes }));
          return;
        case "required":
          setError(t("required"));
          return;
        default:
          setError(refusals(result?.serverError ?? "unexpected"));
      }
    });
  };

  return (
    <>
      <Button variant="outline" className="h-11" onClick={() => setOpen(true)}>
        <ShieldOff aria-hidden />
        {t("open")}
      </Button>
      <BottomSheet
        open={open}
        onOpenChange={(next) => {
          if (!next) close();
        }}
        snapPoints={["auto"]}
        title={t("title")}
        description={t("description")}
        closeLabel={t("close")}
      >
        <form
          noValidate
          className="flex flex-col gap-4 pt-2 pb-2"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Input
            type="password"
            label={reauth("password")}
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(text) => {
              setPassword(text);
              setError(undefined);
            }}
            error={error}
            className="w-full sm:max-w-sm"
          />
          <ActionSwapButton
            type="submit"
            disabled={running}
            className="self-start"
            value={running ? "running" : "idle"}
            items={[
              { id: "idle", label: t("confirm"), icon: <ShieldOff /> },
              {
                id: "running",
                label: t("confirming"),
                icon: <LoaderCircle className="animate-spin" />,
              },
            ]}
          />
        </form>
      </BottomSheet>
    </>
  );
}

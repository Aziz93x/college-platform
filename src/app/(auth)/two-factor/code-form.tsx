"use client";

import { KeyRound, Smartphone } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Input } from "@/components/motion/input";
import { Button } from "@/components/ui/button";
import { verifyCodeAction } from "../actions.ts";
import { RefusalAlert, SubmitButton, useLeaveTo } from "../form-parts.tsx";

export function CodeForm() {
  const t = useTranslations("auth.twoFactor");
  const actions = useTranslations("actions");
  const [state, formAction, pending] = useActionState(verifyCodeAction, {});
  const [backup, setBackup] = useState(false);

  const status = state.data?.status;
  const destination = status === "signedIn" ? "/today" : undefined;
  useLeaveTo(destination);
  const refusal =
    status === "invalid" || status === "locked" || status === "expired"
      ? { title: t(`${status}.title`), description: t(`${status}.description`) }
      : state.serverError
        ? { description: actions(state.serverError) }
        : undefined;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <p className="mt-1 text-muted-foreground text-sm">
        {backup ? t("backupDescription") : t("description")}
      </p>
      <RefusalAlert open={refusal !== undefined} {...refusal}>
        {status === "expired" ? (
          <Link
            href="/"
            className="inline-block pt-1 font-medium text-alert underline underline-offset-4"
          >
            {t("restart")}
          </Link>
        ) : null}
      </RefusalAlert>
      <Input
        // A new field for the other kind of code, so the browser's suggestions fit each one.
        key={backup ? "backup" : "app"}
        name="code"
        label={backup ? t("backupCode") : t("code")}
        error={state.validationErrors?.code ? t("required") : undefined}
        startIcon={backup ? <KeyRound /> : <Smartphone />}
        inputMode={backup ? "text" : "numeric"}
        autoComplete={backup ? "off" : "one-time-code"}
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="go"
        maxLength={backup ? 16 : 6}
        className="[&_input]:text-center [&_input]:text-lg [&_input]:tracking-[0.3em] [&_input]:tabular-nums"
        required
        autoFocus
      />
      {backup ? <input type="hidden" name="backup" value="on" /> : null}
      <SubmitButton
        pending={pending || destination !== undefined}
        label={t("submit")}
        pendingLabel={t("submitting")}
      />
      <Button
        type="button"
        variant="link"
        onClick={() => setBackup((current) => !current)}
        className="h-auto self-center p-0"
      >
        {backup ? t("useApp") : t("useBackup")}
      </Button>
    </form>
  );
}

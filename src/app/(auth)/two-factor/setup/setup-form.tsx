"use client";

import { LockKeyhole, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Input } from "@/components/motion/input";
import { QrCode } from "@/components/qr-code";
import {
  confirmTwoFactorSetupAction,
  startTwoFactorSetupAction,
} from "../../actions.ts";
import { RefusalAlert, SubmitButton } from "../../form-parts.tsx";

// The key in groups of four, as authenticator apps show it; spaces are ignored where it is typed.
const inGroups = (key: string) => key.match(/.{1,4}/g)?.join(" ") ?? key;

// First the password again, then the app: scan the code or type the key, keep the backup codes,
// and confirm with the first code the app shows, whose action sends the person on.
export function SetupForm() {
  const t = useTranslations("auth.twoFactorSetup");
  const signIn = useTranslations("auth.signIn");
  const actions = useTranslations("actions");
  const [started, startAction, starting] = useActionState(
    startTwoFactorSetupAction,
    {},
  );
  const [confirmed, confirmAction, confirming] = useActionState(
    confirmTwoFactorSetupAction,
    {},
  );
  const setup = started.data?.status === "started" ? started.data : undefined;
  // Too many wrong passwords: the account is locked and signed out everywhere.
  const locked = started.data?.status === "locked" ? started.data : undefined;

  if (!setup) {
    return (
      <form
        action={startAction}
        noValidate
        className="mt-6 flex flex-col gap-4"
      >
        <RefusalAlert
          open={Boolean(started.serverError || locked)}
          title={locked ? signIn("locked.title") : undefined}
          description={
            locked
              ? signIn("locked.description", { minutes: locked.minutes })
              : started.serverError
                ? actions(started.serverError)
                : undefined
          }
        />
        <Input
          name="password"
          type="password"
          label={t("password")}
          hint={t("passwordHint")}
          error={
            started.data?.status === "wrongPassword"
              ? t("wrongPassword")
              : started.validationErrors?.password
                ? t("passwordRequired")
                : undefined
          }
          startIcon={<LockKeyhole />}
          autoComplete="current-password"
          required
        />
        <SubmitButton
          pending={starting}
          label={t("start")}
          pendingLabel={t("starting")}
        />
      </form>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-7">
      <section className="flex flex-col gap-3">
        <h3 className="font-medium">{t("scan")}</h3>
        <QrCode
          value={setup.uri}
          label={t("qr")}
          className="size-48 self-center rounded-lg border bg-background p-1"
        />
        <p className="text-muted-foreground text-sm">{t("manual")}</p>
        <code
          dir="ltr"
          className="select-all break-all rounded-md bg-muted/60 px-3 py-2 text-center font-mono text-sm tracking-wide"
        >
          {inGroups(setup.secret)}
        </code>
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="font-medium">{t("backupTitle")}</h3>
        <p className="text-muted-foreground text-sm">
          {t("backupDescription")}
        </p>
        <ul
          dir="ltr"
          className="grid select-all grid-cols-2 gap-2 rounded-lg border p-3 font-mono text-sm"
        >
          {setup.backupCodes.map((code) => (
            <li key={code} className="text-center">
              {code}
            </li>
          ))}
        </ul>
      </section>
      <form action={confirmAction} noValidate className="flex flex-col gap-4">
        <RefusalAlert
          open={Boolean(confirmed.serverError)}
          description={
            confirmed.serverError ? actions(confirmed.serverError) : undefined
          }
        />
        <Input
          name="code"
          label={t("code")}
          error={
            confirmed.data?.status === "invalid"
              ? t("invalid")
              : confirmed.validationErrors?.code
                ? t("codeRequired")
                : undefined
          }
          startIcon={<Smartphone />}
          inputMode="numeric"
          autoComplete="one-time-code"
          enterKeyHint="go"
          maxLength={6}
          className="[&_input]:text-center [&_input]:text-lg [&_input]:tracking-[0.3em] [&_input]:tabular-nums"
          required
        />
        <SubmitButton
          pending={confirming}
          label={t("confirm")}
          pendingLabel={t("confirming")}
        />
      </form>
    </div>
  );
}

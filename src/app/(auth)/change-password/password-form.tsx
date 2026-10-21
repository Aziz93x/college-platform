"use client";

import { LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Input } from "@/components/motion/input";
import { Button } from "@/components/ui/button";
import { changePasswordAction } from "../actions.ts";
import { RefusalAlert, SubmitButton, useLeaveTo } from "../form-parts.tsx";

// The current password, then the new one twice; then the next page (`done`) loads from scratch. A
// change the person chose may be cancelled back to `cancelHref`; a forced one may not.
export function PasswordForm({
  minLength,
  done,
  cancelHref,
}: {
  minLength: number;
  done: string;
  cancelHref?: string;
}) {
  const t = useTranslations("auth.changePassword");
  const ui = useTranslations("ui");
  const signIn = useTranslations("auth.signIn");
  const actions = useTranslations("actions");
  const [state, formAction, pending] = useActionState(changePasswordAction, {});
  const status = state.data?.status;
  const missing = state.validationErrors;
  const destination = status === "changed" ? done : undefined;
  useLeaveTo(destination);
  const length = { minLength };
  // Too many wrong current passwords: the account is locked and signed out everywhere.
  const locked = state.data?.status === "locked" ? state.data : undefined;

  const newPasswordError =
    status === "tooShort"
      ? t("tooShort", length)
      : status === "unchanged"
        ? t("unchanged")
        : missing?.newPassword
          ? t("newRequired")
          : undefined;

  return (
    <form action={formAction} noValidate className="mt-6 flex flex-col gap-4">
      <RefusalAlert
        open={Boolean(state.serverError || locked)}
        title={locked ? signIn("locked.title") : undefined}
        description={
          locked
            ? signIn("locked.description", { minutes: locked.minutes })
            : state.serverError
              ? actions(state.serverError)
              : undefined
        }
      />
      <Input
        name="currentPassword"
        type="password"
        label={t("current")}
        error={
          status === "wrongPassword"
            ? t("wrongPassword")
            : missing?.currentPassword
              ? t("currentRequired")
              : undefined
        }
        startIcon={<LockKeyhole />}
        autoComplete="current-password"
        required
      />
      <Input
        name="newPassword"
        type="password"
        label={t("new")}
        hint={t("newHint", length)}
        error={newPasswordError}
        startIcon={<LockKeyhole />}
        autoComplete="new-password"
        minLength={minLength}
        required
      />
      <Input
        name="confirmPassword"
        type="password"
        label={t("confirm")}
        error={
          missing?.confirmPassword && !missing.newPassword
            ? t("mismatch")
            : undefined
        }
        startIcon={<LockKeyhole />}
        autoComplete="new-password"
        required
      />
      <SubmitButton
        pending={pending || destination !== undefined}
        label={t("submit")}
        pendingLabel={t("submitting")}
      />
      {cancelHref ? (
        <Button asChild variant="ghost" className="h-11">
          <Link href={cancelHref}>{ui("cancel")}</Link>
        </Button>
      ) : null}
    </form>
  );
}

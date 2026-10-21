"use client";

import { LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Input } from "@/components/motion/input";
import { Button } from "@/components/ui/button";
import { changePasswordAction } from "../actions.ts";
import { RefusalAlert, SubmitButton, useLeaveTo } from "../form-parts.tsx";

export function PasswordForm({
  minLength,
  canCancel,
}: {
  minLength: number;
  canCancel: boolean;
}) {
  const t = useTranslations("auth.changePassword");
  const actions = useTranslations("actions");
  const [state, formAction, pending] = useActionState(changePasswordAction, {});
  const status = state.data?.status;
  const missing = state.validationErrors;
  const destination = status === "changed" ? "/today" : undefined;
  useLeaveTo(destination);
  const length = { minLength, count: String(minLength) };

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
        open={Boolean(state.serverError)}
        description={state.serverError ? actions(state.serverError) : undefined}
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
        dir="auto"
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
        dir="auto"
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
        dir="auto"
        required
      />
      <SubmitButton
        pending={pending || destination !== undefined}
        label={t("submit")}
        pendingLabel={t("submitting")}
      />
      {canCancel ? (
        <Button asChild variant="ghost" className="h-11">
          <Link href="/today">{t("cancel")}</Link>
        </Button>
      ) : null}
    </form>
  );
}

"use client";

import { Eye, EyeOff, IdCard, LockKeyhole } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";
import { Checkbox } from "@/components/motion/checkbox";
import { Input } from "@/components/motion/input";
import { signInAction } from "./actions.ts";
import { RefusalAlert, SubmitButton, useLeaveTo } from "./form-parts.tsx";

export function SignInForm({ rememberDays }: { rememberDays: number }) {
  const t = useTranslations("auth.signIn");
  const actions = useTranslations("actions");
  const [state, formAction, pending] = useActionState(signInAction, {});
  // Controlled, so a refused attempt keeps what was typed; the password field empties itself.
  const [identifier, setIdentifier] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  const result = state.data;
  const missing = state.validationErrors;
  const destination =
    result?.status === "signedIn"
      ? "/today"
      : result?.status === "twoFactor"
        ? "/two-factor"
        : undefined;
  useLeaveTo(destination);
  const refusal =
    result?.status === "invalid"
      ? { title: t("invalid.title"), description: t("invalid.description") }
      : result?.status === "locked" || result?.status === "throttled"
        ? {
            title: t(`${result.status}.title`),
            description: t(`${result.status}.description`, {
              minutes: result.minutes,
              count: String(result.minutes),
            }),
          }
        : state.serverError
          ? { description: actions(state.serverError) }
          : undefined;

  // After a wrong password, the cursor waits in the emptied password field.
  useEffect(() => {
    if (result?.status === "invalid") passwordRef.current?.focus();
  }, [result]);

  return (
    <form action={formAction} noValidate className="mt-6 flex flex-col gap-4">
      <RefusalAlert open={refusal !== undefined} {...refusal} />
      <Input
        name="identifier"
        label={t("identifier")}
        value={identifier}
        onChange={setIdentifier}
        error={missing?.identifier ? t("identifierRequired") : undefined}
        startIcon={<IdCard />}
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="next"
        required
      />
      <Input
        ref={passwordRef}
        name="password"
        type={showPassword ? "text" : "password"}
        label={t("password")}
        error={missing?.password ? t("passwordRequired") : undefined}
        startIcon={<LockKeyhole />}
        endSlot={
          <button
            type="button"
            aria-label={showPassword ? t("hidePassword") : t("showPassword")}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((shown) => !shown)}
            className="rounded-md outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          >
            {showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </button>
        }
        autoComplete="current-password"
        enterKeyHint="go"
        required
      />
      <Checkbox
        name="remember"
        checked={remember}
        onCheckedChange={setRemember}
        label={t("remember")}
        description={t("rememberHint", {
          days: rememberDays,
          count: String(rememberDays),
        })}
      />
      <SubmitButton
        pending={pending || destination !== undefined}
        label={t("submit")}
        pendingLabel={t("submitting")}
      />
    </form>
  );
}

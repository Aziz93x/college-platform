"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Input } from "@/components/motion/input";

type Outcome = { status: string; minutes?: number } | undefined;

// The password asked again before a change to someone's access, in the card that makes the change:
// the server says when it is due, the card shows the field, and the change runs again with what is
// typed. A wrong password counts toward the lockout, as at sign-in.
export function usePasswordStep() {
  const t = useTranslations("reauth");
  const [retry, setRetry] = useState<((password: string) => void) | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();

  // True when the outcome was about the password; otherwise the step is over and the caller reads
  // the outcome.
  const handled = (outcome: Outcome, again: (password: string) => void) => {
    switch (outcome?.status) {
      case "passwordRequired":
        setRetry(() => again);
        setError(undefined);
        return true;
      case "wrongPassword":
        setPassword("");
        setError(t("wrong"));
        return true;
      case "locked":
        setRetry(null);
        setPassword("");
        setError(t("locked", { minutes: outcome.minutes ?? 0 }));
        return true;
      default:
        setRetry(null);
        setPassword("");
        setError(undefined);
        return false;
    }
  };

  // Runs the change waiting on the password; false while nothing waits.
  const confirm = () => {
    if (!retry) return false;
    if (password) retry(password);
    else setError(t("required"));
    return true;
  };

  const field = (description: string) =>
    retry ? (
      <Input
        type="password"
        label={t("password")}
        autoComplete="current-password"
        autoFocus
        value={password}
        onChange={(text) => {
          setPassword(text);
          setError(undefined);
        }}
        hint={description}
        error={error}
        className="w-full sm:max-w-sm"
      />
    ) : error ? (
      <p role="alert" className="text-alert text-sm">
        {error}
      </p>
    ) : null;

  return {
    asking: retry !== null,
    handled,
    confirm,
    field,
    cancel: () => setRetry(null),
    words: { submit: t("submit"), confirming: t("confirming") },
  };
}

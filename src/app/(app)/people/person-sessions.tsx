"use client";

import {
  KeyRound,
  LoaderCircle,
  LogOut,
  MonitorSmartphone,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionSwapButton } from "@/components/motion/action-swap";
import { BottomSheet } from "@/components/motion/bottom-sheet";
import { usePasswordStep } from "@/components/password-step";
import { Button } from "@/components/ui/button";
import {
  requirePasswordChangeAction,
  revokeAllSessionsAction,
  revokeSessionAction,
} from "./actions.ts";

// A session as the page sends it: its device and times already in words.
export type SessionRow = {
  id: string;
  device: string;
  address: string | null;
  signedIn: string;
  lastSeen: string;
  remembered: boolean;
};

type Action =
  | { kind: "revoke"; session: SessionRow }
  | { kind: "revokeAll" }
  | { kind: "requirePasswordChange" };

const icons: Record<Action["kind"], ReactNode> = {
  revoke: <LogOut />,
  revokeAll: <LogOut />,
  requirePasswordChange: <KeyRound />,
};

// Where someone is signed in, on their page (ADR-0029): each session's device, address, and when it
// signed in and was last seen, with ending one or all of them and requiring a new password. Each
// opens a sheet that confirms it and asks for the password again when it is due.
export function PersonSessions({
  person,
  sessions,
}: {
  person: { userId: string; name: string };
  sessions: SessionRow[];
}) {
  const t = useTranslations("people.sessions");
  const titleId = useId();
  const [open, setOpen] = useState<Action | null>(null);
  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-4 rounded-xl border bg-card px-5 py-5 shadow-xs sm:px-6"
    >
      <div>
        <h2 id={titleId} className="font-medium text-base">
          {t("title")}
        </h2>
        <p className="mt-1 text-muted-foreground text-sm">{t("description")}</p>
      </div>
      {sessions.length > 0 ? (
        <ul className="flex flex-col divide-y">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="flex min-w-0 items-start gap-3">
                <MonitorSmartphone
                  aria-hidden
                  className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                />
                <div className="min-w-0">
                  <p className="font-medium">{session.device}</p>
                  <p className="text-muted-foreground text-sm">
                    {[
                      session.address
                        ? t("address", { address: session.address })
                        : undefined,
                      t("signedIn", { date: session.signedIn }),
                      t("lastSeen", { date: session.lastSeen }),
                      session.remembered ? t("remembered") : undefined,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                aria-label={t("revoke.label", { device: session.device })}
                onClick={() => setOpen({ kind: "revoke", session })}
              >
                <LogOut aria-hidden />
                {t("revoke.button")}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      )}
      <div className="flex flex-wrap gap-3">
        {sessions.length > 1 ? (
          <Button
            variant="outline"
            onClick={() => setOpen({ kind: "revokeAll" })}
          >
            <LogOut aria-hidden />
            {t("revokeAll.button")}
          </Button>
        ) : null}
        <Button
          variant="outline"
          onClick={() => setOpen({ kind: "requirePasswordChange" })}
        >
          <KeyRound aria-hidden />
          {t("requirePasswordChange.button")}
        </Button>
      </div>
      {open ? (
        <SessionSheet
          action={open}
          person={person}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </section>
  );
}

function SessionSheet({
  action,
  person,
  onClose,
}: {
  action: Action;
  person: { userId: string; name: string };
  onClose: () => void;
}) {
  const t = useTranslations("people");
  const ui = useTranslations("ui");
  const refusals = useTranslations("actions");
  const step = usePasswordStep();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string>();
  const [, startTransition] = useTransition();
  const { name } = person;
  const words = (
    key:
      | "title"
      | "description"
      | "confirm"
      | "confirming"
      | "done"
      | "unchanged",
  ) =>
    t(`sessions.${action.kind}.${key}`, {
      name,
      device: action.kind === "revoke" ? action.session.device : "",
    });

  const run = (password?: string) =>
    startTransition(async () => {
      setRunning(true);
      setError(undefined);
      const input = { userId: person.userId, password };
      const result =
        action.kind === "revoke"
          ? await revokeSessionAction({
              ...input,
              sessionId: action.session.id,
            })
          : action.kind === "revokeAll"
            ? await revokeAllSessionsAction(input)
            : await requirePasswordChangeAction(input);
      setRunning(false);
      const outcome = result?.data;
      if (step.handled(outcome, run)) return;
      switch (outcome?.status) {
        case "revoked":
        case "saved":
          toast.success(words("done"));
          onClose();
          return;
        case "none":
        case "unchanged":
          toast.success(words("unchanged"));
          onClose();
          return;
        case "notFound":
          setError(t("gone"));
          return;
        default:
          setError(refusals(result?.serverError ?? "unexpected"));
      }
    });

  return (
    <BottomSheet
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      snapPoints={["auto"]}
      title={words("title")}
      description={words("description")}
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
        {step.field(t("reauth"))}
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
              { id: "idle", label: words("confirm"), icon: icons[action.kind] },
              {
                id: "running",
                label: step.asking
                  ? step.words.confirming
                  : words("confirming"),
                icon: <LoaderCircle className="animate-spin" />,
              },
              { id: "confirm", label: step.words.submit },
            ]}
          />
          <Button type="button" variant="ghost" onClick={onClose}>
            {ui("cancel")}
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}

"use client";

import { KeyRound, LoaderCircle, UserCheck, UserX } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionSwapButton } from "@/components/motion/action-swap";
import { BottomSheet } from "@/components/motion/bottom-sheet";
import {
  type OverflowActionItem,
  OverflowActions,
} from "@/components/motion/overflow-actions";
import { usePasswordStep } from "@/components/password-step";
import { disableAccountAction, resetPasswordAction } from "./actions.ts";
import { TemporaryPassword } from "./temporary-password.tsx";
import type { PersonView } from "./view.ts";

type Action = "reset" | "disable" | "enable";

// What the viewer may do to someone's account, behind a person's row and on their page: a temporary
// password, and disabling or enabling the account. Each opens a sheet that confirms it, asks for the
// password again when it is due, and shows the outcome.
export function AccountActions({ person }: { person: PersonView }) {
  const t = useTranslations("people.account");
  const [open, setOpen] = useState<Action | null>(null);
  const items: OverflowActionItem[] = [];
  if (person.can.reset) {
    items.push({
      id: "reset",
      label: t("reset"),
      icon: <KeyRound />,
      onClick: () => setOpen("reset"),
    });
  }
  if (person.can.disable) {
    items.push(
      person.state === "disabled"
        ? {
            id: "enable",
            label: t("enable"),
            icon: <UserCheck />,
            onClick: () => setOpen("enable"),
          }
        : {
            id: "disable",
            label: t("disable"),
            icon: <UserX />,
            onClick: () => setOpen("disable"),
          },
    );
  }
  if (items.length === 0) return null;
  return (
    <>
      <OverflowActions
        actions={items}
        openLabel={t("more", { name: person.name })}
        closeLabel={t("less")}
      />
      {open ? (
        <AccountSheet
          action={open}
          person={person}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </>
  );
}

function AccountSheet({
  action,
  person,
  onClose,
}: {
  action: Action;
  person: PersonView;
  onClose: () => void;
}) {
  const t = useTranslations("people");
  const refusals = useTranslations("actions");
  const step = usePasswordStep();
  const [running, setRunning] = useState(false);
  const [temporary, setTemporary] = useState<string>();
  const [error, setError] = useState<string>();
  const [, startTransition] = useTransition();
  const name = person.name;

  const run = (password?: string) =>
    startTransition(async () => {
      setRunning(true);
      setError(undefined);
      const result =
        action === "reset"
          ? await resetPasswordAction({ userId: person.userId, password })
          : await disableAccountAction({
              userId: person.userId,
              disabled: action === "disable",
              password,
            });
      setRunning(false);
      const outcome = result?.data;
      if (step.handled(outcome, run)) return;
      switch (outcome?.status) {
        case "reset":
          setTemporary(outcome.temporaryPassword);
          return;
        case "saved":
        case "unchanged":
          toast.success(
            t(`${action === "enable" ? "enable" : "disable"}.done`, { name }),
          );
          onClose();
          return;
        case "self":
          setError(t("disable.self"));
          return;
        case "lastAdmin":
          setError(t("disable.lastAdmin"));
          return;
        case "notFound":
          setError(t("gone"));
          return;
        default:
          setError(refusals(result?.serverError ?? "unexpected"));
      }
    });

  const words = {
    description: t(`${action}.description`),
    confirm: t(`${action}.confirm`),
    confirming: t(`${action}.confirming`),
  };
  return (
    <BottomSheet
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      snapPoints={["auto"]}
      title={t(`${action}.title`, { name })}
      description={words.description}
      closeLabel={t("account.close")}
    >
      <form
        noValidate
        className="flex flex-col gap-4 pt-2 pb-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!step.confirm()) run();
        }}
      >
        {temporary ? (
          <TemporaryPassword name={name} password={temporary} />
        ) : (
          <>
            {step.field(t("reauth"))}
            {error ? (
              <p role="alert" className="text-alert text-sm">
                {error}
              </p>
            ) : null}
            <ActionSwapButton
              type="submit"
              disabled={running}
              className="self-start"
              value={running ? "running" : step.asking ? "confirm" : "idle"}
              items={[
                {
                  id: "idle",
                  label: words.confirm,
                  icon:
                    action === "reset" ? (
                      <KeyRound />
                    ) : action === "disable" ? (
                      <UserX />
                    ) : (
                      <UserCheck />
                    ),
                },
                {
                  id: "running",
                  label: step.asking ? step.words.confirming : words.confirming,
                  icon: <LoaderCircle className="animate-spin" />,
                },
                { id: "confirm", label: step.words.submit },
              ]}
            />
          </>
        )}
      </form>
    </BottomSheet>
  );
}

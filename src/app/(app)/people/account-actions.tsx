"use client";

import {
  KeyRound,
  LoaderCircle,
  ShieldOff,
  UserCheck,
  UserX,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionSwapButton } from "@/components/motion/action-swap";
import { BottomSheet } from "@/components/motion/bottom-sheet";
import {
  type OverflowActionItem,
  OverflowActions,
} from "@/components/motion/overflow-actions";
import { usePasswordStep } from "@/components/password-step";
import { Button } from "@/components/ui/button";
import {
  disableAccountAction,
  resetPasswordAction,
  turnOffTwoFactorAction,
} from "./actions.ts";
import { TemporaryPassword } from "./temporary-password.tsx";
import type { PersonView } from "./view.ts";

type Action = "reset" | "turnOffTwoFactor" | "disable" | "enable";

const icons: Record<Action, ReactNode> = {
  reset: <KeyRound />,
  turnOffTwoFactor: <ShieldOff />,
  disable: <UserX />,
  enable: <UserCheck />,
};

// What the viewer may do to someone's account: a temporary password, turning their two-factor off,
// and disabling or enabling the account. Behind a person's row they wait under "…"; on the person's
// own page they are buttons in a card of their own. Each opens a sheet that confirms it, asks for
// the password again when it is due, and shows the outcome.
export function AccountActions({
  person,
  card = false,
}: {
  person: PersonView;
  card?: boolean;
}) {
  const t = useTranslations("people.account");
  const titleId = useId();
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
  if (person.can.turnOffTwoFactor) {
    items.push({
      id: "turnOffTwoFactor",
      label: t("turnOffTwoFactor"),
      icon: icons.turnOffTwoFactor,
      onClick: () => setOpen("turnOffTwoFactor"),
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
      {card ? (
        <section
          aria-labelledby={titleId}
          className="flex flex-col gap-4 rounded-xl border bg-card px-5 py-5 shadow-xs sm:px-6"
        >
          <h2 id={titleId} className="font-medium text-base">
            {t("title")}
          </h2>
          <div className="flex flex-wrap gap-3">
            {items.map((item) => (
              <Button key={item.id} variant="outline" onClick={item.onClick}>
                {item.icon}
                {item.label}
              </Button>
            ))}
          </div>
        </section>
      ) : (
        <OverflowActions
          actions={items}
          openLabel={t("more", { name: person.name })}
          closeLabel={t("less")}
        />
      )}
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
  const ui = useTranslations("ui");
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
          : action === "turnOffTwoFactor"
            ? await turnOffTwoFactorAction({ userId: person.userId, password })
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
        case "off":
        case "notOn":
          toast.success(t("turnOffTwoFactor.done", { name }));
          onClose();
          return;
        case "saved":
        case "unchanged":
          toast.success(
            t(`${action === "enable" ? "enable" : "disable"}.done`, { name }),
          );
          onClose();
          return;
        case "self":
          setError(t(`${action === "enable" ? "disable" : action}.self`));
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
            <div className="flex flex-wrap items-center gap-2">
              <ActionSwapButton
                type="submit"
                disabled={running}
                value={running ? "running" : step.asking ? "confirm" : "idle"}
                items={[
                  { id: "idle", label: words.confirm, icon: icons[action] },
                  {
                    id: "running",
                    label: step.asking
                      ? step.words.confirming
                      : words.confirming,
                    icon: <LoaderCircle className="animate-spin" />,
                  },
                  { id: "confirm", label: step.words.submit },
                ]}
              />
              <Button type="button" variant="ghost" onClick={onClose}>
                {ui("cancel")}
              </Button>
            </div>
          </>
        )}
      </form>
    </BottomSheet>
  );
}

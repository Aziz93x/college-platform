"use client";

import { Check, LoaderCircle, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionSwapButton } from "@/components/motion/action-swap";
import { Input } from "@/components/motion/input";
import { usePasswordStep } from "@/components/password-step";
import { toLatinDigits } from "@/platform/validation/digits";
import { oneLine } from "@/platform/validation/text";
import { linkEmployeeNumberAction, updatePersonAction } from "./actions.ts";
import type { PersonView } from "./view.ts";

// What the viewer may correct of someone's account: the name and email with people.manage, and
// the employee number with its own key where the person is.
export function PersonForms({ person }: { person: PersonView }) {
  return (
    <>
      {person.can.edit ? <NameAndEmail person={person} /> : null}
      {person.can.link ? <EmployeeNumber person={person} /> : null}
    </>
  );
}

function Card({
  title,
  description,
  onSubmit,
  children,
}: {
  title: string;
  description: string;
  onSubmit: () => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <form
      noValidate
      aria-labelledby={`${id}-title`}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-4 rounded-xl border bg-card px-5 py-5 shadow-xs sm:px-6"
    >
      <div>
        <h2 id={`${id}-title`} className="font-medium text-base">
          {title}
        </h2>
        <p className="mt-1 max-w-prose text-pretty text-muted-foreground text-sm">
          {description}
        </p>
      </div>
      {children}
    </form>
  );
}

function SaveButton({
  running,
  asking,
  disabled,
  words,
}: {
  running: boolean;
  asking: boolean;
  disabled: boolean;
  words: { save: string; saving: string; submit: string; confirming: string };
}) {
  return (
    <ActionSwapButton
      type="submit"
      disabled={running || disabled}
      className="self-end"
      value={running ? "saving" : asking ? "confirm" : "save"}
      items={[
        { id: "save", label: words.save, icon: <Save /> },
        {
          id: "saving",
          label: asking ? words.confirming : words.saving,
          icon: <LoaderCircle className="animate-spin" />,
        },
        { id: "confirm", label: words.submit, icon: <Check /> },
      ]}
    />
  );
}

function NameAndEmail({ person }: { person: PersonView }) {
  const t = useTranslations("people");
  const refusals = useTranslations("actions");
  const step = usePasswordStep();
  const [name, setName] = useState(person.name);
  const [email, setEmail] = useState(person.email);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [refusal, setRefusal] = useState<string>();
  const [running, setRunning] = useState(false);
  const [, startTransition] = useTransition();
  const dirty =
    oneLine(name) !== person.name ||
    email.trim().toLowerCase() !== person.email;

  const save = (password?: string) =>
    startTransition(async () => {
      setRunning(true);
      setRefusal(undefined);
      const result = await updatePersonAction({
        userId: person.userId,
        name,
        email,
        password,
      });
      setRunning(false);
      const invalid = result?.validationErrors;
      if (invalid) {
        setErrors({
          name: invalid.name ? t("fields.name") : undefined,
          email: invalid.email ? t("fields.email") : undefined,
        });
        return;
      }
      const outcome = result?.data;
      if (step.handled(outcome, save)) return;
      switch (outcome?.status) {
        case "saved":
          toast.success(t("person.edit.saved", { name: oneLine(name) }));
          return;
        case "unchanged":
          toast(t("unchanged"));
          return;
        case "emailTaken":
          setErrors({ email: t("person.edit.emailTaken") });
          return;
        case "notFound":
          setRefusal(t("gone"));
          return;
        default:
          setRefusal(refusals(result?.serverError ?? "unexpected"));
      }
    });

  return (
    <Card
      title={t("person.edit.title")}
      description={t("person.edit.description")}
      onSubmit={() => {
        if (!step.confirm()) save();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={t("person.name")}
          autoComplete="off"
          value={name}
          onChange={(text) => {
            setName(text);
            setErrors(({ email: kept }) => ({ email: kept }));
          }}
          error={errors.name}
        />
        <Input
          type="email"
          label={t("person.email")}
          autoComplete="off"
          value={email}
          onChange={(text) => {
            setEmail(text);
            setErrors(({ name: kept }) => ({ name: kept }));
          }}
          error={errors.email}
        />
      </div>
      {step.field(t("reauth"))}
      {refusal ? (
        <p role="alert" className="text-alert text-sm">
          {refusal}
        </p>
      ) : null}
      <SaveButton
        running={running}
        asking={step.asking}
        disabled={!dirty && !step.asking}
        words={{
          save: t("person.edit.save"),
          saving: t("person.edit.saving"),
          ...step.words,
        }}
      />
    </Card>
  );
}

function EmployeeNumber({ person }: { person: PersonView }) {
  const t = useTranslations("people");
  const refusals = useTranslations("actions");
  const step = usePasswordStep();
  const [number, setNumber] = useState(person.employeeNumber);
  const [error, setError] = useState<string>();
  const [refusal, setRefusal] = useState<string>();
  const [running, setRunning] = useState(false);
  const [, startTransition] = useTransition();
  const dirty =
    toLatinDigits(number).replace(/\s+/g, "") !== person.employeeNumber;

  const save = (password?: string) =>
    startTransition(async () => {
      setRunning(true);
      setRefusal(undefined);
      const result = await linkEmployeeNumberAction({
        userId: person.userId,
        employeeNumber: number,
        password,
      });
      setRunning(false);
      if (result?.validationErrors) {
        setError(t("fields.employeeNumber"));
        return;
      }
      const outcome = result?.data;
      if (step.handled(outcome, save)) return;
      switch (outcome?.status) {
        case "saved":
          toast.success(t("person.link.saved", { name: person.name }));
          return;
        case "unchanged":
          toast(t("unchanged"));
          return;
        case "taken":
          setError(t("person.link.taken"));
          return;
        case "notFound":
          setRefusal(t("gone"));
          return;
        default:
          setRefusal(refusals(result?.serverError ?? "unexpected"));
      }
    });

  return (
    <Card
      title={t("person.link.title")}
      description={t("person.link.description")}
      onSubmit={() => {
        if (!step.confirm()) save();
      }}
    >
      <Input
        label={t("person.employeeNumber")}
        inputMode="numeric"
        autoComplete="off"
        value={number}
        onChange={(text) => {
          setNumber(text);
          setError(undefined);
        }}
        error={error}
        className="w-full sm:max-w-xs"
      />
      {step.field(t("reauth"))}
      {refusal ? (
        <p role="alert" className="text-alert text-sm">
          {refusal}
        </p>
      ) : null}
      <SaveButton
        running={running}
        asking={step.asking}
        disabled={!dirty && !step.asking}
        words={{
          save: t("person.link.save"),
          saving: t("person.link.saving"),
          ...step.words,
        }}
      />
    </Card>
  );
}

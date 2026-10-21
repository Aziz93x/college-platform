"use client";

import { LoaderCircle, UserPlus } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionSwapButton } from "@/components/motion/action-swap";
import { Input } from "@/components/motion/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/motion/select";
import { usePasswordStep } from "@/components/password-step";
import { Button } from "@/components/ui/button";
import type { RowError } from "@/modules/access";
import { importPeopleAction } from "../actions.ts";
import { TemporaryPassword } from "../temporary-password.tsx";

const NONE = "none";
type Field = "employeeNumber" | "name" | "email";

// The error each field shows for a reason a person cannot be added; the rest show under the button.
const FIELD_OF: Partial<Record<RowError, Field>> = {
  employeeNumber: "employeeNumber",
  employeeNumberTaken: "employeeNumber",
  repeated: "employeeNumber",
  name: "name",
  email: "email",
  emailTaken: "email",
};

// One person, added as a file's row is imported, so the same rules hold: their account with a
// temporary password shown once, and the role where they hold it, when the viewer gives roles.
export function AddPersonForm({
  roles,
  departments,
}: {
  roles: { key: string; label: string }[];
  departments: string[];
}) {
  const t = useTranslations("people");
  const refusals = useTranslations("actions");
  const id = useId();
  const step = usePasswordStep();
  const blank = { employeeNumber: "", name: "", email: "" };
  const [person, setPerson] = useState(blank);
  const [role, setRole] = useState(NONE);
  const [department, setDepartment] = useState(NONE);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [refusal, setRefusal] = useState<string>();
  const [running, setRunning] = useState(false);
  const [made, setMade] = useState<{
    userId: string;
    name: string;
    password: string;
  }>();
  const [, startTransition] = useTransition();

  const change = (field: Field, value: string) => {
    setPerson((current) => ({ ...current, [field]: value }));
    setErrors(({ [field]: _gone, ...rest }) => rest);
    setRefusal(undefined);
  };

  const add = (password?: string) =>
    startTransition(async () => {
      setRunning(true);
      setRefusal(undefined);
      const result = await importPeopleAction({
        rows: [
          {
            line: 1,
            ...person,
            role: role === NONE ? "" : role,
            department: role === NONE || department === NONE ? "" : department,
          },
        ],
        password,
      });
      setRunning(false);
      const outcome = result?.data;
      if (step.handled(outcome, add)) return;
      if (outcome?.status !== "imported") {
        setRefusal(refusals(result?.serverError ?? "unexpected"));
        return;
      }
      const [created] = outcome.created;
      if (created) {
        setMade(created);
        return;
      }
      const name = person.name;
      if (outcome.rolesAdded > 0) {
        toast.success(t("new.roleAdded", { name }));
        return;
      }
      if (outcome.unchanged > 0) {
        setRefusal(t("new.exists", { name }));
        return;
      }
      const shown: Partial<Record<Field, string>> = {};
      const rest: string[] = [];
      for (const error of outcome.skipped[0]?.errors ?? []) {
        const field = FIELD_OF[error];
        if (field) shown[field] ??= t(`import.errors.${error}`);
        else rest.push(t(`import.errors.${error}`));
      }
      setErrors(shown);
      if (rest.length > 0) setRefusal(rest.join(" "));
    });

  if (made) {
    return (
      <section className="flex flex-col gap-5 rounded-xl border bg-card px-5 py-5 shadow-xs sm:px-6">
        <h2 className="font-medium text-base">
          {t("new.created", { name: made.name })}
        </h2>
        <TemporaryPassword name={made.name} password={made.password} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button asChild variant="outline">
            <Link href={`/people/${made.userId}`}>
              {t("new.open", { name: made.name })}
            </Link>
          </Button>
          <Button
            type="button"
            onClick={() => {
              setMade(undefined);
              setPerson(blank);
              setRole(NONE);
              setDepartment(NONE);
            }}
          >
            <UserPlus aria-hidden />
            {t("new.another")}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!step.confirm()) add();
      }}
      className="divide-y rounded-xl border bg-card shadow-xs"
    >
      <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:px-6">
        <Input
          label={t("person.employeeNumber")}
          inputMode="numeric"
          autoComplete="off"
          value={person.employeeNumber}
          onChange={(value) => change("employeeNumber", value)}
          error={errors.employeeNumber}
        />
        <Input
          label={t("person.name")}
          autoComplete="off"
          value={person.name}
          onChange={(value) => change("name", value)}
          error={errors.name}
        />
        <Input
          type="email"
          label={t("person.email")}
          autoComplete="off"
          value={person.email}
          onChange={(value) => change("email", value)}
          error={errors.email}
          hint={t("person.edit.description")}
          className="sm:col-span-2"
        />
      </div>
      {roles.length > 0 ? (
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:px-6">
          <div className="flex flex-col gap-1.5">
            <span id={`${id}-role`} className="px-1 font-medium text-sm">
              {t("new.role")}
            </span>
            <Select
              aria-labelledby={`${id}-role`}
              value={role}
              onValueChange={setRole}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("new.noRole")}</SelectItem>
                {roles.map((each) => (
                  <SelectItem key={each.key} value={each.key}>
                    {each.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {role === NONE ? null : (
            <div className="flex flex-col gap-1.5">
              <span
                id={`${id}-department`}
                className="px-1 font-medium text-sm"
              >
                {t("new.department")}
              </span>
              <Select
                aria-labelledby={`${id}-department`}
                value={department}
                onValueChange={setDepartment}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("college")}</SelectItem>
                  {departments.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      ) : null}
      <div className="flex flex-col gap-3 px-5 py-4 sm:px-6">
        {step.field(t("reauth"))}
        {refusal ? (
          <p role="alert" className="text-alert text-sm">
            {refusal}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button asChild variant="ghost">
            <Link href="/people">{t("import.result.back")}</Link>
          </Button>
          <ActionSwapButton
            type="submit"
            disabled={running}
            value={running ? "running" : step.asking ? "confirm" : "idle"}
            items={[
              { id: "idle", label: t("new.create"), icon: <UserPlus /> },
              {
                id: "running",
                label: step.asking ? step.words.confirming : t("new.creating"),
                icon: <LoaderCircle className="animate-spin" />,
              },
              { id: "confirm", label: step.words.submit },
            ]}
          />
        </div>
      </div>
    </form>
  );
}

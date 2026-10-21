"use client";

import { LoaderCircle, ShieldCheck, UserPlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionSwapButton } from "@/components/motion/action-swap";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/motion/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/motion/select";
import { usePasswordStep } from "@/components/password-step";
import type { Member } from "@/modules/access";
import { addMembershipAction, removeMembershipAction } from "../actions.ts";

const COLLEGE = "college";

// Who holds the role, and where; adding someone, across the college or in one department, and
// taking the role away. The system role is held across the college only, and keeps its last member.
export function Members({
  role,
  people,
  departments,
}: {
  role: { id: string; system: boolean; members: Member[] };
  people: { userId: string; name: string; employeeNumber: string }[];
  /** The college's departments; the ones set aside name old memberships but are not offered. */
  departments: { id: string; name: string; active: boolean }[];
}) {
  const t = useTranslations("roles.members");
  const refusals = useTranslations("actions");
  const id = useId();
  const [person, setPerson] = useState<string>();
  const [scope, setScope] = useState(COLLEGE);
  const [error, setError] = useState<string>();
  const [running, setRunning] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const step = usePasswordStep();

  const scopeName = (departmentId: string | null) =>
    departmentId === null
      ? t("college")
      : (departments.find((department) => department.id === departmentId)
          ?.name ?? "");
  const nameOf = (userId: string) =>
    people.find((each) => each.userId === userId)?.name ?? "";

  const refuse = (
    status: string | undefined,
    serverError?: "signedOut" | "forbidden" | "unexpected",
  ) => {
    if (status === "exists") setError(t("exists"));
    else if (status === "lastAdmin") setError(t("lastAdmin"));
    else if (status === "collegeOnly") setError(t("collegeOnly"));
    else if (status === "inactive") setError(t("inactive"));
    else if (status === "notFound") setError(t("gone"));
    else setError(refusals(serverError ?? "unexpected"));
  };

  const add = (password?: string) => {
    if (!person) {
      setError(t("required"));
      return;
    }
    startTransition(async () => {
      setRunning("add");
      setError(undefined);
      const result = await addMembershipAction({
        userId: person,
        roleId: role.id,
        departmentId: scope === COLLEGE ? null : scope,
        password,
      });
      setRunning(null);
      const outcome = result?.data;
      if (step.handled(outcome, add)) return;
      if (outcome?.status === "added") {
        toast.success(t("toast.added", { name: nameOf(person) }));
        setPerson(undefined);
        return;
      }
      refuse(outcome?.status, result?.serverError);
    });
  };

  const remove = (member: Member) => (password?: string) =>
    startTransition(async () => {
      setRunning(member.id);
      setError(undefined);
      const result = await removeMembershipAction({ id: member.id, password });
      setRunning(null);
      const outcome = result?.data;
      if (step.handled(outcome, remove(member))) return;
      if (outcome?.status === "removed") {
        toast.success(t("toast.removed", { name: member.name }));
        return;
      }
      refuse(outcome?.status, result?.serverError);
    });

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="rounded-xl border bg-card shadow-xs"
    >
      <div className="px-5 pt-5 sm:px-6">
        <h2 id={`${id}-title`} className="font-medium text-base">
          {t("title")}
        </h2>
        <p className="mt-1 max-w-prose text-pretty text-muted-foreground text-sm">
          {t("description")}
        </p>
      </div>
      {role.members.length > 0 ? (
        <ul aria-label={t("list")} className="mt-4 divide-y border-y">
          {role.members.map((member) => (
            <li
              key={member.id}
              className="flex items-center justify-between gap-3 px-5 py-2.5 sm:px-6"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-sm">{member.name}</p>
                <p className="text-muted-foreground text-xs">
                  <span dir="ltr">{member.employeeNumber}</span>
                  <span aria-hidden> · </span>
                  {scopeName(member.departmentId)}
                </p>
              </div>
              <button
                type="button"
                aria-label={t("remove", { name: member.name })}
                disabled={running !== null}
                onClick={() => remove(member)()}
                className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
              >
                {running === member.id ? (
                  <LoaderCircle aria-hidden className="size-4 animate-spin" />
                ) : (
                  <X aria-hidden className="size-4" />
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 border-y px-5 py-4 text-muted-foreground text-sm sm:px-6">
          {t("empty")}
        </p>
      )}
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!step.confirm()) add();
        }}
        className="flex flex-col gap-4 px-5 py-5 sm:px-6"
      >
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <Combobox
            value={person}
            onValueChange={(value) => {
              setPerson(value);
              setError(undefined);
            }}
          >
            <ComboboxLabel>{t("person")}</ComboboxLabel>
            <ComboboxTrigger>
              <ComboboxInput placeholder={t("personPlaceholder")} />
            </ComboboxTrigger>
            <ComboboxContent>
              <ComboboxList aria-label={t("people")}>
                {people.map((each) => (
                  <ComboboxItem
                    key={each.userId}
                    value={each.userId}
                    textValue={each.name}
                    keywords={[each.employeeNumber]}
                  >
                    <span className="block truncate">{each.name}</span>
                    <span dir="ltr" className="text-muted-foreground text-xs">
                      {each.employeeNumber}
                    </span>
                  </ComboboxItem>
                ))}
              </ComboboxList>
              <ComboboxEmpty>{t("noPerson")}</ComboboxEmpty>
            </ComboboxContent>
          </Combobox>
          {role.system ? null : (
            <div className="flex flex-col gap-1.5 sm:w-56">
              <span id={`${id}-scope`} className="px-1 font-medium text-sm">
                {t("scope")}
              </span>
              <Select
                aria-labelledby={`${id}-scope`}
                value={scope}
                onValueChange={setScope}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={COLLEGE}>{t("college")}</SelectItem>
                  {departments
                    .filter((department) => department.active)
                    .map((department) => (
                      <SelectItem key={department.id} value={department.id}>
                        {department.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        {step.field(t("reauth"))}
        {error ? (
          <p role="alert" className="text-alert text-sm">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end">
          <ActionSwapButton
            type="submit"
            disabled={running !== null}
            value={
              running === "add" ? "adding" : step.asking ? "confirm" : "add"
            }
            items={[
              { id: "add", label: t("add"), icon: <UserPlus /> },
              {
                id: "adding",
                label: step.asking ? step.words.confirming : t("adding"),
                icon: <LoaderCircle className="animate-spin" />,
              },
              {
                id: "confirm",
                label: step.words.submit,
                icon: <ShieldCheck />,
              },
            ]}
          />
        </div>
      </form>
    </section>
  );
}

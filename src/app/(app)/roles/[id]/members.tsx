"use client";

import {
  LoaderCircle,
  ShieldCheck,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionSwapButton } from "@/components/motion/action-swap";
import { BottomSheet } from "@/components/motion/bottom-sheet";
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
import { Button } from "@/components/ui/button";
import type { Member } from "@/modules/access";
import { addMembershipAction, removeMembershipAction } from "../actions.ts";

const COLLEGE = "college";
const EVERY_TERM = "every";

// Who holds the role, and where, and in which term; adding someone, across the college or in one
// department, in every term or in one (Step 13), and taking the role away, which a sheet confirms as
// it confirms every change to someone's access. The system role is held across the college and in
// every term only, and keeps its last member who can sign in.
export function Members({
  role,
  people,
  departments,
  terms,
}: {
  role: { id: string; label: string; system: boolean; members: Member[] };
  people: { userId: string; name: string; employeeNumber: string }[];
  /** The college's departments; the ones set aside name old memberships but are not offered. */
  departments: { id: string; name: string; active: boolean }[];
  /** The terms a role can be held in: the draft and active ones. */
  terms: { id: string; name: string }[];
}) {
  const t = useTranslations("roles.members");
  const refusals = useTranslations("actions");
  const id = useId();
  const [person, setPerson] = useState<string>();
  const [scope, setScope] = useState(COLLEGE);
  const [term, setTerm] = useState(EVERY_TERM);
  const [error, setError] = useState<string>();
  const [running, setRunning] = useState(false);
  const [removing, setRemoving] = useState<Member>();
  const [, startTransition] = useTransition();
  const step = usePasswordStep();
  // The system role's last enabled member stays: the college needs one admin who can sign in.
  const enabled = role.members.filter((member) => !member.disabled);
  const keeps = (member: Member) =>
    role.system && !member.disabled && enabled.length === 1;

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
    else if (status === "everyTerm") setError(t("systemEveryTerm"));
    else if (status === "termClosed") setError(t("termClosed"));
    else if (status === "notFound") setError(t("gone"));
    else setError(refusals(serverError ?? "unexpected"));
  };

  const add = (password?: string) => {
    if (!person) {
      setError(t("required"));
      return;
    }
    startTransition(async () => {
      setRunning(true);
      setError(undefined);
      const result = await addMembershipAction({
        userId: person,
        roleId: role.id,
        departmentId: scope === COLLEGE ? null : scope,
        termId: role.system || term === EVERY_TERM ? null : term,
        password,
      });
      setRunning(false);
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
                  {member.term ? (
                    <>
                      <span aria-hidden> · </span>
                      {member.term}
                    </>
                  ) : null}
                  {member.disabled ? (
                    <>
                      <span aria-hidden> · </span>
                      {t("disabled")}
                    </>
                  ) : null}
                </p>
              </div>
              <button
                type="button"
                aria-label={t("remove", { name: member.name })}
                aria-describedby={keeps(member) ? `${id}-keeps` : undefined}
                disabled={keeps(member)}
                onClick={() => setRemoving(member)}
                className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40"
              >
                <X aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 border-y px-5 py-4 text-muted-foreground text-sm sm:px-6">
          {t("empty")}
        </p>
      )}
      {role.members.some(keeps) ? (
        <p
          id={`${id}-keeps`}
          className="px-5 pt-3 text-muted-foreground text-xs sm:px-6"
        >
          {t("lastAdmin")}
        </p>
      ) : null}
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
        {role.system || terms.length === 0 ? null : (
          <div className="flex flex-col gap-1.5 sm:w-56">
            <span id={`${id}-term`} className="px-1 font-medium text-sm">
              {t("term")}
            </span>
            <Select
              aria-labelledby={`${id}-term`}
              value={term}
              onValueChange={setTerm}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EVERY_TERM}>{t("everyTerm")}</SelectItem>
                {terms.map((each) => (
                  <SelectItem key={each.id} value={each.id}>
                    {each.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {step.field(t("reauth"))}
        {error ? (
          <p role="alert" className="text-alert text-sm">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end">
          <ActionSwapButton
            type="submit"
            disabled={running}
            value={running ? "adding" : step.asking ? "confirm" : "add"}
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
      {removing ? (
        <RemoveSheet
          member={removing}
          role={role.label}
          scope={scopeName(removing.departmentId)}
          onClose={() => setRemoving(undefined)}
        />
      ) : null}
    </section>
  );
}

// Taking the role from one member, confirmed in a sheet with the password asked again when it is
// due, as the account actions are (people/account-actions.tsx).
function RemoveSheet({
  member,
  role,
  scope,
  onClose,
}: {
  member: Member;
  role: string;
  scope: string;
  onClose: () => void;
}) {
  const t = useTranslations("roles.members");
  const ui = useTranslations("ui");
  const refusals = useTranslations("actions");
  const step = usePasswordStep();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string>();
  const [, startTransition] = useTransition();

  const remove = (password?: string) =>
    startTransition(async () => {
      setRunning(true);
      setError(undefined);
      const result = await removeMembershipAction({ id: member.id, password });
      setRunning(false);
      const outcome = result?.data;
      if (step.handled(outcome, remove)) return;
      switch (outcome?.status) {
        case "removed":
          toast.success(t("toast.removed", { name: member.name }));
          onClose();
          return;
        case "lastAdmin":
          setError(t("lastAdmin"));
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
      title={t("removeTitle", { name: member.name, role })}
      description={t("removeDescription", { scope })}
      closeLabel={ui("close")}
    >
      <form
        noValidate
        className="flex flex-col gap-4 pt-2 pb-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!step.confirm()) remove();
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
              { id: "idle", label: t("removeConfirm"), icon: <UserMinus /> },
              {
                id: "running",
                label: step.asking ? step.words.confirming : t("removing"),
                icon: <LoaderCircle className="animate-spin" />,
              },
              {
                id: "confirm",
                label: step.words.submit,
                icon: <ShieldCheck />,
              },
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

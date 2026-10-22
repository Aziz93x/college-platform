"use client";

import { LoaderCircle, ShieldCheck, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionSwapButton } from "@/components/motion/action-swap";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/motion/select";
import { usePasswordStep } from "@/components/password-step";
import { addMembershipAction } from "../roles/actions.ts";

const COLLEGE = "college";

// Giving the person a role from their own page (ADR-0016), across the college or in one active
// department: the role page's action, with its key, password step, event and notification. The
// system role is given across the college only. Taking a role away stays on the role's page, where
// a sheet confirms it.
export function GiveRole({
  person,
  roles,
  departments,
}: {
  person: { userId: string; name: string };
  roles: { id: string; label: string; system: boolean }[];
  /** The college's active departments. */
  departments: { id: string; name: string }[];
}) {
  const t = useTranslations("people.giveRole");
  const members = useTranslations("roles.members");
  const refusals = useTranslations("actions");
  const id = useId();
  const [roleId, setRoleId] = useState<string>();
  const [scope, setScope] = useState(COLLEGE);
  const [error, setError] = useState<string>();
  const [running, setRunning] = useState(false);
  const [, startTransition] = useTransition();
  const step = usePasswordStep();
  const role = roles.find((each) => each.id === roleId);

  const give = (password?: string) => {
    if (!role) {
      setError(t("required"));
      return;
    }
    startTransition(async () => {
      setRunning(true);
      setError(undefined);
      const result = await addMembershipAction({
        userId: person.userId,
        roleId: role.id,
        departmentId: role.system || scope === COLLEGE ? null : scope,
        password,
      });
      setRunning(false);
      const outcome = result?.data;
      if (step.handled(outcome, give)) return;
      switch (outcome?.status) {
        case "added":
          toast.success(t("toast", { name: person.name, role: role.label }));
          setRoleId(undefined);
          setScope(COLLEGE);
          return;
        case "exists":
        case "collegeOnly":
        case "inactive":
          setError(members(outcome.status));
          return;
        case "notFound":
          setError(members("gone"));
          return;
        default:
          setError(refusals(result?.serverError ?? "unexpected"));
      }
    });
  };

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="rounded-xl border bg-card px-5 py-5 shadow-xs sm:px-6"
    >
      <h2 id={`${id}-title`} className="font-medium text-base">
        {t("title")}
      </h2>
      <p className="mt-1 max-w-prose text-pretty text-muted-foreground text-sm">
        {t("description")}
      </p>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!step.confirm()) give();
        }}
        className="mt-4 flex flex-col gap-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span id={`${id}-role`} className="px-1 font-medium text-sm">
              {t("role")}
            </span>
            <Select
              aria-labelledby={`${id}-role`}
              // Held from the start, an empty value being no role: a select left to itself keeps
              // its first choice once the role is given and the choice cleared.
              value={roleId ?? ""}
              onValueChange={(value) => {
                setRoleId(value);
                setError(undefined);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("choose")} />
              </SelectTrigger>
              <SelectContent>
                {roles.map((each) => (
                  <SelectItem key={each.id} value={each.id}>
                    {each.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {role?.system ? null : (
            <div className="flex flex-col gap-1.5">
              <span id={`${id}-scope`} className="px-1 font-medium text-sm">
                {members("scope")}
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
                  <SelectItem value={COLLEGE}>{members("college")}</SelectItem>
                  {departments.map((department) => (
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
            disabled={running}
            value={running ? "giving" : step.asking ? "confirm" : "give"}
            items={[
              { id: "give", label: t("submit"), icon: <UserPlus /> },
              {
                id: "giving",
                label: step.asking ? step.words.confirming : t("giving"),
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

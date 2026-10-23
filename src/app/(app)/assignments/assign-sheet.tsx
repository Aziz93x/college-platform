"use client";

import { LoaderCircle, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionSwapButton } from "@/components/motion/action-swap";
import { BottomSheet } from "@/components/motion/bottom-sheet";
import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectEmpty,
  MultiSelectInput,
  MultiSelectItem,
  MultiSelectLabel,
  MultiSelectList,
  MultiSelectTrigger,
  MultiSelectValue,
} from "@/components/motion/multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/motion/select";
import { Switch } from "@/components/motion/switch";
import { Button } from "@/components/ui/button";
import { assignAction } from "./actions.ts";

export type Person = { userId: string; name: string; employeeNumber: string };

// Giving a template to people of the department, in a sheet: whom, chosen several at once, and the
// whole term or from a week to a week of it, its tasks due in the last (the owner's answers,
// 23 October 2026).
export function AssignButton({
  termId,
  departmentId,
  template,
  people,
  weeks,
}: {
  termId: string;
  departmentId: string;
  template: { id: string; title: string; grants?: string };
  /** The department's people the template is not given to this term yet. */
  people: Person[];
  /** The term's weeks. */
  weeks: number;
}) {
  const t = useTranslations("assignments.assign");
  const ui = useTranslations("ui");
  const refusals = useTranslations("actions");
  const id = useId();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [wholeTerm, setWholeTerm] = useState(true);
  const [from, setFrom] = useState("1");
  const [to, setTo] = useState(String(weeks));
  const [problem, setProblem] = useState<string>();
  const [running, setRunning] = useState(false);
  const [, startTransition] = useTransition();
  const options = Array.from({ length: weeks }, (_, at) => String(at + 1));
  const lastWeek = wholeTerm ? weeks : Number(to);

  const submit = () => {
    if (chosen.length === 0) return setProblem(t("required"));
    if (!wholeTerm && Number(from) > Number(to)) {
      return setProblem(t("order"));
    }
    setProblem(undefined);
    startTransition(async () => {
      setRunning(true);
      const result = await assignAction({
        templateId: template.id,
        termId,
        departmentId,
        userIds: chosen,
        weeks: wholeTerm ? undefined : { from: Number(from), to: Number(to) },
      });
      setRunning(false);
      const data = result?.data;
      if (data?.status === "assigned") {
        toast.success(
          data.added > 0 ? t("done", { count: data.added }) : t("allHeld"),
        );
        setOpen(false);
        setChosen([]);
        return;
      }
      setProblem(
        data
          ? t(`refusals.${data.status}`)
          : refusals(result?.serverError ?? "unexpected"),
      );
    });
  };

  const weekSelect = (
    name: "from" | "to",
    value: string,
    change: (value: string) => void,
  ) => (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span id={`${id}-${name}`} className="px-1 font-medium text-sm">
        {t(name)}
      </span>
      <Select
        aria-labelledby={`${id}-${name}`}
        value={value}
        onValueChange={change}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((week) => (
            <SelectItem key={week} value={week}>
              {t("weekOption", { week: Number(week) })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <>
      <Button
        type="button"
        variant="outline"
        aria-label={t("label", { title: template.title })}
        onClick={() => setOpen(true)}
      >
        <UserPlus aria-hidden />
        {t("button")}
      </Button>
      {open ? (
        <BottomSheet
          open
          onOpenChange={(next) => {
            if (!next) setOpen(false);
          }}
          snapPoints={["auto"]}
          title={t("title", { title: template.title })}
          description={t("description")}
          closeLabel={ui("close")}
        >
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
            className="flex flex-col gap-4 pt-2 pb-2"
          >
            <MultiSelect
              value={chosen}
              onValueChange={(value) => {
                setChosen(value);
                setProblem(undefined);
              }}
            >
              <MultiSelectLabel>{t("people")}</MultiSelectLabel>
              <MultiSelectTrigger>
                <MultiSelectValue
                  removeLabel={(name) => t("remove", { name })}
                />
                <MultiSelectInput placeholder={t("placeholder")} />
              </MultiSelectTrigger>
              <MultiSelectContent>
                <MultiSelectList aria-label={t("list")}>
                  {people.map((person) => (
                    <MultiSelectItem
                      key={person.userId}
                      value={person.userId}
                      textValue={person.name}
                      keywords={[person.employeeNumber]}
                    >
                      <span className="block truncate">{person.name}</span>
                      <span dir="ltr" className="text-muted-foreground text-xs">
                        {person.employeeNumber}
                      </span>
                    </MultiSelectItem>
                  ))}
                </MultiSelectList>
                <MultiSelectEmpty>
                  {people.length === 0 ? t("everyone") : t("noPerson")}
                </MultiSelectEmpty>
              </MultiSelectContent>
            </MultiSelect>
            <div className="flex items-center justify-between gap-3 px-1">
              <span id={`${id}-whole`} className="font-medium text-sm">
                {t("wholeTerm")}
              </span>
              <Switch
                aria-labelledby={`${id}-whole`}
                checked={wholeTerm}
                onCheckedChange={setWholeTerm}
              />
            </div>
            {wholeTerm ? null : (
              <div className="flex flex-wrap gap-3">
                {weekSelect("from", from, setFrom)}
                {weekSelect("to", to, setTo)}
              </div>
            )}
            <p className="px-1 text-muted-foreground text-sm">
              {t("due", { week: lastWeek })}
              {template.grants
                ? ` ${t("grants", { role: template.grants })}`
                : ""}
            </p>
            {problem ? (
              <p role="alert" className="text-alert text-sm">
                {problem}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <ActionSwapButton
                type="submit"
                disabled={running}
                value={running ? "running" : "idle"}
                items={[
                  { id: "idle", label: t("submit"), icon: <UserPlus /> },
                  {
                    id: "running",
                    label: t("submitting"),
                    icon: <LoaderCircle className="animate-spin" />,
                  },
                ]}
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                {ui("cancel")}
              </Button>
            </div>
          </form>
        </BottomSheet>
      ) : null}
    </>
  );
}

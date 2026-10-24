"use client";

import { LoaderCircle, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionSwapButton } from "@/components/motion/action-swap";
import { BottomSheet } from "@/components/motion/bottom-sheet";
import { Checkbox } from "@/components/motion/checkbox";
import { searchCommands } from "@/components/motion/lib/command-search";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/motion/select";
import { Switch } from "@/components/motion/switch";
import { NoResults, SearchField } from "@/components/search-field";
import { Button } from "@/components/ui/button";
import { toLatinDigits } from "@/platform/validation/digits";
import { assignAction } from "./actions.ts";

export type Person = { userId: string; name: string; employeeNumber: string };
// A week of the term by its number, and its days in words.
export type Week = { number: number; days: string };

// Giving a template to people of the department, in a sheet: whom, ticked in the department's list,
// which a search narrows by name or employee number, and the whole term or from a week to a week of
// it, its tasks due in the last (the owner's answers, 23 October 2026). Each week shows its days,
// and a range starts on this week (lead review D, proposal 8).
export function AssignButton({
  termId,
  departmentId,
  template,
  people,
  staffed,
  weeks,
  thisWeek,
}: {
  termId: string;
  departmentId: string;
  template: { id: string; title: string; grants?: string };
  /** The department's people the template is not given to this term yet. */
  people: Person[];
  /** Whether the department has anyone in the term: none left means each holds it already. */
  staffed: boolean;
  /** The term's weeks, each with its days. */
  weeks: Week[];
  /** The week reached today, which a range starts on. */
  thisWeek: number;
}) {
  const t = useTranslations("assignments.assign");
  const ui = useTranslations("ui");
  const refusals = useTranslations("actions");
  const id = useId();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [wholeTerm, setWholeTerm] = useState(true);
  const [from, setFrom] = useState(String(thisWeek));
  const [to, setTo] = useState(String(weeks.length));
  const [problem, setProblem] = useState<string>();
  const [running, setRunning] = useState(false);
  const [, startTransition] = useTransition();
  const lastWeek = wholeTerm ? weeks.length : Number(to);
  // Those a search finds, and those it hides stay chosen.
  const shown = query.trim()
    ? searchCommands(
        people.map((person) => ({
          person,
          label: person.name,
          keywords: [person.employeeNumber],
        })),
        toLatinDigits(query),
      ).map(({ person }) => person)
    : people;
  const toggle = (userId: string, checked: boolean) => {
    setChosen((current) =>
      checked
        ? [...current, userId]
        : current.filter((each) => each !== userId),
    );
    setProblem(undefined);
  };

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
        setQuery("");
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
          {weeks.map((week) => (
            <SelectItem key={week.number} value={String(week.number)}>
              {t("weekDays", { week: week.number, days: week.days })}
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
            <fieldset className="flex flex-col gap-2 px-1">
              <legend className="mb-1 font-medium text-sm">
                {t("people")}
              </legend>
              {people.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {staffed ? t("everyone") : t("nobody")}
                </p>
              ) : (
                <>
                  <SearchField
                    label={t("search")}
                    placeholder={t("placeholder")}
                    value={query}
                    onChange={setQuery}
                    results={shown.length}
                  />
                  {shown.length === 0 ? (
                    <NoResults query={query} onClear={() => setQuery("")} />
                  ) : (
                    <ul aria-label={t("list")} className="flex flex-col gap-1">
                      {shown.map((person) => (
                        <li key={person.userId}>
                          <Checkbox
                            label={person.name}
                            description={person.employeeNumber}
                            checked={chosen.includes(person.userId)}
                            onCheckedChange={(checked) =>
                              toggle(person.userId, checked)
                            }
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                  <p
                    aria-live="polite"
                    className="text-muted-foreground text-sm"
                  >
                    {t("chosen", { count: chosen.length })}
                  </p>
                </>
              )}
            </fieldset>
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
            {/* The actions stay at the sheet's foot over a long list, as the item sheet's do. */}
            <div className="sticky -bottom-6 z-10 -mx-4 -mb-8 flex flex-wrap items-center gap-2 border-t bg-background px-4 pt-3 pb-6">
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

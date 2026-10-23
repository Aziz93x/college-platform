"use client";

import { LoaderCircle, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionSwapButton } from "@/components/motion/action-swap";
import { BottomSheet } from "@/components/motion/bottom-sheet";
import { Checkbox } from "@/components/motion/checkbox";
import { DateRangePickerDropdown } from "@/components/motion/date-range-picker";
import { Input } from "@/components/motion/input";
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
import { useDateRangeWords } from "@/components/use-date-range-words";
import type { RequestTargets } from "@/modules/requests";
import { firstDayOfWeek } from "@/platform/i18n/language";
import { toLatinDigits } from "@/platform/validation/digits";
import { sendQuickRequestAction } from "./actions.ts";

// Someone a request may reach in a place: in their department, as the generation engine reaches
// them in the term.
export type Reachable = {
  userId: string;
  departmentId: string;
  name: string;
  /** Their employee number, and their department where the place is the whole college. */
  description: string;
  employeeNumber: string;
};

// Where a request goes: a department, or the whole college (id null), with whom it may reach there.
export type Place = {
  id: string | null;
  name: string;
  people: Reachable[];
  roles: { id: string; label: string }[];
};

// Whom the sheet sends to: everyone in the place, the holders of a role there, or people chosen.
type Choice = "everyone" | "holders" | "people";
const COLLEGE = "college";
const keyOf = (person: { userId: string; departmentId: string }) =>
  `${person.departmentId}:${person.userId}`;

// A quick request in a sheet (Step 22): its words, where it goes when the viewer sends to more than
// one place, the axis its tasks count under, its day, whom it reaches (everyone there but the
// sender, a role's holders, or people ticked in the place's list, which a search narrows), and
// whether it asks for evidence. Its tasks are made as it is sent, and the toast says how many it
// reached.
export function RequestButton({
  termId,
  places,
  axes,
  title: limit,
  day,
}: {
  termId: string;
  places: Place[];
  axes: { value: string; label: string }[];
  title: number;
  /** The first and last day the request may be due: today or the term's start, and its end. */
  day: { min: string; max: string; today: string };
}) {
  const t = useTranslations("requests.new");
  const refusals = useTranslations("requests.refusals");
  const ui = useTranslations("ui");
  const actions = useTranslations("actions");
  const locale = useLocale();
  const dateWords = useDateRangeWords(t("fields.due"));
  const id = useId();
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState(places[0]);
  const [title, setTitle] = useState("");
  const [axisId, setAxisId] = useState(axes[0]?.value ?? "");
  const [dueOn, setDueOn] = useState<string | null>(null);
  const [choice, setChoice] = useState<Choice>("everyone");
  const [roleId, setRoleId] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [evidence, setEvidence] = useState(true);
  const [problem, setProblem] = useState<string>();
  const [running, setRunning] = useState(false);
  const [, startTransition] = useTransition();

  // Those a search finds; those it hides stay chosen.
  const shown = query.trim()
    ? searchCommands(
        place.people.map((person) => ({
          person,
          label: person.name,
          keywords: [person.employeeNumber],
        })),
        toLatinDigits(query),
      ).map(({ person }) => person)
    : place.people;
  const toggle = (key: string, checked: boolean) => {
    setChosen((current) =>
      checked ? [...current, key] : current.filter((each) => each !== key),
    );
    setProblem(undefined);
  };
  const moveTo = (value: string) => {
    const next = places.find((each) => (each.id ?? COLLEGE) === value);
    if (!next) return;
    setPlace(next);
    setRoleId("");
    setChosen([]);
    setQuery("");
  };
  const reset = () => {
    setTitle("");
    setDueOn(null);
    setChoice("everyone");
    setRoleId("");
    setChosen([]);
    setQuery("");
    setEvidence(true);
  };

  const targets = (): RequestTargets | string => {
    if (choice === "everyone") return { type: "everyone" };
    if (choice === "holders") {
      return roleId ? { type: "role", roleId } : t("required.role");
    }
    const picked = place.people.filter((person) =>
      chosen.includes(keyOf(person)),
    );
    return picked.length > 0
      ? {
          type: "people",
          people: picked.map(({ userId, departmentId }) => ({
            userId,
            departmentId,
          })),
        }
      : t("required.people");
  };

  const submit = () => {
    if (!title.trim()) return setProblem(t("required.title"));
    if (!dueOn) return setProblem(t("required.due"));
    const reach = targets();
    if (typeof reach === "string") return setProblem(reach);
    setProblem(undefined);
    startTransition(async () => {
      setRunning(true);
      const result = await sendQuickRequestAction({
        termId,
        departmentId: place.id,
        title,
        axisId,
        dueOn,
        targets: reach,
        evidence,
      });
      setRunning(false);
      const data = result?.data;
      if (data?.status === "sent") {
        toast.success(t("sent", { count: data.reached }));
        setOpen(false);
        reset();
        return;
      }
      setProblem(
        data
          ? refusals(data.status)
          : actions(result?.serverError ?? "unexpected"),
      );
    });
  };

  const select = (
    name: string,
    label: string,
    value: string,
    change: (value: string) => void,
    choices: { value: string; label: string }[],
  ) => (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-${name}`} className="px-1 font-medium text-sm">
        {label}
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
          {choices.map((each) => (
            <SelectItem key={each.value} value={each.value}>
              {each.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Send aria-hidden />
        {t("button")}
      </Button>
      {open ? (
        <BottomSheet
          open
          onOpenChange={(next) => {
            if (!next) setOpen(false);
          }}
          snapPoints={["auto"]}
          title={t("title")}
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
            <Input
              label={t("fields.title")}
              hint={t("titleHint")}
              autoComplete="off"
              maxLength={limit}
              value={title}
              onChange={(value) => {
                setTitle(value);
                setProblem(undefined);
              }}
            />
            {places.length > 1
              ? select(
                  "place",
                  t("fields.place"),
                  place.id ?? COLLEGE,
                  moveTo,
                  places.map((each) => ({
                    value: each.id ?? COLLEGE,
                    label: each.name,
                  })),
                )
              : null}
            {select("axis", t("fields.axis"), axisId, setAxisId, axes)}
            <div className="flex flex-col gap-1.5">
              <span id={`${id}-due`} className="px-1 font-medium text-sm">
                {t("fields.due")}
              </span>
              <DateRangePickerDropdown
                single
                closeOnSelect
                value={dueOn ? { from: dueOn, to: dueOn } : null}
                onValueChange={(range) => {
                  setDueOn(range?.from ?? null);
                  setProblem(undefined);
                }}
                words={dateWords}
                placeholder={t("duePlaceholder")}
                locale={locale}
                weekStartsOn={firstDayOfWeek(locale)}
                min={day.min}
                max={day.max}
                today={day.today}
                aria-describedby={`${id}-due-hint`}
              />
              <p
                id={`${id}-due-hint`}
                className="px-1 text-muted-foreground text-sm"
              >
                {t("dueHint")}
              </p>
            </div>
            {select(
              "targets",
              t("fields.targets"),
              choice,
              (value) => {
                setChoice(value as Choice);
                setProblem(undefined);
              },
              [
                { value: "everyone", label: t("everyone") },
                { value: "holders", label: t("role") },
                { value: "people", label: t("people") },
              ],
            )}
            {choice === "holders" ? (
              place.roles.length > 0 ? (
                select(
                  "role",
                  t("fields.role"),
                  roleId,
                  (value) => {
                    setRoleId(value);
                    setProblem(undefined);
                  },
                  place.roles.map((role) => ({
                    value: role.id,
                    label: role.label,
                  })),
                )
              ) : (
                <p className="px-1 text-muted-foreground text-sm">
                  {t("noRole", { place: place.name })}
                </p>
              )
            ) : null}
            {choice === "people" ? (
              <fieldset className="flex flex-col gap-2 px-1">
                <legend className="mb-1 font-medium text-sm">
                  {t("fields.people")}
                </legend>
                {place.people.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    {t("nobody", { place: place.name })}
                  </p>
                ) : (
                  <>
                    <SearchField
                      label={t("search", { place: place.name })}
                      placeholder={t("placeholder")}
                      value={query}
                      onChange={setQuery}
                      results={shown.length}
                    />
                    {shown.length === 0 ? (
                      <NoResults query={query} onClear={() => setQuery("")} />
                    ) : (
                      <ul
                        aria-label={t("listLabel", { place: place.name })}
                        className="flex flex-col gap-1"
                      >
                        {shown.map((person) => (
                          <li key={keyOf(person)}>
                            <Checkbox
                              label={person.name}
                              description={person.description}
                              checked={chosen.includes(keyOf(person))}
                              onCheckedChange={(checked) =>
                                toggle(keyOf(person), checked)
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
            ) : null}
            <div className="flex items-center justify-between gap-3 px-1">
              <span id={`${id}-evidence`} className="font-medium text-sm">
                {t("fields.evidence")}
              </span>
              <Switch
                aria-labelledby={`${id}-evidence`}
                checked={evidence}
                onCheckedChange={setEvidence}
              />
            </div>
            {problem ? (
              <p role="alert" className="text-alert text-sm">
                {problem}
              </p>
            ) : null}
            {/* The actions stay at the sheet's foot over a long list, as the assign sheet's do. */}
            <div className="sticky -bottom-6 z-10 -mx-4 -mb-8 flex flex-wrap items-center gap-2 border-t bg-background px-4 pt-3 pb-6">
              <ActionSwapButton
                type="submit"
                disabled={running}
                value={running ? "running" : "idle"}
                items={[
                  { id: "idle", label: t("submit"), icon: <Send /> },
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

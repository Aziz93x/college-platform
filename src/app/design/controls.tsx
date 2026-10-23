"use client";

import {
  BookOpen,
  CalendarDays,
  CalendarRange,
  Check,
  Copy,
  LoaderCircle,
  Pencil,
  Save,
  Trash2,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { ActionSwapButton } from "@/components/motion/action-swap";
import { AdaptiveStepper } from "@/components/motion/adaptive-stepper";
import { Alert, AlertDescription, AlertTitle } from "@/components/motion/alert";
import { AnimatedBadge } from "@/components/motion/animated-badge";
import { Checkbox } from "@/components/motion/checkbox";
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
import { Input } from "@/components/motion/input";
import { OverflowActions } from "@/components/motion/overflow-actions";
import { RangeSlider } from "@/components/motion/range-slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/motion/select";
import { Switch } from "@/components/motion/switch";
import { Table, type TableColumn } from "@/components/motion/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/motion/tabs";
import { SaveActions, useSaveState } from "@/components/save-actions";
import { NoResults, SearchField } from "@/components/search-field";
import { toLatinDigits } from "@/platform/validation/digits";
import { Demo } from "./demo";

const WEEKS = ["one", "two", "three"] as const;
// Fixed sample values, so the page renders the same on every run.
const SECTIONS = { start: 3, min: 1, max: 12 };
const SAMPLE_RATE = { start: 20, step: 5 };
// How long a sample save takes, so its states show.
const SAVE_DELAY = 800;
// One field's width in a row of samples.
const FIELD = "w-full sm:w-56";

type TaskRow = { section: string; tasks: string; done: string };

// The BeUI components the screens use (docs/design/beui-map.md), and the patterns built on them,
// each in its states: one component per job.
export function Controls() {
  const t = useTranslations("design");
  const ui = useTranslations("ui");
  const format = useFormatter();
  const ids = {
    switch: useId(),
    select: useId(),
    stepper: useId(),
    stepperFull: useId(),
    slider: useId(),
  };
  const [checked, setChecked] = useState(true);
  const [unchecked, setUnchecked] = useState(false);
  const [on, setOn] = useState(true);
  const [off, setOff] = useState(false);
  const [week, setWeek] = useState<string>(WEEKS[0]);
  const [person, setPerson] = useState<string>();
  const [sections, setSections] = useState(SECTIONS.start);
  // At its upper bound, where the leaving button once drew over the number (UX review 2, F1).
  const [full, setFull] = useState(SECTIONS.max);
  const [rate, setRate] = useState(SAMPLE_RATE.start);
  const [tab, setTab] = useState("week");
  const [swap, setSwap] = useState("save");
  const [chosen, setChosen] = useState<string>();
  const people = t.raw("combobox.people") as [string, string][];
  const rows = (t.raw("table.rows") as string[][]).map(
    ([section, tasks, done]): TaskRow => ({ section, tasks, done }),
  );
  const columns: TableColumn<TaskRow>[] = [
    { key: "section", header: t("table.section"), sortable: true },
    {
      key: "tasks",
      header: t("table.tasks"),
      sortable: true,
      align: "end",
      sortValue: (row) => Number(row.tasks),
    },
    {
      key: "done",
      header: t("table.done"),
      sortable: true,
      align: "end",
      sortValue: (row) => Number(row.done),
    },
  ];

  return (
    <>
      <Demo id="input" title={t("primitives.input")}>
        <Input
          label={t("states.default")}
          placeholder={t("sample.placeholder")}
          className={FIELD}
        />
        <Input
          label={t("states.filled")}
          defaultValue={t("sample.value")}
          hint={t("input.hint")}
          startIcon={<BookOpen />}
          className={FIELD}
        />
        <Input label={t("states.disabled")} disabled className={FIELD} />
        <Input
          label={t("states.invalid")}
          error={t("sample.required")}
          className={FIELD}
        />
      </Demo>

      <Demo id="checkbox" title={t("primitives.checkbox")}>
        <Checkbox
          checked={checked}
          onCheckedChange={setChecked}
          label={t("states.checked")}
        />
        <Checkbox
          checked={unchecked}
          onCheckedChange={setUnchecked}
          label={t("states.unchecked")}
          description={t("checkbox.description")}
        />
        <Checkbox
          checked={false}
          onCheckedChange={() => {}}
          label={t("states.disabled")}
          disabled
        />
      </Demo>

      <Demo id="switch" title={t("primitives.switch")}>
        {(
          [
            ["checked", on, setOn, false],
            ["unchecked", off, setOff, false],
            ["disabled", true, setOn, true],
          ] as const
        ).map(([state, value, change, disabled]) => (
          <div key={state} className="flex items-center gap-3">
            <Switch
              aria-labelledby={`${ids.switch}-${state}`}
              checked={value}
              onCheckedChange={change}
              disabled={disabled}
            />
            <span id={`${ids.switch}-${state}`} className="text-sm">
              {t(`states.${state}`)}
            </span>
          </div>
        ))}
      </Demo>

      <Demo id="select" title={t("primitives.select")}>
        <div className={`flex flex-col gap-1.5 ${FIELD}`}>
          <span id={ids.select} className="px-1 font-medium text-sm">
            {t("select.label")}
          </span>
          <Select
            aria-labelledby={ids.select}
            value={week}
            onValueChange={setWeek}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEEKS.map((each) => (
                <SelectItem key={each} value={each}>
                  {t(`select.${each}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className={`flex flex-col gap-1.5 ${FIELD}`}>
          <span
            id={`${ids.select}-disabled`}
            className="px-1 font-medium text-sm"
          >
            {t("states.disabled")}
          </span>
          <Select
            aria-labelledby={`${ids.select}-disabled`}
            value={WEEKS[1]}
            onValueChange={() => {}}
            disabled
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEEKS.map((each) => (
                <SelectItem key={each} value={each}>
                  {t(`select.${each}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Demo>

      <Demo id="combobox" title={t("primitives.combobox")}>
        <Combobox
          value={person}
          onValueChange={setPerson}
          className="w-full sm:w-72"
        >
          <ComboboxLabel>{t("combobox.label")}</ComboboxLabel>
          <ComboboxTrigger>
            <ComboboxInput placeholder={t("combobox.placeholder")} />
          </ComboboxTrigger>
          <ComboboxContent>
            <ComboboxList aria-label={t("combobox.list")}>
              {people.map(([name, number]) => (
                <ComboboxItem
                  key={number}
                  value={number}
                  textValue={name}
                  keywords={[number]}
                >
                  <span className="block truncate">{name}</span>
                  <span dir="ltr" className="text-muted-foreground text-xs">
                    {number}
                  </span>
                </ComboboxItem>
              ))}
            </ComboboxList>
            <ComboboxEmpty>{t("combobox.empty")}</ComboboxEmpty>
          </ComboboxContent>
        </Combobox>
      </Demo>

      <Demo id="stepper" title={t("primitives.stepper")}>
        <div className="flex flex-col items-start gap-1.5">
          <span id={ids.stepper} className="px-1 font-medium text-sm">
            {t("stepper.label")}
          </span>
          <AdaptiveStepper
            aria-labelledby={ids.stepper}
            value={sections}
            onValueChange={setSections}
            min={SECTIONS.min}
            max={SECTIONS.max}
            labels={{
              decrease: t("stepper.decrease"),
              increase: t("stepper.increase"),
            }}
            formatValue={(count) => format.number(count)}
            formatValueText={(count) => t("stepper.value", { count })}
          />
        </div>
        <div className="flex flex-col items-start gap-1.5">
          <span id={ids.stepperFull} className="px-1 font-medium text-sm">
            {t("stepper.full")}
          </span>
          <AdaptiveStepper
            aria-labelledby={ids.stepperFull}
            value={full}
            onValueChange={setFull}
            min={SECTIONS.min}
            max={SECTIONS.max}
            labels={{
              decrease: t("stepper.decrease"),
              increase: t("stepper.increase"),
            }}
            formatValue={(count) => format.number(count)}
            formatValueText={(count) => t("stepper.value", { count })}
          />
        </div>
      </Demo>

      <Demo id="slider" title={t("primitives.slider")}>
        <div className="flex w-full flex-col gap-1.5 sm:w-64">
          <span id={ids.slider} className="px-1 font-medium text-sm">
            {t("slider.label")}
          </span>
          <RangeSlider
            aria-labelledby={ids.slider}
            value={rate}
            onValueChange={setRate}
            step={SAMPLE_RATE.step}
            formatValueText={(value) => t("slider.value", { value })}
          />
          <p aria-hidden className="px-1 text-muted-foreground text-sm">
            {t("slider.value", { value: rate })}
          </p>
        </div>
      </Demo>

      <Demo id="tabs" title={t("primitives.tabs")}>
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList
            label={t("tabs.label")}
            scrollLabels={{ left: t("tabs.left"), right: t("tabs.right") }}
          >
            <TabsTrigger value="week" icon={<CalendarDays />}>
              {t("tabs.week")}
            </TabsTrigger>
            <TabsTrigger value="month" icon={<CalendarRange />}>
              {t("tabs.month")}
            </TabsTrigger>
            <TabsTrigger value="term" disabled>
              {t("tabs.term")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="week">{t("tabs.weekBody")}</TabsContent>
          <TabsContent value="month">{t("tabs.monthBody")}</TabsContent>
        </Tabs>
      </Demo>

      <Demo id="table" title={t("primitives.table")}>
        <Table
          data={rows}
          columns={columns}
          getRowId={(row) => row.section}
          caption={t("table.caption")}
        />
        <Table
          data={[]}
          columns={columns}
          getRowId={(row) => row.section}
          caption={t("table.emptyCaption")}
          emptyState={t("table.empty")}
        />
      </Demo>

      <Demo id="badge" title={t("primitives.badge")}>
        <AnimatedBadge status="neutral">{t("badge.draft")}</AnimatedBadge>
        <AnimatedBadge status="pending">{t("badge.review")}</AnimatedBadge>
        <AnimatedBadge status="success">{t("badge.done")}</AnimatedBadge>
        <AnimatedBadge status="alert">{t("badge.late")}</AnimatedBadge>
      </Demo>

      <Demo id="action-swap" title={t("primitives.action-swap")}>
        <ActionSwapButton
          value={swap}
          disabled={swap === "saving"}
          onClick={() => {
            setSwap("saving");
            setTimeout(() => setSwap("saved"), SAVE_DELAY);
          }}
          items={[
            { id: "save", label: t("button.primary"), icon: <Save /> },
            {
              id: "saving",
              label: t("states.loading"),
              icon: <LoaderCircle className="animate-spin" />,
            },
            { id: "saved", label: ui("saved"), icon: <Check /> },
          ]}
        />
      </Demo>

      <Demo id="overflow-actions" title={t("primitives.overflow-actions")}>
        <OverflowActions
          openLabel={t("overflow.open")}
          closeLabel={t("overflow.close")}
          actions={(
            [
              ["edit", <Pencil key="edit" />],
              ["copy", <Copy key="copy" />],
              ["delete", <Trash2 key="delete" />],
            ] as const
          ).map(([id, icon]) => ({
            id,
            label: t(`overflow.${id}`),
            icon,
            onClick: () => setChosen(t(`overflow.${id}`)),
          }))}
        />
        <output className="text-muted-foreground text-sm">
          {chosen ? t("overflow.chosen", { action: chosen }) : null}
        </output>
      </Demo>

      <Demo id="alert" title={t("primitives.alert")}>
        <Alert variant="info" className="w-full">
          <AlertTitle>{t("alert.infoTitle")}</AlertTitle>
          <AlertDescription>{t("alert.info")}</AlertDescription>
        </Alert>
        <Alert variant="alert" className="w-full">
          <AlertTitle>{t("alert.alertTitle")}</AlertTitle>
          <AlertDescription>{t("alert.alert")}</AlertDescription>
        </Alert>
      </Demo>

      <Demo id="save-actions" title={t("primitives.save-actions")}>
        <SaveDemo />
      </Demo>

      <Demo id="search" title={t("primitives.search")}>
        <SearchDemo />
      </Demo>
    </>
  );
}

// Editing a record (docs/design/beui-map.md, "Patterns"): Save and Discard once something changed,
// then "Saved" for a moment.
function SaveDemo() {
  const t = useTranslations("design");
  const [saved, setSaved] = useState(t("sample.value"));
  const [name, setName] = useState(saved);
  const [state, setState] = useSaveState();
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setState("saving");
        setTimeout(() => {
          setSaved(name);
          setState("saved");
        }, SAVE_DELAY);
      }}
      className="flex w-full flex-col gap-3"
    >
      <Input
        label={t("label.text")}
        value={name}
        onChange={(value) => {
          setName(value);
          setState("idle");
        }}
        className="w-full sm:w-72"
      />
      <SaveActions
        dirty={name !== saved}
        state={state}
        onDiscard={() => setName(saved)}
        words={{ save: t("button.primary"), saving: t("states.loading") }}
      />
    </form>
  );
}

// A search over a list, and what it shows when nothing matches.
function SearchDemo() {
  const t = useTranslations("design.search");
  const [query, setQuery] = useState("");
  const items = t.raw("items") as string[];
  const typed = toLatinDigits(query.trim());
  const found = items.filter((item) => item.includes(typed));
  return (
    <div className="flex w-full flex-col gap-3">
      <SearchField
        label={t("label")}
        placeholder={t("placeholder")}
        value={query}
        onChange={setQuery}
        results={found.length}
        className="sm:w-72"
      />
      {found.length > 0 ? (
        <ul className="flex flex-col divide-y rounded-xl border bg-card text-sm">
          {found.map((item) => (
            <li key={item} className="px-4 py-2.5">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <NoResults query={query} onClear={() => setQuery("")} />
      )}
    </div>
  );
}

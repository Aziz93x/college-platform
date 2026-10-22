"use client";

import { useFormatter, useTranslations } from "next-intl";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { Input } from "@/components/motion/input";
import { SaveActions } from "@/components/save-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { resetSettingAction, saveSettingAction } from "./actions.ts";
import { parseWhole, SettingField } from "./setting-field.tsx";
import {
  readColumns,
  resettable,
  type SettingView,
  sameValue,
} from "./setting-view.ts";
import { type SettingWords, useSettingWords } from "./use-setting-words.ts";

// What a field holds while it is edited: a number field the text typed, in the page's digits.
function fieldValue(setting: SettingView, value: unknown, words: SettingWords) {
  if (setting.control.kind === "number") return words.number(Number(value));
  if (setting.control.kind === "text") return value ?? "";
  if (setting.control.kind === "columns") {
    return (
      value ??
      Object.fromEntries(setting.control.fields.map((field) => [field, ""]))
    );
  }
  return value;
}

// The value a field's contents stand for, with what is wrong with them when they stand for none.
function readField(
  setting: SettingView,
  shown: unknown,
  words: SettingWords,
):
  | { value: unknown; error?: undefined }
  | { value?: undefined; error: string } {
  const { control } = setting;
  if (control.kind === "number") {
    const typed = parseWhole(String(shown));
    if (typed === undefined) return { error: words.t("errors.whole") };
    if (typed < control.min || typed > control.max) {
      return {
        error: words.t("errors.range", {
          min: words.number(control.min),
          max: words.number(control.max),
        }),
      };
    }
    return { value: typed };
  }
  if (control.kind === "text") {
    const text = String(shown).trim();
    if (text) return { value: text };
    return control.nullable
      ? { value: null }
      : { error: words.t("errors.invalid") };
  }
  if (control.kind === "list" && (shown as string[]).length === 0) {
    return { error: words.t("errors.empty") };
  }
  if (control.kind === "columns") {
    const read = readColumns(control.fields, shown as Record<string, string>);
    return read.error ? { error: words.t(`errors.${read.error}`) } : read;
  }
  return { value: shown };
}

type Action = "save" | "reset";

// One setting: what it is, its control, and saving or resetting it. A security setting asks for
// the password again, in the row itself, when the server says it is due.
export function SettingRow({
  setting,
  draft,
  onDraft,
}: {
  setting: SettingView;
  /** The value being edited, kept by the screen so it survives a tab change; undefined while none. */
  draft: unknown;
  onDraft: (draft: unknown) => void;
}) {
  const words = useSettingWords();
  const { t } = words;
  const refusals = useTranslations("actions");
  const reauth = useTranslations("reauth");
  const format = useFormatter();
  const id = useId();
  const ids = { label: `${id}-label`, description: `${id}-description` };
  const label = words.label(setting);

  const editing = draft !== undefined;
  const shown = editing ? draft : fieldValue(setting, setting.value, words);
  const read = readField(setting, shown, words);
  const dirty =
    editing &&
    (read.error !== undefined || !sameValue(read.value, setting.value));
  // A setting with no default to go back to offers neither its default nor a reset.
  const atDefault =
    sameValue(setting.value, setting.defaultValue) || !resettable(setting);

  const [saved, setSaved] = useState(false);
  const [asking, setAsking] = useState<Action | null>(null);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string>();
  const [refusal, setRefusal] = useState<string>();
  const [running, setRunning] = useState<Action | null>(null);
  const [, startTransition] = useTransition();

  // Once the page carries a new value (the one just saved, drawn again by the action), a draft
  // equal to it has nothing of its own left to hold. Only then: while someone types, a trailing
  // space must stay where it is even though the value it stands for has not changed.
  const latest = useRef({ editing, read, onDraft });
  useLayoutEffect(() => {
    latest.current = { editing, read, onDraft };
  });
  useEffect(() => {
    const { editing, read, onDraft } = latest.current;
    if (editing && sameValue(read.value, setting.value)) onDraft(undefined);
  }, [setting.value]);

  // "Saved" shows for a moment, then the button leaves.
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [saved]);

  const run = (action: Action) =>
    startTransition(async () => {
      setRunning(action);
      setRefusal(undefined);
      const typed = asking ? password : undefined;
      const result =
        action === "save"
          ? await saveSettingAction({
              key: setting.key,
              value: read.value,
              password: typed,
            })
          : await resetSettingAction({ key: setting.key, password: typed });
      setRunning(null);
      const outcome = result?.data;
      if (!outcome) {
        setRefusal(refusals(result?.serverError ?? "unexpected"));
        return;
      }
      switch (outcome.status) {
        case "passwordRequired":
          setAsking(action);
          return;
        case "wrongPassword":
          setPassword("");
          setPasswordError(reauth("wrong"));
          return;
        case "locked":
          setAsking(null);
          setRefusal(reauth("locked", { minutes: outcome.minutes }));
          return;
        case "invalid":
          setRefusal(t("errors.invalid"));
          return;
        case "eventsOutside":
          setRefusal(
            t("errors.eventsOutside", {
              term: outcome.term,
              events: format.list(outcome.events),
            }),
          );
          return;
      }
      setAsking(null);
      setPassword("");
      setPasswordError(undefined);
      if (action === "save") {
        setSaved(true);
        toast.success(t("toast.saved", { label }));
      } else {
        onDraft(undefined);
        toast.success(t("toast.reset", { label }));
      }
    });

  const submit = () => {
    if (asking) {
      if (!password) setPasswordError(reauth("required"));
      else run(asking);
    } else if (dirty && read.error === undefined) {
      run("save");
    }
  };

  const isSwitch = setting.control.kind === "switch";
  const field = (
    <SettingField
      setting={setting}
      value={shown}
      onChange={(value) => {
        onDraft(value);
        setRefusal(undefined);
      }}
      error={editing ? read.error : undefined}
      ids={ids}
      words={words}
    />
  );

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className={cn(
        "flex flex-col gap-4 px-5 py-5 sm:px-6",
        !isSwitch &&
          "lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-x-12",
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 id={ids.label} className="font-medium text-base">
            {label}
          </h3>
          <p
            id={ids.description}
            className="mt-1 max-w-prose text-pretty text-muted-foreground text-sm"
          >
            {words.description(setting)}
          </p>
          {atDefault ? null : (
            <p className="mt-2 text-muted-foreground text-xs">
              {t("default", {
                value: words.describe(setting, setting.defaultValue),
              })}
            </p>
          )}
        </div>
        {isSwitch ? <div className="pt-0.5">{field}</div> : null}
      </div>

      <div className="flex flex-col gap-3 lg:items-end">
        {isSwitch ? null : field}
        {asking ? (
          <Input
            type="password"
            label={reauth("password")}
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(text) => {
              setPassword(text);
              setPasswordError(undefined);
            }}
            hint={t("reauth.description")}
            error={passwordError}
            className="w-full lg:w-80"
          />
        ) : null}
        {refusal ? (
          <p role="alert" className="text-alert text-sm">
            {refusal}
          </p>
        ) : null}
        {!atDefault && !dirty && !asking && running === null && !saved ? (
          <div className="flex lg:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => run("reset")}
              className="text-muted-foreground"
            >
              {t("reset")}
            </Button>
          </div>
        ) : null}
        <SaveActions
          dirty={dirty}
          state={running !== null ? "saving" : saved ? "saved" : "idle"}
          asking={asking !== null}
          disabled={dirty && read.error !== undefined}
          onDiscard={() => {
            onDraft(undefined);
            setAsking(null);
            setRefusal(undefined);
          }}
          words={{
            save: t("save"),
            saving: t("saving"),
            confirm: reauth("submit"),
            confirming: reauth("confirming"),
          }}
          className="justify-start lg:justify-end"
        />
      </div>
    </form>
  );
}

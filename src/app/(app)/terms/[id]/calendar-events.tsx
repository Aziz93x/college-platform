"use client";

import { LoaderCircle, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionSwapButton } from "@/components/motion/action-swap";
import { BottomSheet } from "@/components/motion/bottom-sheet";
import { DateRangePickerDropdown } from "@/components/motion/date-range-picker";
import { Input } from "@/components/motion/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/motion/select";
import { Button } from "@/components/ui/button";
import { useDateRangeWords } from "@/components/use-date-range-words";
import type { CalendarEventKind } from "@/modules/terms";
import { firstDayOfWeek } from "@/platform/i18n/language";
import { oneLine } from "@/platform/validation/text";
import {
  addCalendarEventAction,
  removeCalendarEventAction,
  updateCalendarEventAction,
} from "../actions.ts";

type EventView = {
  id: string;
  kind: CalendarEventKind;
  title: string;
  startsOn: string;
  endsOn: string;
  /** Its days as the page writes them, and on the Umm al-Qura calendar where the college shows it. */
  days: string;
  hijri?: string;
  /** The weeks of the term it takes out of the count, and the numbered weeks it falls in. */
  skipped: number;
  from?: number;
  to?: number;
  /** One of the college's Eid breaks (ADR-0018): adjusted on the terms page, not here. */
  college: boolean;
};

type Draft = {
  kind: CalendarEventKind;
  title: string;
  range: { from: string; to?: string } | null;
};

const BLANK: Draft = { kind: "holiday", title: "", range: null };

// The term's calendar in order: each day or days with its kind, its title, its days and the weeks
// it falls in, a holiday with the weeks it takes out of the count. The vice-dean adds and edits them
// in a sheet, and a sheet confirms a removal. A day outside the term, or a change that would leave
// another outside it, is refused with the days named.
export function CalendarEvents({
  termId,
  editable,
  kinds: kindsOffered,
  firstDay,
  today,
  events,
}: {
  termId: string;
  /** The kinds of day a calendar holds, in the order they are offered. */
  kinds: readonly CalendarEventKind[];
  /** Whether the viewer changes the calendar: the vice-dean's, until the term is closed. */
  editable: boolean;
  /** The term's first day: no day of its calendar comes before it. */
  firstDay: string;
  today: string;
  events: EventView[];
}) {
  const t = useTranslations("terms.calendar");
  const kinds = useTranslations("terms.kinds");
  const ui = useTranslations("ui");
  const refusals = useTranslations("actions");
  const format = useFormatter();
  const locale = useLocale();
  const id = useId();
  // The event being edited, a new one ("new"), or none.
  const [editing, setEditing] = useState<EventView | "new">();
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [removing, setRemoving] = useState<EventView>();
  const [error, setError] = useState<string>();
  const [running, setRunning] = useState(false);
  const [, startTransition] = useTransition();
  const dateWords = useDateRangeWords(t("days"));

  const open = (event?: EventView) => {
    setEditing(event ?? "new");
    setDraft(
      event
        ? {
            kind: event.kind,
            title: event.title,
            range: { from: event.startsOn, to: event.endsOn },
          }
        : BLANK,
    );
    setError(undefined);
  };

  const refuse = (
    outcome: { status: string; events?: string[] } | undefined,
    serverError?: "signedOut" | "forbidden" | "unexpected",
  ) => {
    switch (outcome?.status) {
      case "eventsOutside":
        setError(t("outside", { events: format.list(outcome.events ?? []) }));
        return;
      case "closed":
        setError(t("closed"));
        return;
      case "notFound":
      case "eventNotFound":
        setError(t("gone"));
        return;
      default:
        setError(refusals(serverError ?? "unexpected"));
    }
  };

  const save = () => {
    const title = oneLine(draft.title);
    const range = draft.range;
    if (!title || !range?.to) {
      setError(title ? t("daysRequired") : t("titleRequired"));
      return;
    }
    const input = {
      termId,
      kind: draft.kind,
      title,
      startsOn: range.from,
      endsOn: range.to,
    };
    const current = editing;
    startTransition(async () => {
      setRunning(true);
      setError(undefined);
      const result =
        current && current !== "new"
          ? await updateCalendarEventAction({ ...input, eventId: current.id })
          : await addCalendarEventAction(input);
      setRunning(false);
      if (result?.data?.status === "saved") {
        toast.success(
          current === "new" ? t("added", { title }) : t("saved", { title }),
        );
        setEditing(undefined);
        return;
      }
      refuse(result?.data, result?.serverError);
    });
  };

  const remove = () => {
    const event = removing;
    if (!event) return;
    startTransition(async () => {
      setRunning(true);
      setError(undefined);
      const result = await removeCalendarEventAction({
        termId,
        eventId: event.id,
      });
      setRunning(false);
      if (result?.data?.status === "saved") {
        toast.success(t("removed", { title: event.title }));
        setRemoving(undefined);
        return;
      }
      refuse(result?.data, result?.serverError);
    });
  };

  const weeksOf = (event: EventView) => {
    if (event.kind === "holiday" && event.skipped > 0) {
      return t("skipped", { count: event.skipped });
    }
    if (event.from === undefined || event.to === undefined) return undefined;
    return event.from === event.to
      ? t("week", { number: event.from })
      : t("weeks", { from: event.from, to: event.to });
  };

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="rounded-xl border bg-card shadow-xs"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="font-medium text-base">
            {t("title")}
          </h2>
          <p className="mt-1 max-w-prose text-pretty text-muted-foreground text-sm">
            {t("description")}
          </p>
        </div>
        {editable ? (
          <Button type="button" variant="outline" onClick={() => open()}>
            <Plus aria-hidden />
            {t("add")}
          </Button>
        ) : null}
      </div>
      {events.length > 0 ? (
        <ul aria-label={t("list")} className="mt-4 divide-y border-t">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex items-start justify-between gap-3 px-5 py-3 sm:px-6"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="rounded-full border px-2 py-0.5 font-medium text-xs">
                    {event.college ? t("collegeBreak") : kinds(event.kind)}
                  </span>
                  <span className="font-medium text-sm">{event.title}</span>
                </p>
                <p className="mt-1 text-sm tabular-nums">
                  {event.days}
                  {weeksOf(event) ? (
                    <>
                      <span aria-hidden> · </span>
                      <span className="text-muted-foreground">
                        {weeksOf(event)}
                      </span>
                    </>
                  ) : null}
                </p>
                {event.hijri ? (
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {event.hijri}
                  </p>
                ) : null}
              </div>
              {editable && !event.college ? (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("edit", { title: event.title })}
                    onClick={() => open(event)}
                  >
                    <Pencil aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("remove", { title: event.title })}
                    onClick={() => {
                      setRemoving(event);
                      setError(undefined);
                    }}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 pt-3 pb-5 text-muted-foreground text-sm sm:px-6">
          {t("empty")}
        </p>
      )}
      {events.length > 0 ? <div className="h-2" /> : null}

      {editing ? (
        <BottomSheet
          open
          onOpenChange={(next) => {
            if (!next) setEditing(undefined);
          }}
          snapPoints={["auto"]}
          title={
            editing === "new"
              ? t("addTitle")
              : t("editTitle", { title: editing.title })
          }
          description={t("sheetDescription")}
          closeLabel={ui("close")}
        >
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
            className="flex flex-col gap-4 pt-2 pb-2"
          >
            <div className="flex flex-col gap-1.5">
              <span id={`${id}-kind`} className="px-1 font-medium text-sm">
                {t("kind")}
              </span>
              <Select
                aria-labelledby={`${id}-kind`}
                value={draft.kind}
                onValueChange={(kind) =>
                  setDraft((current) => ({
                    ...current,
                    kind: kind as CalendarEventKind,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {kindsOffered.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {kinds(kind)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              label={t("eventTitle")}
              autoComplete="off"
              value={draft.title}
              onChange={(title) =>
                setDraft((current) => ({ ...current, title }))
              }
            />
            <div className="flex flex-col gap-1.5">
              <span className="px-1 font-medium text-sm">{t("days")}</span>
              <DateRangePickerDropdown
                closeOnSelect
                value={draft.range}
                onValueChange={(range) =>
                  setDraft((current) => ({ ...current, range }))
                }
                words={dateWords}
                placeholder={t("daysPlaceholder")}
                locale={locale}
                weekStartsOn={firstDayOfWeek(locale)}
                min={firstDay}
                today={today}
              />
            </div>
            {error ? (
              <p role="alert" className="text-alert text-sm">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <ActionSwapButton
                type="submit"
                disabled={running}
                value={running ? "saving" : "save"}
                items={[
                  { id: "save", label: t("save"), icon: <Save /> },
                  {
                    id: "saving",
                    label: t("saving"),
                    icon: <LoaderCircle className="animate-spin" />,
                  },
                ]}
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditing(undefined)}
              >
                {ui("cancel")}
              </Button>
            </div>
          </form>
        </BottomSheet>
      ) : null}

      {removing ? (
        <BottomSheet
          open
          onOpenChange={(next) => {
            if (!next) setRemoving(undefined);
          }}
          snapPoints={["auto"]}
          title={t("removeTitle", { title: removing.title })}
          description={t("removeDescription")}
          closeLabel={ui("close")}
        >
          <div className="flex flex-col gap-4 pt-2 pb-2">
            {error ? (
              <p role="alert" className="text-alert text-sm">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <ActionSwapButton
                type="button"
                onClick={remove}
                disabled={running}
                value={running ? "removing" : "remove"}
                items={[
                  { id: "remove", label: t("removeConfirm"), icon: <Trash2 /> },
                  {
                    id: "removing",
                    label: t("removing"),
                    icon: <LoaderCircle className="animate-spin" />,
                  },
                ]}
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => setRemoving(undefined)}
              >
                {ui("cancel")}
              </Button>
            </div>
          </div>
        </BottomSheet>
      ) : null}
    </section>
  );
}

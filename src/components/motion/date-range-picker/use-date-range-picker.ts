"use client";

import { useReducedMotion } from "motion/react";
import {
  type KeyboardEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useHoverCapable } from "../lib/use-hover-capable";
import { DAY, iso, monthOf, ordered, parse, shiftMonth } from "./date-utils";
import type { DateRange, DateRangePickerProps } from "./types";

export function useDateRangePickerController({
  value,
  onValueChange,
  words,
  locale,
  weekStartsOn,
  min,
  max,
  isUnavailable,
  today: givenToday,
  disabled = false,
  autoFocus = false,
  showSummary = true,
  closeOnSelect = false,
  single = false,
}: DateRangePickerProps) {
  const label = words.label;
  const [today] = useState(() => {
    if (givenToday) return givenToday;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [open, setOpenState] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const setOpen = (next: boolean) => {
    setOpenState(next);
    if (!next && content.current?.contains(document.activeElement))
      trigger.current?.focus({ preventScroll: true });
  };
  useLayoutEffect(() => {
    if (!open && content.current?.contains(document.activeElement))
      trigger.current?.focus({ preventScroll: true });
  }, [open]);
  if (min) parse(min);
  if (max) parse(max);
  if (min && max && min > max)
    throw new Error("DateRangePicker min must not exceed max.");
  if (value) {
    parse(value.from);
    if (value.to) {
      parse(value.to);
      if (value.to < value.from)
        throw new Error("DateRangePicker range must be ordered.");
    }
  }
  const initial =
    value?.from ??
    (min && today < min ? min : max && today > max ? max : today);
  const [requestedMonth, setMonth] = useState(() => monthOf(initial));
  const month =
    min && requestedMonth < monthOf(min)
      ? monthOf(min)
      : max && requestedMonth > monthOf(max)
        ? monthOf(max)
        : requestedMonth;
  if (requestedMonth !== month) setMonth(month);
  const [cursor, setCursor] = useState<string | null>(
    () => value?.from ?? initial,
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [direction, setDirection] = useState(1);
  const [announcement, setAnnouncement] = useState("");
  const [view, setView] = useState<"days" | "months" | "years">("days");
  const [requestedYearPage, setYearPage] = useState(
    () => Math.floor(Number(initial.slice(0, 4)) / 12) * 12,
  );
  const [focusChoices, setFocusChoices] = useState(false);
  const monthTrigger = useRef<HTMLButtonElement>(null);
  const yearTrigger = useRef<HTMLButtonElement>(null);
  const returnToTrigger = useRef<"months" | "years" | null>(null);
  const grid = useRef<HTMLTableElement>(null);
  const pendingFocus = useRef(autoFocus);
  const heading = useId();
  const help = useId();
  const choicesId = useId();
  const reduce = useReducedMotion() ?? false;
  const canHover = useHoverCapable();
  // Day numbers and years in the college's digits.
  const numberFormat = new Intl.NumberFormat(locale, { useGrouping: false });
  const monthFormat = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const monthNameFormat = new Intl.DateTimeFormat(locale, {
    month: "long",
    timeZone: "UTC",
  });
  const dateFormat = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const shortFormat = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const unavailable = (date: string) =>
    disabled ||
    Boolean(min && date < min) ||
    Boolean(max && date > max) ||
    Boolean(isUnavailable?.(date));
  // A range's interior lies between its ends, so its ends alone decide.
  const rangeAvailable = (range: DateRange) =>
    parse(range.from) <= parse(range.to ?? range.from) &&
    !unavailable(range.from) &&
    !unavailable(range.to ?? range.from);
  const lastDay = new Date(parse(month));
  lastDay.setUTCMonth(lastDay.getUTCMonth() + 1);
  lastDay.setUTCDate(0);
  const daysInMonth = lastDay.getUTCDate();
  const dates = Array.from({ length: daysInMonth }, (_, index) =>
    iso(parse(month) + index * DAY),
  );
  const active =
    cursor && dates.includes(cursor) && !unavailable(cursor)
      ? cursor
      : (dates.find((date) => !unavailable(date)) ?? null);
  if (cursor !== null && cursor !== active) setCursor(active);
  const shownRange =
    value &&
    !value.to &&
    preview &&
    rangeAvailable(ordered(value.from, preview))
      ? ordered(value.from, preview)
      : value;
  const latest = useRef({ month, active });
  useLayoutEffect(() => {
    latest.current = { month, active };
  });
  useLayoutEffect(() => {
    if (returnToTrigger.current) {
      const target = returnToTrigger.current;
      returnToTrigger.current = null;
      (target === "months" ? monthTrigger : yearTrigger).current?.focus({
        preventScroll: true,
      });
    }
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    const button = grid.current?.querySelector<HTMLButtonElement>(
      'button[tabindex="0"]',
    );
    (button ?? grid.current)?.focus({ preventScroll: true });
  });

  const change = (next: DateRange | null) => {
    if (disabled || (next && !rangeAvailable(next))) return;
    onValueChange(next);
    setPreview(null);
    if (next?.to && open && closeOnSelect) setOpen(false);
  };
  const select = (date: string) => {
    if (unavailable(date)) return;
    setCursor(date);
    if (single) {
      change({ from: date, to: date });
      setAnnouncement(words.dayChosen(dateFormat.format(parse(date))));
      return;
    }
    if (!value || value.to) {
      change({ from: date });
      setAnnouncement(words.startChosen(dateFormat.format(parse(date))));
    } else {
      const next = ordered(value.from, date);
      if (!rangeAvailable(next)) {
        setAnnouncement(words.unavailable);
        return;
      }
      change(next);
      setAnnouncement(
        words.rangeChosen(
          shortFormat.format(parse(next.from)),
          shortFormat.format(parse(next.to)),
        ),
      );
    }
  };
  const navigate = (
    offset: number,
    focus = false,
    target = latest.current.active ?? latest.current.month,
  ) => {
    const next = shiftMonth(target, offset);
    if (
      (min && monthOf(next) < monthOf(min)) ||
      (max && monthOf(next) > monthOf(max))
    )
      return;
    latest.current = { month: monthOf(next), active: next };
    setDirection(offset > 0 ? 1 : -1);
    setMonth(monthOf(next));
    setCursor(next);
    setPreview(null);
    pendingFocus.current = focus;
  };
  const onKey = (event: KeyboardEvent<HTMLButtonElement>, date: string) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      navigate(
        (event.key === "PageUp" ? -1 : 1) * (event.shiftKey ? 12 : 1),
        true,
        date,
      );
      return;
    }
    const base = latest.current.active ?? date;
    // The day's place in the college's week, 0 for its first day.
    const weekday = (new Date(parse(base)).getUTCDay() - weekStartsOn + 7) % 7;
    // Left and right follow the reading direction.
    const forward =
      getComputedStyle(event.currentTarget).direction === "rtl"
        ? "ArrowLeft"
        : "ArrowRight";
    const offset =
      event.key === "ArrowLeft" || event.key === "ArrowRight"
        ? event.key === forward
          ? 1
          : -1
        : event.key === "ArrowUp"
          ? -7
          : event.key === "ArrowDown"
            ? 7
            : event.key === "Home"
              ? -weekday
              : event.key === "End"
                ? 6 - weekday
                : null;
    if (offset === null) return;
    event.preventDefault();
    let next = iso(parse(base) + offset * DAY);
    // Arrow navigation skips unavailable dates; Home/End stay within their week.
    if (event.key !== "Home" && event.key !== "End") {
      const step = offset < 0 ? -1 : 1;
      for (let attempts = 0; unavailable(next) && attempts < 366; attempts++) {
        if ((min && next < min) || (max && next > max)) return;
        next = iso(parse(next) + step * DAY);
      }
    }
    if (unavailable(next)) return;
    const nextMonth = monthOf(next);
    setDirection(nextMonth >= latest.current.month ? 1 : -1);
    // Own event updates are visible to a second key in the same batch.
    latest.current = { month: nextMonth, active: next };
    pendingFocus.current = true;
    setMonth(nextMonth);
    setCursor(next);
    setPreview(value && !value.to ? next : null);
  };
  const leading = (new Date(parse(month)).getUTCDay() - weekStartsOn + 7) % 7;
  const cells: (string | null)[] = [
    ...Array<string | null>(leading).fill(null),
    ...dates,
  ];
  // Six rows keep the surface stable while changing months or browsing years.
  while (cells.length < 42) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, index) => ({
    start: iso(parse(month) + (index * 7 - leading) * DAY),
    dates: cells.slice(index * 7, index * 7 + 7),
  }));
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1;
  const minYear = min ? Number(min.slice(0, 4)) : 0;
  const maxYear = max ? Number(max.slice(0, 4)) : 9999;
  const firstYearPage = minYear;
  // Backfill the final page so it still has twelve years when the bounds allow it.
  const lastYearPage = Math.max(minYear, maxYear - 11);
  const yearPage = Math.min(
    lastYearPage,
    Math.max(firstYearPage, requestedYearPage),
  );
  if (requestedYearPage !== yearPage) setYearPage(yearPage);
  const yearPageEnd = Math.min(yearPage + 11, maxYear);
  const previousDisabled =
    disabled ||
    (view === "years"
      ? yearPage <= firstYearPage
      : view === "months"
        ? year <= minYear
        : (year === 0 && monthIndex === 0) ||
          Boolean(min && monthOf(shiftMonth(month, -1)) < monthOf(min)));
  const nextDisabled =
    disabled ||
    (view === "years"
      ? yearPage >= lastYearPage
      : view === "months"
        ? year >= maxYear
        : (year === 9999 && monthIndex === 11) ||
          Boolean(max && monthOf(shiftMonth(month, 1)) > monthOf(max)));
  const closeChoices = () => {
    returnToTrigger.current = view === "years" ? "years" : "months";
    setView("days");
  };
  const openChoices = (next: "months" | "years") => {
    if (disabled) return;
    if (view === next) {
      closeChoices();
      return;
    }
    setPreview(null);
    setFocusChoices(true);
    if (next === "years")
      setYearPage(
        Math.min(
          lastYearPage,
          Math.max(
            firstYearPage,
            minYear + Math.floor((year - minYear) / 12) * 12,
          ),
        ),
      );
    setView(next);
  };
  const goToMonth = (next: string) => {
    if (disabled) return;
    const clamped =
      min && next < monthOf(min)
        ? monthOf(min)
        : max && next > monthOf(max)
          ? monthOf(max)
          : next;
    setDirection(clamped >= month ? 1 : -1);
    setMonth(clamped);
    setCursor(clamped);
    setPreview(null);
    closeChoices();
  };
  const page = (step: -1 | 1) => {
    setFocusChoices(false);
    if (view === "years") {
      setDirection(step);
      const next = Math.min(
        lastYearPage,
        Math.max(firstYearPage, yearPage + step * 12),
      );
      if (next === firstYearPage || next === lastYearPage)
        returnToTrigger.current = "years";
      setYearPage((current) =>
        Math.min(lastYearPage, Math.max(firstYearPage, current + step * 12)),
      );
    } else if (view === "months") {
      const next = shiftMonth(month, step * 12);
      const clamped =
        min && next < monthOf(min)
          ? monthOf(min)
          : max && next > monthOf(max)
            ? monthOf(max)
            : monthOf(next);
      setDirection(step);
      setMonth(clamped);
      setCursor(clamped);
      if (
        Number(clamped.slice(0, 4)) === minYear ||
        Number(clamped.slice(0, 4)) === maxYear
      )
        returnToTrigger.current = "months";
    } else {
      const next = monthOf(shiftMonth(latest.current.active ?? month, step));
      if (next === (min && monthOf(min)) || next === (max && monthOf(max)))
        returnToTrigger.current = "months";
      navigate(step);
    }
  };
  const choices =
    view === "months"
      ? Array.from({ length: 12 }, (_, index) => {
          const date = `${String(year).padStart(4, "0")}-${String(index + 1).padStart(2, "0")}-01`;
          return {
            id: date,
            label: monthNameFormat.format(parse(date)),
            disabled:
              disabled ||
              Boolean(min && date < monthOf(min)) ||
              Boolean(max && date > monthOf(max)),
          };
        })
      : Array.from(
          { length: Math.max(0, yearPageEnd - yearPage + 1) },
          (_, index) => {
            const choiceYear = yearPage + index;
            return {
              id: String(choiceYear),
              label: numberFormat.format(choiceYear),
              disabled:
                disabled || choiceYear < minYear || choiceYear > maxYear,
            };
          },
        );
  const dayCount = value?.to
    ? Math.round((parse(value.to) - parse(value.from)) / DAY) + 1
    : null;

  const clear = () => {
    if (disabled) return;
    if (view === "days") pendingFocus.current = true;
    else returnToTrigger.current = view;
    change(null);
    setAnnouncement(words.cleared);
  };
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      // A reopened popover starts a fresh calendar session, retaining its range.
      setMonth(monthOf(initial));
      setCursor(value?.from ?? initial);
      setPreview(null);
      setView("days");
      setFocusChoices(false);
      setAnnouncement("");
    }
  }
  return {
    value,
    change,
    open,
    setOpen,
    trigger,
    content,
    label,
    words,
    locale,
    weekStartsOn,
    numberFormat,
    disabled,
    autoFocus,
    showSummary,
    today,
    month,
    view,
    heading,
    help,
    choicesId,
    monthTrigger,
    yearTrigger,
    monthFormat,
    monthNameFormat,
    shortFormat,
    dateFormat,
    year,
    yearPage,
    yearPageEnd,
    previousDisabled,
    nextDisabled,
    openChoices,
    page,
    direction,
    reduce,
    choices,
    focusChoices,
    closeChoices,
    goToMonth,
    grid,
    active,
    weeks,
    shownRange,
    canHover,
    unavailable,
    setPreview,
    select,
    setCursor,
    onKey,
    dayCount,
    clear,
    announcement,
  };
}

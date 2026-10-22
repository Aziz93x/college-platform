import type { ReactNode } from "react";

/** Calendar dates, independent of a browser's timezone: YYYY-MM-DD. */
export interface DateRange {
  from: string;
  to?: string;
}

// Every word the picker shows or announces, from the message catalog.
export interface DateRangePickerWords {
  // The calendar's name, and the trigger's words while nothing is chosen.
  label: string;
  placeholder: string;
  start: string;
  end: string;
  // A start or an end not chosen yet.
  unchosen: string;
  chooseMonth: string;
  chooseYear: string;
  monthsOf: (year: string) => string;
  yearsFrom: (from: string, to: string) => string;
  previous: { month: string; year: string; years: string };
  next: { month: string; year: string; years: string };
  // How to move through the calendar with the keyboard.
  help: string;
  startChosen: (date: string) => string;
  rangeChosen: (from: string, to: string) => string;
  // The one day chosen where the picker chooses one (single).
  dayChosen: (date: string) => string;
  unavailable: string;
  cleared: string;
  chooseStart: string;
  chooseEnd: string;
  days: (count: number) => string;
  clear: string;
  clearLabel: string;
}

export interface DateRangePickerProps {
  value: DateRange | null;
  onValueChange: (range: DateRange | null) => void;
  words: DateRangePickerWords;
  // The college's locale: month and weekday names, and digits.
  locale: string;
  // The first day of the week, 0 for Sunday.
  weekStartsOn: number;
  min?: string;
  max?: string;
  /** The day it is on the clock that counts, the college's (YYYY-MM-DD); the browser's own day when absent. */
  today?: string;
  disabled?: boolean;
  /** Move focus to the active date on mount, for use inside a popover. */
  autoFocus?: boolean;
  /** Show the start/end summary above the calendar. Default true. */
  showSummary?: boolean;
  className?: string;
  /** Compose custom controls; omitted children render the inline calendar. */
  children?: ReactNode;
  /** Close an open popover after a complete range. Default false. */
  closeOnSelect?: boolean;
  /** Choose one day: a tap completes the value, from and to that day. Default false. */
  single?: boolean;
}

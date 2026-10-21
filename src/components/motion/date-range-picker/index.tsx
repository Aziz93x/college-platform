"use client";

import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  AnimatePresence,
  type HTMLMotionProps,
  useIsPresent,
} from "motion/react";
import * as m from "motion/react-m";
import {
  type ComponentPropsWithoutRef,
  type ComponentPropsWithRef,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/components/ui/cn";
import { EASE_OUT, SPRING_LAYOUT, SPRING_PRESS } from "../lib/ease";
import {
  MorphPopover,
  MorphPopoverContent,
  type MorphPopoverContentProps,
  MorphPopoverTrigger,
} from "../popover-morph";
import { DateRangePickerContext, useDateRangePickerContext } from "./context";
import { parse } from "./date-utils";
import type { DateRangePickerProps } from "./types";
import { useDateRangePickerController } from "./use-date-range-picker";

export type {
  DateRange,
  DateRangePickerWords,
} from "./types";

const monthVariants = {
  enter: ({ direction, reduce }: { direction: number; reduce: boolean }) => ({
    opacity: 0,
    x: reduce ? 0 : direction * 12,
  }),
  exit: ({ direction, reduce }: { direction: number; reduce: boolean }) => ({
    opacity: 0,
    x: reduce ? 0 : direction * -8,
    transition: { duration: 0.12, ease: EASE_OUT },
  }),
};

const iconClass =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30";

/** Range state and popover root. Without children, renders the inline calendar. */
function DateRangePicker({
  children,
  className,
  ...props
}: DateRangePickerProps) {
  const ctx = useDateRangePickerController(props);
  return (
    <DateRangePickerContext.Provider value={ctx}>
      <MorphPopover
        open={ctx.open}
        onOpenChange={ctx.setOpen}
        className={cn("max-w-full", children !== undefined && className)}
      >
        {children === undefined ? (
          <DateRangePickerCalendar className={className} />
        ) : (
          children
        )}
      </MorphPopover>
    </DateRangePickerContext.Provider>
  );
}

interface DateRangePickerCalendarProps
  extends ComponentPropsWithoutRef<"section"> {
  showSummary?: boolean;
}

/** Calendar surface; arrange or omit its summary, header, grid and footer. */
function DateRangePickerCalendar({
  children,
  className,
  showSummary,
  ...props
}: DateRangePickerCalendarProps) {
  const ctx = useDateRangePickerContext("DateRangePickerCalendar");
  return (
    <section
      {...props}
      aria-label={props["aria-label"] ?? ctx.label}
      className={cn(
        "w-80 max-w-full rounded-2xl border border-border bg-background p-3.5",
        className,
      )}
    >
      <h3 id={ctx.heading} aria-live="polite" className="sr-only">
        {ctx.monthFormat.format(parse(ctx.month))}
      </h3>
      {children === undefined ? (
        <>
          {(showSummary ?? ctx.showSummary) && <DateRangePickerSummary />}
          <DateRangePickerHeader />
          <DateRangePickerGrid />
          <DateRangePickerFooter />
        </>
      ) : (
        children
      )}
      <p id={ctx.help} className="sr-only">
        {ctx.words.help}
      </p>
      <output className="sr-only">{ctx.announcement}</output>
    </section>
  );
}

type DateRangePickerSummaryProps = Omit<
  ComponentPropsWithoutRef<"div">,
  "children"
>;
function DateRangePickerSummary({
  className,
  ...props
}: DateRangePickerSummaryProps) {
  const { value, shortFormat, words } = useDateRangePickerContext(
    "DateRangePickerSummary",
  );
  return (
    <div
      {...props}
      className={cn(
        "mb-2.5 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="mb-1 font-medium text-muted-foreground text-xs">
          {words.start}
        </p>
        <p className="font-medium text-sm tabular-nums">
          {value ? shortFormat.format(parse(value.from)) : words.unchosen}
        </p>
      </div>
      <ArrowRight
        size={14}
        className="text-muted-foreground/60 rtl:-scale-x-100"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="mb-1 font-medium text-muted-foreground text-xs">
          {words.end}
        </p>
        <p
          className={cn(
            "font-medium text-sm tabular-nums",
            !value?.to && "text-muted-foreground",
          )}
        >
          {value?.to ? shortFormat.format(parse(value.to)) : words.unchosen}
        </p>
      </div>
    </div>
  );
}

type DateRangePickerHeaderProps = Omit<
  ComponentPropsWithoutRef<"div">,
  "children"
>;
function DateRangePickerHeader({
  className,
  ...props
}: DateRangePickerHeaderProps) {
  const {
    monthTrigger,
    yearTrigger,
    view,
    choicesId,
    disabled,
    openChoices,
    monthNameFormat,
    month,
    yearPage,
    yearPageEnd,
    year,
    previousDisabled,
    nextDisabled,
    page,
    words,
    numberFormat,
  } = useDateRangePickerContext("DateRangePickerHeader");
  return (
    <div
      {...props}
      className={cn("mb-2 flex items-center justify-between gap-1", className)}
    >
      <div className="flex min-w-0 items-center gap-0.5">
        <button
          ref={monthTrigger}
          type="button"
          aria-label={words.chooseMonth}
          aria-expanded={view === "months"}
          aria-controls={view === "months" ? choicesId : undefined}
          disabled={disabled}
          onClick={() => openChoices("months")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
            view === "years" && "hidden",
          )}
        >
          {monthNameFormat.format(parse(month))}
          <ChevronDown
            size={12}
            aria-hidden="true"
            className={cn(
              "text-muted-foreground",
              view === "months" && "rotate-180",
            )}
          />
        </button>
        <button
          ref={yearTrigger}
          type="button"
          aria-label={words.chooseYear}
          aria-expanded={view === "years"}
          aria-controls={view === "years" ? choicesId : undefined}
          disabled={disabled}
          onClick={() => openChoices("years")}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium tabular-nums text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
        >
          {view === "years"
            ? `${numberFormat.format(yearPage)}–${numberFormat.format(yearPageEnd)}`
            : numberFormat.format(year)}
          <ChevronDown
            size={12}
            aria-hidden="true"
            className={cn(view === "years" && "rotate-180")}
          />
        </button>
      </div>
      <div className="flex shrink-0 gap-0.5">
        <button
          type="button"
          aria-label={
            view === "years"
              ? words.previous.years
              : view === "months"
                ? words.previous.year
                : words.previous.month
          }
          disabled={previousDisabled}
          className={iconClass}
          onClick={() => page(-1)}
        >
          <ChevronLeft
            size={16}
            aria-hidden="true"
            className="rtl:-scale-x-100"
          />
        </button>
        <button
          type="button"
          aria-label={
            view === "years"
              ? words.next.years
              : view === "months"
                ? words.next.year
                : words.next.month
          }
          disabled={nextDisabled}
          hidden={view === "years" && nextDisabled}
          className={cn(
            iconClass,
            view === "years" && nextDisabled && "hidden",
          )}
          onClick={() => page(1)}
        >
          <ChevronRight
            size={16}
            aria-hidden="true"
            className="rtl:-scale-x-100"
          />
        </button>
      </div>
    </div>
  );
}

type DateRangePickerGridProps = Omit<
  ComponentPropsWithoutRef<"div">,
  "children"
>;
function DateRangePickerGrid({
  className,
  onPointerLeave,
  ...props
}: DateRangePickerGridProps) {
  const {
    setPreview,
    view,
    month,
    yearPage,
    yearPageEnd,
    year,
    direction,
    reduce,
    choicesId,
    choices,
    focusChoices,
    closeChoices,
    goToMonth,
    grid,
    heading,
    help,
    active,
    locale,
    weeks,
    shownRange,
    value,
    canHover,
    unavailable,
    dateFormat,
    today,
    select,
    setCursor,
    onKey,
    words,
    weekStartsOn,
    numberFormat,
  } = useDateRangePickerContext("DateRangePickerGrid");
  // Months slide toward the reading direction.
  const flow = document.documentElement.dir === "rtl" ? -direction : direction;
  return (
    <div
      {...props}
      className={cn("overflow-hidden", className)}
      onPointerLeave={(event) => {
        onPointerLeave?.(event);
        setPreview(null);
      }}
    >
      <AnimatePresence
        initial={false}
        mode="popLayout"
        custom={{ direction: flow, reduce }}
      >
        <m.div
          key={
            view === "days"
              ? month
              : `${view}-${view === "years" ? yearPage : year}`
          }
          custom={{ direction: flow, reduce }}
          variants={monthVariants}
          initial="enter"
          animate={{ opacity: 1, x: 0 }}
          exit="exit"
          transition={{ duration: reduce ? 0.1 : 0.18, ease: EASE_OUT }}
        >
          <CalendarPresence>
            {view !== "days" ? (
              <CalendarChoices
                id={choicesId}
                label={
                  view === "months"
                    ? words.monthsOf(numberFormat.format(year))
                    : words.yearsFrom(
                        numberFormat.format(yearPage),
                        numberFormat.format(yearPageEnd),
                      )
                }
                choices={choices}
                selected={view === "months" ? month : String(year)}
                focusOnMount={focusChoices}
                reduce={reduce}
                onClose={closeChoices}
                onSelect={(id) =>
                  goToMonth(
                    view === "months"
                      ? id
                      : `${id.padStart(4, "0")}-${month.slice(5, 7)}-01`,
                  )
                }
              />
            ) : (
              // biome-ignore lint/a11y/useSemanticElements: WAI calendar grids keep the native table's structure under an interactive grid role.
              <table
                ref={(node) => {
                  if (node) {
                    grid.current = node;
                    return () => {
                      if (grid.current === node) grid.current = null;
                    };
                  }
                }}
                // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: WAI calendar grids keep the native table's structure under an interactive grid role.
                role="grid"
                aria-labelledby={heading}
                aria-describedby={help}
                tabIndex={active === null ? 0 : undefined}
                className="w-full table-fixed select-none border-separate border-spacing-x-0 border-spacing-y-1"
              >
                <thead>
                  <tr>
                    {Array.from({ length: 7 }, (_, index) => {
                      // 4 January 2026 was a Sunday.
                      const weekday = Date.UTC(
                        2026,
                        0,
                        4 + ((index + weekStartsOn) % 7),
                      );
                      const day = new Intl.DateTimeFormat(locale, {
                        weekday: "long",
                        timeZone: "UTC",
                      }).format(weekday);
                      return (
                        <th
                          key={day}
                          scope="col"
                          abbr={day}
                          className="h-6 pb-1.5 text-center text-[11px] font-medium text-muted-foreground"
                        >
                          {new Intl.DateTimeFormat(locale, {
                            weekday: "short",
                            timeZone: "UTC",
                          }).format(weekday)}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {weeks.map(({ start, dates: week }) => (
                    <tr key={start}>
                      {week.map((date, dayIndex) => {
                        const inRange = Boolean(
                          date &&
                            shownRange &&
                            date >= shownRange.from &&
                            date <= (shownRange.to ?? shownRange.from),
                        );
                        const endpoint = Boolean(
                          date &&
                            value &&
                            (date === value.from || date === value.to),
                        );
                        return (
                          // biome-ignore lint/a11y/useFocusableInteractive: Calendar cells delegate focus to the contained day button.
                          // biome-ignore lint/a11y/useSemanticElements: Gridcell selection semantics belong on the native table cell.
                          <td
                            // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: Gridcell selection semantics belong on the native table cell.
                            role="gridcell"
                            key={date ?? `empty-${dayIndex}`}
                            aria-selected={
                              date
                                ? Boolean(
                                    value &&
                                      date >= value.from &&
                                      date <= (value.to ?? value.from),
                                  )
                                : undefined
                            }
                            onPointerEnter={(event) => {
                              if (
                                canHover &&
                                event.pointerType !== "touch" &&
                                date &&
                                !unavailable(date) &&
                                value &&
                                !value.to
                              )
                                setPreview(date);
                            }}
                            className={cn(
                              "relative h-8 p-0 text-center pointer-coarse:h-11",
                              inRange &&
                                (dayIndex === 0 || date === shownRange?.from) &&
                                "rounded-s-full",
                              inRange &&
                                (dayIndex === 6 ||
                                  date === shownRange?.to ||
                                  !shownRange?.to) &&
                                "rounded-e-full",
                            )}
                          >
                            {date && (
                              <span
                                aria-hidden="true"
                                // Range scrubbing follows immediately: independent cell
                                // fades leave stale highlights behind a moving pointer.
                                className={cn(
                                  "pointer-events-none absolute inset-y-0 rounded-[inherit] bg-foreground/[0.08]",
                                  inRange ? "opacity-100" : "opacity-0",
                                )}
                                style={{
                                  insetInlineStart:
                                    endpoint &&
                                    (date === shownRange?.from ||
                                      !week[dayIndex - 1])
                                      ? "50%"
                                      : 0,
                                  insetInlineEnd:
                                    endpoint &&
                                    (date ===
                                      (shownRange?.to ?? shownRange?.from) ||
                                      !week[dayIndex + 1])
                                      ? "50%"
                                      : 0,
                                }}
                              />
                            )}
                            {date && (
                              <m.button
                                type="button"
                                disabled={unavailable(date)}
                                aria-label={dateFormat.format(parse(date))}
                                aria-current={
                                  date === today ? "date" : undefined
                                }
                                tabIndex={date === active ? 0 : -1}
                                whileTap={reduce ? undefined : { scale: 0.9 }}
                                transition={SPRING_PRESS}
                                onClick={() => select(date)}
                                onFocus={() => {
                                  setCursor(date);
                                  if (value && !value.to) setPreview(date);
                                }}
                                onKeyDown={(event) => onKey(event, date)}
                                className={cn(
                                  "relative mx-auto flex h-8 w-full max-w-8 items-center justify-center rounded-full text-xs tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-30 pointer-coarse:h-11 pointer-coarse:max-w-11 pointer-coarse:text-sm",
                                  endpoint
                                    ? "bg-foreground font-medium text-background"
                                    : canHover &&
                                        !unavailable(date) &&
                                        !inRange &&
                                        "hover:bg-muted",
                                  date === today &&
                                    !endpoint &&
                                    "font-semibold after:absolute after:bottom-1 after:size-0.75 after:rounded-full after:bg-current",
                                )}
                              >
                                {numberFormat.format(
                                  new Date(parse(date)).getUTCDate(),
                                )}
                              </m.button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CalendarPresence>
        </m.div>
      </AnimatePresence>
    </div>
  );
}

type DateRangePickerSelectionProps = ComponentPropsWithoutRef<"p">;
function DateRangePickerSelection({
  children,
  className,
  ...props
}: DateRangePickerSelectionProps) {
  const { value, dayCount, words } = useDateRangePickerContext(
    "DateRangePickerSelection",
  );
  return (
    <p {...props} className={cn("text-muted-foreground text-xs", className)}>
      {children ??
        (dayCount
          ? words.days(dayCount)
          : value
            ? words.chooseEnd
            : words.chooseStart)}
    </p>
  );
}

type DateRangePickerClearProps = ComponentPropsWithRef<"button">;
function DateRangePickerClear({
  children,
  className,
  onClick,
  disabled,
  ...props
}: DateRangePickerClearProps) {
  const ctx = useDateRangePickerContext("DateRangePickerClear");
  return (
    <button
      {...props}
      type="button"
      aria-label={props["aria-label"] ?? ctx.words.clearLabel}
      disabled={disabled || ctx.disabled || !ctx.value}
      className={cn(
        "rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) ctx.clear();
      }}
    >
      {children ?? ctx.words.clear}
    </button>
  );
}

type DateRangePickerFooterProps = ComponentPropsWithoutRef<"div">;
function DateRangePickerFooter({
  children,
  className,
  ...props
}: DateRangePickerFooterProps) {
  return (
    <div
      {...props}
      className={cn("mt-2.5 border-t border-border pt-2.5", className)}
    >
      {children === undefined ? (
        <div className="flex items-center justify-between gap-2">
          <DateRangePickerSelection />
          <DateRangePickerClear />
        </div>
      ) : (
        children
      )}
    </div>
  );
}

interface DateRangePickerTriggerProps extends HTMLMotionProps<"button"> {
  placeholder?: string;
}
function DateRangePickerTrigger({
  children,
  placeholder,
  className,
  disabled,
  ref,
  ...props
}: DateRangePickerTriggerProps) {
  const ctx = useDateRangePickerContext("DateRangePickerTrigger");
  const mergedRef = useCallback(
    (node: HTMLButtonElement | null) => {
      ctx.trigger.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ctx.trigger, ref],
  );
  const format = new Intl.DateTimeFormat(ctx.locale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const sameYear =
    ctx.value?.to && ctx.value.from.slice(0, 4) === ctx.value.to.slice(0, 4);
  const summary = ctx.value
    ? `${(sameYear ? format : ctx.shortFormat).format(parse(ctx.value.from))} – ${ctx.value.to ? ctx.shortFormat.format(parse(ctx.value.to)) : ctx.words.unchosen}`
    : (placeholder ?? ctx.words.placeholder);
  return (
    <MorphPopoverTrigger>
      <m.button
        {...props}
        ref={mergedRef}
        layout={!ctx.reduce}
        transition={{ layout: SPRING_LAYOUT }}
        style={{ borderRadius: 8, ...props.style }}
        type="button"
        disabled={disabled || ctx.disabled}
        aria-label={props["aria-label"] ?? `${ctx.label}: ${summary}`}
        className={cn(
          "flex h-11 w-full items-center gap-2 rounded-lg border border-input bg-background px-3.5 text-base text-foreground outline-none transition-[border-color,box-shadow] hover:border-ring/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-50",
          className,
        )}
      >
        {children != null ? (
          <m.span
            layout={ctx.reduce ? false : "position"}
            transition={{ layout: SPRING_LAYOUT }}
            className="inline-flex min-w-0 items-center gap-2"
          >
            {children}
          </m.span>
        ) : (
          <>
            <m.span
              layout={ctx.reduce ? false : "position"}
              transition={{ layout: SPRING_LAYOUT }}
              className="shrink-0 text-muted-foreground"
              aria-hidden="true"
            >
              <CalendarDays className="size-4" />
            </m.span>
            <m.span
              layout={ctx.reduce ? false : "position"}
              transition={{ layout: SPRING_LAYOUT }}
              className={cn(
                "min-w-0 flex-1 truncate text-start tabular-nums",
                !ctx.value && "text-muted-foreground",
              )}
            >
              {summary}
            </m.span>
            <m.span
              layout={ctx.reduce ? false : "position"}
              transition={{ layout: SPRING_LAYOUT }}
              className="shrink-0 text-muted-foreground"
              aria-hidden="true"
            >
              <ChevronDown
                className={cn(
                  "size-4 transition-transform",
                  ctx.open && "rotate-180",
                )}
              />
            </m.span>
          </>
        )}
      </m.button>
    </MorphPopoverTrigger>
  );
}

interface DateRangePickerContentProps extends MorphPopoverContentProps {
  /** Move focus to the active calendar date when opened. Default true. */
  autoFocus?: boolean;
}

function focusCalendarDate(content: HTMLDivElement | null) {
  const grid = Array.from(
    content?.querySelectorAll<HTMLElement>('[role="grid"]') ?? [],
  ).find((element) => !element.closest("[inert]"));
  const target =
    grid?.querySelector<HTMLElement>('button[tabindex="0"]') ?? grid;
  target?.focus({ preventScroll: true });
}

function DateRangePickerContent({
  children,
  className,
  autoFocus = true,
  onOpenAutoFocus,
  ...props
}: DateRangePickerContentProps) {
  const ctx = useDateRangePickerContext("DateRangePickerContent");
  useLayoutEffect(() => {
    // A rapid reopen can revive the exiting surface before it unmounts.
    // That surface already ran its positioned callback, so focus it here too.
    if (ctx.open && autoFocus) focusCalendarDate(ctx.content.current);
  }, [ctx.open, ctx.content, autoFocus]);
  return (
    <MorphPopoverContent
      align="start"
      radius={16}
      shadow={false}
      {...props}
      className={cn("w-80 max-w-[calc(100vw-1.5rem)]", className)}
      onOpenAutoFocus={(content) => {
        ctx.content.current = content;
        if (autoFocus) focusCalendarDate(content);
        onOpenAutoFocus?.(content);
      }}
    >
      {children}
    </MorphPopoverContent>
  );
}

export interface DateRangePickerDropdownProps
  extends Omit<DateRangePickerProps, "children"> {
  placeholder?: string;
  triggerClassName?: string;
  calendarClassName?: string;
}
/** Convenience composition of the root, trigger, content and calendar. */
export function DateRangePickerDropdown({
  placeholder,
  triggerClassName,
  calendarClassName,
  autoFocus = true,
  showSummary = false,
  ...props
}: DateRangePickerDropdownProps) {
  return (
    <DateRangePicker {...props} autoFocus={autoFocus} showSummary={showSummary}>
      <DateRangePickerTrigger
        placeholder={placeholder}
        className={triggerClassName}
      />
      <DateRangePickerContent autoFocus={autoFocus}>
        <DateRangePickerCalendar
          className={cn("w-full rounded-none border-0", calendarClassName)}
        />
      </DateRangePickerContent>
    </DateRangePicker>
  );
}

// The departing month's grid must leave the tab order as soon as exit begins.
function CalendarPresence({ children }: { children: ReactNode }) {
  const present = useIsPresent();
  return <div inert={!present}>{children}</div>;
}

function CalendarChoices({
  id,
  label,
  choices,
  selected,
  focusOnMount,
  reduce,
  onClose,
  onSelect,
}: {
  id: string;
  label: string;
  choices: { id: string; label: string; disabled: boolean }[];
  selected: string;
  focusOnMount: boolean;
  reduce: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const enabled = choices.filter((choice) => !choice.disabled);
  const [cursor, setCursor] = useState<string | null>(selected);
  const active =
    enabled.find((choice) => choice.id === cursor)?.id ??
    enabled.find((choice) => choice.id === selected)?.id ??
    enabled[0]?.id;
  if (cursor !== null && cursor !== active) setCursor(active ?? null);
  const root = useRef<HTMLFieldSetElement>(null);
  useLayoutEffect(() => {
    if (focusOnMount)
      root.current
        ?.querySelector<HTMLButtonElement>('button[tabindex="0"]')
        ?.focus({ preventScroll: true });
  }, [focusOnMount]);
  const onKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const buttons = Array.from(
      root.current?.querySelectorAll<HTMLButtonElement>("button") ?? [],
    );
    const index = buttons.indexOf(event.currentTarget);
    const offset =
      event.key === "ArrowLeft"
        ? -1
        : event.key === "ArrowRight"
          ? 1
          : event.key === "ArrowUp"
            ? -3
            : event.key === "ArrowDown"
              ? 3
              : null;
    let target =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : offset === null
            ? null
            : index + offset;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (target === null) return;
    event.preventDefault();
    const step =
      offset === null ? (event.key === "Home" ? 1 : -1) : Math.sign(offset);
    while (target >= 0 && target < buttons.length && buttons[target].disabled)
      target += step;
    buttons[target]?.focus({ preventScroll: true });
  };
  return (
    <fieldset
      ref={root}
      id={id}
      aria-label={label}
      className="grid min-h-[15.25rem] grid-cols-3 content-start gap-2 border-0 p-0 pt-1"
    >
      {choices.map((choice) => (
        <m.button
          key={choice.id}
          type="button"
          disabled={choice.disabled}
          aria-pressed={choice.id === selected}
          tabIndex={choice.id === active ? 0 : -1}
          onFocus={() => setCursor(choice.id)}
          onKeyDown={onKey}
          onClick={() => onSelect(choice.id)}
          whileTap={reduce ? undefined : { scale: 0.96 }}
          transition={SPRING_PRESS}
          className={cn(
            "flex h-13 items-center justify-center rounded-xl px-1 text-[13px] tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-25",
            choice.id === selected
              ? "bg-foreground font-medium text-background"
              : "bg-muted/40 hover:bg-muted",
          )}
        >
          {choice.label}
        </m.button>
      ))}
    </fieldset>
  );
}

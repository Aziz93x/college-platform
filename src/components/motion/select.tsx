"use client";

import { Check, ChevronDown } from "lucide-react";
import {
  animate,
  type MotionValue,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
  type Variants,
} from "motion/react";
import * as m from "motion/react-m";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/components/ui/cn";
import { EASE_OUT } from "./lib/ease.ts";
import { type ListboxRow, useListbox } from "./lib/use-listbox.ts";

// One progress value drives the surface, gap, corners and chevron. This short
// spring suits the full reveal distance; each reader clamps its small internal
// overshoot, so all visible endpoints settle together. Rows share a short
// reveal so long lists have no late entries.
const UNFOLD_SPRING = {
  type: "spring",
  visualDuration: 0.2,
  bounce: 0.12,
} as const;
// Exits are faster than entrances: the panel folds back on a short ease.
const UNFOLD_EXIT = { duration: 0.2, ease: EASE_OUT } as const;
// The field's corners: rounded-lg, as the text fields.
const RADIUS = 8;
// How far the open panel sits from the trigger once it has pulled away.
const GAP = 8;
// The surface starts as a thin lip flush against the trigger's edge.
const LIP = 8;
// The room the open panel leaves to the screen's edge, its border's thickness, and the least
// height of a list that scrolls: about three options.
const MARGIN = 8;
const EDGE = 2;
const MIN_LIST = 136;

// The part of the screen a panel opened from this trigger can show in: the viewport, within every
// ancestor that clips what overflows it, such as a sheet's scrolling body.
function roomAround(trigger: HTMLElement) {
  let top = 0;
  let bottom = window.innerHeight;
  for (let node = trigger.parentElement; node; node = node.parentElement) {
    if (getComputedStyle(node).overflowY === "visible") continue;
    const rect = node.getBoundingClientRect();
    top = Math.max(top, rect.top);
    bottom = Math.min(bottom, rect.bottom);
  }
  return { top, bottom };
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const ITEM_VARIANTS: Variants = {
  hidden: { opacity: 0, y: -4, transition: { duration: 0.08, ease: EASE_OUT } },
  show: { opacity: 1, y: 0, transition: { duration: 0.12, ease: EASE_OUT } },
};

type Placement = "bottom" | "top";

interface SelectContextValue {
  value: string | undefined;
  open: boolean;
  setOpen: (open: boolean) => void;
  select: (value: string) => void;
  register: (value: string, label: string, disabled: boolean) => void;
  unregister: (value: string) => void;
  labelFor: (value: string | undefined) => string | undefined;
  rows: ListboxRow[];
  /** Closes the panel; focus inside it returns to the trigger. */
  close: () => void;
  reduce: boolean;
  progress: MotionValue<number>;
  triggerId: string;
  listId: string;
  labelledBy?: string;
  disabled: boolean;
  placement: Placement;
  setPlacement: (p: Placement) => void;
}

const SelectContext = createContext<SelectContextValue | null>(null);
// The option keyboard focus is on, resolved during render by the content.
const ActiveOptionContext = createContext<string | undefined>(undefined);

function useSelectContext(component: string) {
  const ctx = useContext(SelectContext);
  if (!ctx) throw new Error(`${component} must be used within <Select>`);
  return ctx;
}

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /**
   * The id of the text that names the choice, such as a setting's label. The
   * trigger reads it before the chosen option, and the list takes it as its name.
   */
  "aria-labelledby"?: string;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

export function Select({
  value,
  defaultValue,
  onValueChange,
  "aria-labelledby": labelledBy,
  disabled = false,
  className,
  children,
}: SelectProps) {
  const reduce = useReducedMotion() ?? false;
  const baseId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState(defaultValue);
  const [labels, setLabels] = useState<
    Map<string, { label: string; disabled: boolean }>
  >(new Map());
  const [placement, setPlacement] = useState<Placement>("bottom");

  const controlled = value !== undefined;
  const current = controlled ? value : internal;
  const progress = useMotionValue(0);

  // The panel turns inert as it closes, which would drop focus held inside it
  // on the page body. Hand it back to the trigger before that happens.
  const close = useCallback(() => {
    const trigger = document.getElementById(`${baseId}-trigger`);
    if (
      rootRef.current?.contains(document.activeElement) &&
      document.activeElement !== trigger
    )
      trigger?.focus();
    setOpen(false);
  }, [baseId]);

  const select = useCallback(
    (next: string) => {
      if (!controlled) setInternal(next);
      onValueChange?.(next);
      close();
    },
    [controlled, onValueChange, close],
  );

  const register = useCallback(
    (v: string, label: string, disabled: boolean) => {
      setLabels((map) => {
        const entry = map.get(v);
        if (entry?.label === label && entry.disabled === disabled) return map;
        return new Map(map).set(v, { label, disabled });
      });
    },
    [],
  );
  const unregister = useCallback((v: string) => {
    setLabels((map) => {
      if (!map.has(v)) return map;
      const next = new Map(map);
      next.delete(v);
      return next;
    });
  }, []);

  // Reduced motion has no travel, so the progress only carries a short fade.
  useEffect(() => {
    const animation = animate(
      progress,
      open ? 1 : 0,
      reduce ? { duration: 0.12 } : open ? UNFOLD_SPRING : UNFOLD_EXIT,
    );
    return () => animation.stop();
  }, [open, progress, reduce]);

  // Closes on a pointer outside it, and on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node))
        setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open, close]);

  const rows = useMemo(
    () =>
      Array.from(labels, ([id, entry]) => ({
        id,
        label: entry.label,
        disabled: entry.disabled,
      })),
    [labels],
  );

  const ctx = useMemo<SelectContextValue>(
    () => ({
      value: current,
      open,
      setOpen,
      select,
      register,
      unregister,
      labelFor: (v) => (v === undefined ? undefined : labels.get(v)?.label),
      rows,
      close,
      reduce,
      progress,
      triggerId: `${baseId}-trigger`,
      listId: `${baseId}-list`,
      labelledBy,
      disabled,
      placement,
      setPlacement,
    }),
    [
      current,
      open,
      select,
      register,
      unregister,
      labels,
      rows,
      close,
      reduce,
      progress,
      baseId,
      labelledBy,
      disabled,
      placement,
    ],
  );

  return (
    <SelectContext.Provider value={ctx}>
      <div ref={rootRef} className={cn("relative", className)}>
        {children}
      </div>
    </SelectContext.Provider>
  );
}

export function SelectTrigger({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const ctx = useSelectContext("SelectTrigger");
  const isTop = ctx.placement === "top";
  // The edge facing the panel flattens while the panel is attached to it and
  // rounds back as the panel pulls away, on the same curve the panel moves on.
  // The far edge stays rounded.
  const nearRadius = useTransform(
    ctx.progress,
    [0, 0.2, 0.4, 1],
    [RADIUS, 0, 0, RADIUS],
  );
  const rotate = useTransform(ctx.progress, (p) =>
    ctx.reduce ? (ctx.open ? 180 : 0) : Math.min(1, Math.max(0, p)) * 180,
  );
  const top = ctx.reduce || !isTop ? RADIUS : nearRadius;
  const bottom = ctx.reduce || isTop ? RADIUS : nearRadius;
  return (
    <m.button
      type="button"
      id={ctx.triggerId}
      disabled={ctx.disabled}
      aria-haspopup="listbox"
      aria-expanded={ctx.open}
      aria-controls={ctx.listId}
      aria-labelledby={
        ctx.labelledBy ? `${ctx.labelledBy} ${ctx.triggerId}` : undefined
      }
      onClick={() => ctx.setOpen(!ctx.open)}
      onKeyDown={(event) => {
        if (
          !ctx.open &&
          (event.key === "ArrowDown" || event.key === "ArrowUp")
        ) {
          event.preventDefault();
          ctx.setOpen(true);
        }
      }}
      // Both corners of an edge move together, so physical corners hold in either direction.
      style={{
        borderTopLeftRadius: top,
        borderTopRightRadius: top,
        borderBottomLeftRadius: bottom,
        borderBottomRightRadius: bottom,
      }}
      className={cn(
        "relative z-10 flex h-11 w-full items-center justify-between gap-2 border border-input bg-background px-3.5 text-base text-foreground outline-none transition-[border-color,box-shadow]",
        "hover:border-ring/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
    >
      {children}
      <m.span aria-hidden style={{ rotate }} className="text-muted-foreground">
        <ChevronDown className="size-4" />
      </m.span>
    </m.button>
  );
}

export function SelectValue({
  placeholder,
  className,
}: {
  /** What the trigger says while nothing is chosen. */
  placeholder?: string;
  className?: string;
}) {
  const ctx = useSelectContext("SelectValue");
  const label = ctx.labelFor(ctx.value);
  return (
    <span
      className={cn(
        "truncate",
        label === undefined ? "text-muted-foreground" : "text-foreground",
        className,
      )}
    >
      {label ?? placeholder}
    </span>
  );
}

export function SelectContent({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const ctx = useSelectContext("SelectContent");
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  // The list's height while it is taller than the room on the side it opens to: it then scrolls.
  const [limit, setLimit] = useState<number>();
  const { open, progress, reduce, setPlacement } = ctx;
  const { activeId, onKeyDown } = useListbox({
    open,
    rows: ctx.rows,
    selected: ctx.value,
    list: panelRef,
  });

  // Keep descendants laid out while hidden: display:none resets nested
  // scrollers in Chromium. Collapse only the hidden outer footprint after
  // exit so it cannot extend page scrolling. Opening restores the full box
  // before measurement or focus; neither layout change is animated.
  const [exiting, setExiting] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) setExiting(true);
  }
  const present = open || exiting;
  useMotionValueEvent(progress, "animationComplete", () => {
    if (progress.get() === 0) setExiting(false);
  });

  useLayoutEffect(() => {
    const node = panelRef.current;
    if (!node || !present) return;
    const measure = () => setHeight(node.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [present]);

  // On open, flip upward when there isn't room below and there's more above, and bound the list to
  // the room on that side, so a long list scrolls instead of running off the screen or out of a
  // sheet's body, where neither a finger nor a mouse reaches it (lead review C).
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = document.getElementById(ctx.triggerId);
    const list = listRef.current;
    if (!trigger || !list) return;
    const rect = trigger.getBoundingClientRect();
    const room = roomAround(trigger);
    const h = list.scrollHeight + EDGE;
    const below = room.bottom - rect.bottom - GAP - MARGIN;
    const above = rect.top - room.top - GAP - MARGIN;
    const top = below < h && above > below;
    const fits = Math.max(top ? above : below, MIN_LIST) - EDGE;
    setPlacement(top ? "top" : "bottom");
    setLimit(h - EDGE > fits ? fits : undefined);
  }, [open, ctx.triggerId, setPlacement]);

  const isTop = ctx.placement === "top";

  // Reveal a full-size panel from its near edge. No ancestor scales the list,
  // so rows, borders and shadow keep their natural thickness. The clip and
  // corner writes can paint; only the gap uses a transform. All read one
  // progress value, with no animated layout properties.
  const ready = height > 0 && !reduce;
  const fromY = ready ? (isTop ? GAP : -GAP) : 0;
  const detach = useTransform(progress, [0.4, 1], [0, 1]);
  const y = useTransform(detach, (d) => lerp(fromY, 0, d));
  const nearRadius = useTransform(detach, (d) => (ready ? RADIUS * d : RADIUS));
  const borderRadius = useTransform(nearRadius, (near) =>
    isTop
      ? `${RADIUS}px ${RADIUS}px ${near}px ${near}px`
      : `${near}px ${near}px ${RADIUS}px ${RADIUS}px`,
  );
  const clipPath = useTransform(
    [progress, nearRadius],
    ([p, near]: number[]) => {
      if (!ready) return "none";
      // Clamp overshoot so the clip never extends into the trigger or exposes
      // overflowing children. At rest remove it so the native shadow is whole.
      const reveal = Math.min(1, Math.max(0, p));
      if (reveal === 1) return "none";
      const hidden = Math.max(0, (height - LIP) * (1 - reveal));
      const inset = isTop ? `${hidden}px 0 0 0` : `0 0 ${hidden}px 0`;
      const corners = isTop
        ? `${RADIUS}px ${RADIUS}px ${near}px ${near}px`
        : `${near}px ${near}px ${RADIUS}px ${RADIUS}px`;
      return `inset(${inset} round ${corners})`;
    },
  );
  // The surface materialises over its first frames rather than popping in as
  // a lip; with reduced motion the fade is the whole entrance.
  const opacity = useTransform(progress, reduce ? [0, 1] : [0, 0.12], [0, 1]);

  return (
    <m.div
      ref={panelRef}
      id={ctx.listId}
      role="listbox"
      aria-labelledby={ctx.labelledBy ?? ctx.triggerId}
      aria-hidden={!open}
      inert={!open}
      onKeyDown={(event) => {
        // Tab leaves the list from the trigger, so focus moves on to the
        // control after the select rather than into the closing panel.
        if (event.key === "Tab") ctx.close();
        else onKeyDown(event);
      }}
      style={{
        visibility: present ? undefined : "hidden",
        maxHeight: present ? undefined : 0,
        borderWidth: present ? undefined : 0,
        y,
        clipPath,
        borderRadius,
        opacity,
        pointerEvents: open ? "auto" : "none",
        marginTop: isTop ? 0 : GAP,
        marginBottom: isTop ? GAP : 0,
      }}
      className={cn(
        "absolute inset-x-0 z-20 overflow-hidden border border-border bg-background shadow-lg",
        isTop ? "bottom-full" : "top-full",
        className,
      )}
    >
      <ActiveOptionContext.Provider value={activeId}>
        <m.div
          ref={listRef}
          initial={false}
          animate={open ? "show" : "hidden"}
          style={{ maxHeight: limit }}
          className="overflow-y-auto overscroll-contain p-1"
        >
          {children}
        </m.div>
      </ActiveOptionContext.Provider>
    </m.div>
  );
}

export function SelectItem({
  value,
  disabled = false,
  className,
  children,
}: {
  value: string;
  disabled?: boolean;
  className?: string;
  /** The option's words, which also name it in the trigger once chosen. */
  children: string;
}) {
  const ctx = useSelectContext("SelectItem");
  const activeId = useContext(ActiveOptionContext);
  const selected = ctx.value === value;

  useLayoutEffect(() => {
    ctx.register(value, children, disabled);
  }, [ctx.register, value, children, disabled]);
  useLayoutEffect(() => () => ctx.unregister(value), [ctx.unregister, value]);

  return (
    // The same variants either way, so the server and a client that prefers reduced motion draw
    // the closed list alike; MotionProvider's reducedMotion="user" drops the movement.
    <m.div variants={ITEM_VARIANTS}>
      <button
        type="button"
        role="option"
        aria-selected={selected}
        disabled={disabled}
        // One tab stop: the active option, which focus follows while open.
        tabIndex={activeId === value ? 0 : -1}
        data-listbox-id={value}
        onClick={() => ctx.select(value)}
        className={cn(
          "flex min-h-10 w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-start text-base outline-none transition-colors pointer-coarse:min-h-11",
          selected
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:bg-muted",
          "disabled:pointer-events-none disabled:opacity-50",
          className,
        )}
      >
        {children}
        {selected ? <Check aria-hidden className="size-4 shrink-0" /> : null}
      </button>
    </m.div>
  );
}

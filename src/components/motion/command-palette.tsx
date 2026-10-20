"use client";

import { Search } from "lucide-react";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/components/ui/cn";
import { searchCommands } from "./lib/command-search";
import { EASE_OUT } from "./lib/ease";
import { PresenceGate } from "./lib/presence-gate";
import { useFocusTrap } from "./lib/use-focus-trap";
import { useOnOpen } from "./lib/use-on-open";
import { useRowCursor } from "./lib/use-row-cursor";
import { useTouchCapable } from "./lib/use-touch-capable";

export type CommandItem = {
  id: string;
  label: string;
  group?: string;
  hint?: string;
  keywords?: string[];
  icon?: ReactNode;
  badge?: ReactNode;
  onSelect: () => void;
};

interface CommandPaletteProps {
  items: CommandItem[];
  /** Opens with Cmd/Ctrl + this key. Default: "k" */
  shortcut?: string;
  placeholder: string;
  emptyMessage: string;
  /** Accessible names and the Escape key hint, from the message catalog. */
  labels: { dialog: string; list: string; close: string; escape: string };
  /** Shown under the list, such as the keyboard hints. */
  footer?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// Opened via a keyboard shortcut many times a day — entrance must read as
// instant. Tight spring, even faster exit.
const PANEL_SPRING = {
  type: "spring",
  stiffness: 560,
  damping: 40,
  mass: 0.5,
} as const;

export function CommandPalette({
  items,
  shortcut = "k",
  placeholder,
  emptyMessage,
  labels,
  footer,
  open: controlledOpen,
  onOpenChange,
}: CommandPaletteProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = controlledOpen !== undefined;
  const open = controlled ? controlledOpen : internalOpen;
  const setOpen = useCallback(
    (v: boolean) => {
      if (!controlled) setInternalOpen(v);
      onOpenChange?.(v);
    },
    [controlled, onOpenChange],
  );

  const [query, setQuery] = useState("");
  // Portal target only exists client-side; render nothing during SSR/hydration.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const uid = useId();
  const reduce = useReducedMotion();
  const canTouch = useTouchCapable();
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === shortcut.toLowerCase()
      ) {
        e.preventDefault();
        setOpen(!open);
        return;
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, shortcut, setOpen]);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    root.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      root.style.overflow = previousRootOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [open]);

  // Tab stays on the field while the palette is open (the rows are reached
  // with the arrow keys), and focus returns to the opener on close.
  useFocusTrap(open && mounted, panelRef);

  const filtered = useMemo(() => searchCommands(items, query), [items, query]);

  // Reserve the icon column only when at least one item brings an icon, so
  // icon-less lists don't render a dead gap before every label.
  const hasIcons = useMemo(() => items.some((it) => it.icon), [items]);

  // Items without a group share one unnamed group, which gets no heading.
  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    filtered.forEach((it) => {
      const g = it.group ?? "";
      const groupItems = map.get(g) ?? [];
      groupItems.push(it);
      map.set(g, groupItems);
    });
    return Array.from(map.entries());
  }, [filtered]);

  // Grouping reorders the list, so the rendered order is not the filtered
  // order whenever two groups interleave. Everything that has to agree on
  // "which row" — the highlight, the ids, Enter, the scroll — reads this one
  // array, so they cannot drift apart.
  const rows = useMemo(() => grouped.flatMap(([, list]) => list), [grouped]);

  const { activeIndex: active, moveTo, moveActive } = useRowCursor(rows, query);

  // Clearing the query would drop the cursor on its own, but only if it had
  // changed; `moveTo(null)` covers reopening on an already-empty query.
  useOnOpen(open, () => {
    setQuery("");
    moveTo(null);
  });

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActive(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActive(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = rows[active];
      if (it) {
        it.onSelect();
        setOpen(false);
      }
    }
  };

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLButtonElement>(
      `[data-index="${active}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  if (!mounted) return null;

  // Portaled to <body> so ancestors with transforms, filters, or fixed
  // positioning can't trap the overlay in their stacking context, and mounted
  // only while open. The chrome is two fixed siblings rather than one wrapper:
  // the backdrop spans the viewport edges but carries the scrim colour, and the
  // layer positioning the panel is inset off every edge. Both hang off
  // `PresenceGate`, so interaction releases in the same commit that starts the
  // exit rather than when it ends — `open` is already false for those frames.
  return createPortal(
    <AnimatePresence initial={false}>
      {open ? (
        <PresenceGate key="backdrop">
          {({ gate }) => (
            <m.button
              type="button"
              aria-label={labels.close}
              tabIndex={-1}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{
                opacity: 0,
                transition: { duration: 0.12, ease: EASE_OUT },
              }}
              transition={{ duration: 0.18, ease: EASE_OUT }}
              {...gate}
              onClick={() => setOpen(false)}
              className="pointer-events-auto fixed inset-0 z-[100] bg-background/5 [-webkit-backdrop-filter:blur(12px)_saturate(140%)] [backdrop-filter:blur(12px)_saturate(140%)]"
            />
          )}
        </PresenceGate>
      ) : null}

      {open ? (
        <PresenceGate key="panel-layer">
          {({ isPresent, gate }) => (
            // The layer itself never takes pointer events, so it carries
            // `inert` alone rather than the gate's pointer-events value.
            <div
              inert={!isPresent}
              className="pointer-events-none fixed inset-x-4 top-[18vh] bottom-4 z-[100] flex items-start justify-center"
            >
              <m.div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={labels.dialog}
                initial={{
                  opacity: 0,
                  y: reduce ? 0 : -8,
                  scale: reduce ? 1 : 0.97,
                }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{
                  opacity: 0,
                  y: reduce ? 0 : -8,
                  scale: reduce ? 1 : 0.97,
                  transition: { duration: 0.12, ease: EASE_OUT },
                }}
                transition={reduce ? { duration: 0.1 } : PANEL_SPRING}
                {...gate}
                onKeyDown={onKeyDown}
                className="pointer-events-auto w-full max-w-xl overflow-hidden rounded-xl border border-border bg-background shadow-lg will-change-transform"
              >
                <div className="flex items-center gap-3 border-border border-b px-4">
                  <Search
                    aria-hidden
                    className="h-4 w-4 text-muted-foreground"
                  />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={placeholder}
                    role="combobox"
                    // The field only exists while the palette is open.
                    aria-expanded="true"
                    aria-controls={`${uid}-list`}
                    aria-activedescendant={
                      rows.length > 0 ? `${uid}-opt-${active}` : undefined
                    }
                    aria-autocomplete="list"
                    aria-label={labels.dialog}
                    className={cn(
                      "h-12 flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-muted-foreground",
                      // The palette focuses this field the moment it opens, and iOS
                      // zooms the page in on a focused field under 16px: the fixed
                      // overlay is magnified off-center — clipped leading edge, half
                      // an icon column — and the zoom outlives the palette. 16px on
                      // touch keeps the page at scale 1; pointer devices keep 14px.
                      canTouch && "text-base",
                    )}
                  />
                  <kbd className="hidden rounded-sm border border-border bg-background px-1.5 py-0.5 text-muted-foreground text-xs sm:inline-block">
                    {labels.escape}
                  </kbd>
                </div>
                <div
                  ref={listRef}
                  id={`${uid}-list`}
                  role="listbox"
                  aria-label={labels.list}
                  className="max-h-[60vh] overflow-y-auto overscroll-contain p-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {rows.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                      {emptyMessage}
                    </div>
                  ) : (
                    grouped.map(([group, list]) => (
                      <div key={group} className="mb-1 last:mb-0">
                        {group ? (
                          <div
                            aria-hidden
                            className="px-2 py-1.5 font-medium text-muted-foreground text-xs"
                          >
                            {group}
                          </div>
                        ) : null}
                        {list.map((it) => {
                          // `rows` holds these very objects, in render order.
                          const idx = rows.indexOf(it);
                          const isActive = idx === active;
                          return (
                            <button
                              key={it.id}
                              type="button"
                              id={`${uid}-opt-${idx}`}
                              role="option"
                              aria-selected={isActive}
                              // Rows are reached with the arrow keys from the field.
                              tabIndex={-1}
                              data-index={idx}
                              onMouseEnter={() => moveTo(it.id)}
                              onClick={() => {
                                it.onSelect();
                                setOpen(false);
                              }}
                              className={cn(
                                "relative isolate flex min-h-11 w-full items-center gap-3 rounded-md px-2 py-2 text-start text-sm transition-colors",
                                isActive
                                  ? "text-foreground"
                                  : "text-muted-foreground",
                              )}
                            >
                              {isActive ? (
                                <m.span
                                  layoutId={`${uid}-active`}
                                  className="absolute inset-0 z-0 rounded-md bg-muted/60"
                                  transition={
                                    reduce
                                      ? { duration: 0 }
                                      : // Tracks rapid arrow-key navigation — keep it tighter
                                        // than SPRING_LAYOUT so it never lags the active row.
                                        {
                                          type: "spring",
                                          stiffness: 480,
                                          damping: 38,
                                        }
                                  }
                                />
                              ) : null}
                              {it.icon ? (
                                <span
                                  aria-hidden
                                  className="relative z-10 [&>svg]:h-4 [&>svg]:w-4"
                                >
                                  {it.icon}
                                </span>
                              ) : hasIcons ? (
                                <span className="relative z-10 h-4 w-4" />
                              ) : null}
                              <span className="relative z-10 flex-1 truncate">
                                {it.label}
                              </span>
                              {it.badge ? (
                                <span className="relative z-10 shrink-0">
                                  {it.badge}
                                </span>
                              ) : null}
                              {it.hint ? (
                                <kbd className="relative z-10 rounded-sm border border-border bg-background px-1.5 py-0.5 text-muted-foreground text-xs">
                                  {it.hint}
                                </kbd>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>
                {footer ? (
                  <div className="border-border border-t px-4 py-2 text-muted-foreground text-xs">
                    {footer}
                  </div>
                ) : null}
              </m.div>
            </div>
          )}
        </PresenceGate>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

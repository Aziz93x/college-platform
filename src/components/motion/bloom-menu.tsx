"use client";

import { X } from "lucide-react";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import Link from "next/link";
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "@/components/ui/cn";
import { EASE_OUT } from "./lib/ease.ts";

// Folder-open feel: a touch of overshoot as the panel grows out of the trigger.
const SPRING_FOLDER = {
  type: "spring",
  stiffness: 300,
  damping: 32,
  mass: 0.9,
} as const;

export type BloomMenuItem = {
  id: string;
  label: string;
  icon: ReactNode;
  /** A link opens a page; otherwise the item runs onSelect. */
  href?: string;
  onSelect?: () => void;
  /** While its work runs, the item shows this instead of its icon and takes no more presses. */
  busyIcon?: ReactNode;
  busy?: boolean;
};

// BeUI's bloom menu: the trigger morphs into a panel that opens from its corner, and the items
// bloom outward from the middle of their grid. Arrow keys walk the items, Escape and a press
// outside close it, and focus returns to the trigger.
export function BloomMenu({
  trigger,
  triggerLabel,
  heading,
  items,
  closeLabel,
  className,
}: {
  /** What the closed menu shows, such as the person's initials. */
  trigger: ReactNode;
  triggerLabel: string;
  /** The panel's heading, which names the menu. */
  heading: ReactNode;
  items: BloomMenuItem[];
  closeLabel: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();
  const layoutId = useId();
  const menuId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  // Set when the menu closes holding focus: the trigger is unmounted while open, so focus can only
  // go back once it has mounted again.
  const restoreFocus = useRef(false);

  const close = useCallback((returnFocus: boolean) => {
    if (returnFocus && ref.current?.contains(document.activeElement)) {
      restoreFocus.current = true;
    }
    setOpen(false);
  }, []);

  const openMenu = () => {
    setActive(0);
    setOpen(true);
  };

  useEffect(() => {
    if (open) {
      itemRefs.current[active]?.focus({ preventScroll: true });
      return;
    }
    if (!restoreFocus.current) return;
    restoreFocus.current = false;
    triggerRef.current?.focus();
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") close(true);
    };
    const onPointer = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open, close]);

  // Right and left follow the reading direction: in Arabic the next item is to the left.
  const onGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const back = rtl ? "ArrowRight" : "ArrowLeft";
    const last = items.length - 1;
    let next: number | null = null;
    if (event.key === forward || event.key === "ArrowDown") {
      next = Math.min(active + 1, last);
    } else if (event.key === back || event.key === "ArrowUp") {
      next = Math.max(active - 1, 0);
    } else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
  };

  const morph = reduce ? { duration: 0.15 } : SPRING_FOLDER;
  const columns = Math.min(items.length, 3);
  const rows = Math.ceil(items.length / columns);

  return (
    <div ref={ref} className={cn("relative size-11", className)}>
      {/* Anchored to the trigger's top corner at the end, so the panel grows toward the page. */}
      <div className="absolute end-0 top-0 z-40">
        <AnimatePresence initial={false} mode="popLayout">
          {open ? (
            <m.div
              key="panel"
              layoutId={layoutId}
              // Measured only when the menu opens or closes: a render while it opens (focus moving to
              // the pressed item) would move the items under a finger mid-press, and the press would
              // land outside them.
              layoutDependency={open}
              transition={morph}
              // Focus leaving the open menu closes it, as a press outside does.
              onBlur={(event) => {
                const next = event.relatedTarget;
                if (next instanceof Node && !ref.current?.contains(next)) {
                  close(false);
                }
              }}
              style={{ borderRadius: 16 }}
              className="w-[min(86vw,20rem)] overflow-hidden border bg-card shadow-lg"
            >
              <m.div
                // Undoes the box's morph scaling, so the content stays crisp while it grows.
                layout
                layoutDependency={open}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: reduce ? 0 : 0.12, duration: 0.2 }}
              >
                <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
                  <div id={`${menuId}-label`} className="min-w-0">
                    {heading}
                  </div>
                  <button
                    type="button"
                    onClick={() => close(true)}
                    aria-label={closeLabel}
                    className="-me-2 -mt-1 grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:size-11"
                  >
                    <X aria-hidden className="size-4" />
                  </button>
                </div>
                <m.div
                  // Iris reveal: the grid opens from a small box at its center toward its corners.
                  initial={
                    reduce ? false : { clipPath: "inset(45% 34% 45% 34%)" }
                  }
                  animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
                  transition={{
                    delay: reduce ? 0 : 0.08,
                    duration: 0.45,
                    ease: EASE_OUT,
                  }}
                  id={menuId}
                  role="menu"
                  aria-labelledby={`${menuId}-label`}
                  onKeyDown={onGridKeyDown}
                  className="grid"
                  style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
                >
                  {items.map((item, index) => {
                    // Each item waits by its distance from the grid's center, so the corners open together.
                    const column = index % columns;
                    const row = Math.floor(index / columns);
                    const distance = Math.hypot(
                      column - (columns - 1) / 2,
                      row - (rows - 1) / 2,
                    );
                    const content = (
                      <m.span
                        key="content"
                        initial={
                          reduce
                            ? { opacity: 0 }
                            : { opacity: 0, scale: 0.85, filter: "blur(6px)" }
                        }
                        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                        transition={{
                          delay: reduce ? 0 : 0.1 + distance * 0.07,
                          type: "spring",
                          stiffness: 440,
                          damping: 34,
                        }}
                        className="flex flex-col items-center gap-2"
                      >
                        <span aria-hidden className="[&_svg]:size-5">
                          {item.busy ? (item.busyIcon ?? item.icon) : item.icon}
                        </span>
                        <span className="text-center font-medium text-sm">
                          {item.label}
                        </span>
                      </m.span>
                    );
                    const cellClass = cn(
                      "flex min-h-24 items-center justify-center px-3 py-5 text-muted-foreground outline-none transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:bg-muted/60 focus-visible:text-foreground aria-disabled:cursor-progress",
                      column !== columns - 1 && "border-e",
                      row < rows - 1 && "border-b",
                    );
                    const common = {
                      ref: (node: HTMLElement | null) => {
                        itemRefs.current[index] = node;
                      },
                      role: "menuitem" as const,
                      tabIndex: index === active ? 0 : -1,
                      onFocus: () => setActive(index),
                      className: cellClass,
                    };
                    return item.href ? (
                      <Link key={item.id} href={item.href} {...common}>
                        {content}
                      </Link>
                    ) : (
                      <button
                        key={item.id}
                        type="button"
                        {...common}
                        aria-disabled={item.busy || undefined}
                        onClick={() => {
                          if (!item.busy) item.onSelect?.();
                        }}
                      >
                        {content}
                      </button>
                    );
                  })}
                </m.div>
              </m.div>
            </m.div>
          ) : (
            <m.button
              key="trigger"
              ref={triggerRef}
              type="button"
              layoutId={layoutId}
              transition={morph}
              style={{ borderRadius: 999 }}
              onClick={openMenu}
              aria-label={triggerLabel}
              aria-haspopup="menu"
              aria-expanded={false}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  openMenu();
                }
              }}
              // Always set: the server cannot know the reduced-motion preference, and MotionConfig
              // already stops the press for whoever asked for it.
              whileTap={{ scale: 0.95 }}
              className="grid size-11 place-items-center overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {/* Its own layout counter-scales the content, so it stays crisp while the box morphs. */}
              <m.span layout className="grid size-full place-items-center">
                {trigger}
              </m.span>
            </m.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

"use client";

import { type HTMLMotionProps, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import {
  type ButtonHTMLAttributes,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { cn } from "@/components/ui/cn";

const SIDEBAR_KEYBOARD_SHORTCUT = "b";

// The desktop rail settles at a hard width boundary. Keep the spring critically damped so it
// cannot overshoot, pause against that boundary, and then snap back during the final frame.
const SIDEBAR_MORPH_TRANSITION = {
  type: "spring",
  stiffness: 380,
  damping: 35,
  mass: 0.75,
} as const;

type AnimatedSidebarContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  reduce: boolean;
};

const AnimatedSidebarContext =
  createContext<AnimatedSidebarContextValue | null>(null);

export function useAnimatedSidebar() {
  const context = useContext(AnimatedSidebarContext);
  if (!context) {
    throw new Error(
      "useAnimatedSidebar must be used inside <AnimatedSidebar>.",
    );
  }
  return context;
}

export interface AnimatedSidebarProps
  extends Omit<HTMLMotionProps<"aside">, "children"> {
  children?: ReactNode;
  /** Open at first: the page passes the state it kept, so the server draws it right. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Classes for the sticky surface inside the aside, which holds the children. */
  panelClassName?: string;
}

// A sidebar that morphs between its full width and an icon rail, toggled by a trigger, its rail
// edge, or Ctrl (Cmd) + B. The widths come from --sidebar-width and --sidebar-width-icon, and the
// aside's data-state ("expanded" or "collapsed") lets the children follow with group variants.
export function AnimatedSidebar({
  children,
  defaultOpen = true,
  onOpenChange,
  className,
  panelClassName,
  ...props
}: AnimatedSidebarProps) {
  const [open, setOpenState] = useState(defaultOpen);
  const reduce = useReducedMotion() ?? false;
  const setOpen = useCallback(
    (next: boolean) => {
      setOpenState(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );
  const toggle = useCallback(() => setOpen(!open), [open, setOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  const context = useMemo(
    () => ({ open, setOpen, toggle, reduce }),
    [open, setOpen, toggle, reduce],
  );
  return (
    <AnimatedSidebarContext.Provider value={context}>
      <m.aside
        {...props}
        initial={false}
        data-state={open ? "expanded" : "collapsed"}
        animate={{
          width: open ? "var(--sidebar-width)" : "var(--sidebar-width-icon)",
        }}
        transition={reduce ? { duration: 0 } : SIDEBAR_MORPH_TRANSITION}
        className={cn(
          "group/sidebar relative shrink-0 will-change-[width]",
          className,
        )}
      >
        <div
          className={cn(
            "sticky top-0 flex h-dvh w-full flex-col overflow-hidden",
            panelClassName,
          )}
        >
          {children}
        </div>
      </m.aside>
    </AnimatedSidebarContext.Provider>
  );
}

export interface AnimatedSidebarTriggerProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  // What a press does now, and the icon that shows it: collapse while open, expand while collapsed.
  label: (open: boolean) => string;
  children: (open: boolean) => ReactNode;
}

// Collapses the open sidebar to its rail and opens the rail again.
export function AnimatedSidebarTrigger({
  label,
  children,
  className,
  onClick,
  ...props
}: AnimatedSidebarTriggerProps) {
  const context = useAnimatedSidebar();
  return (
    <button
      {...props}
      type="button"
      aria-label={label(context.open)}
      title={label(context.open)}
      aria-keyshortcuts="Control+B Meta+B"
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) context.toggle();
      }}
      className={cn(
        "outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {children(context.open)}
    </button>
  );
}

// The sidebar's inner edge, a pointer's shortcut to the same toggle: a line shows on hover. Out of
// the tab order and the accessibility tree, as the trigger and the shortcut serve the keyboard and
// assistive technology.
export function AnimatedSidebarRail({
  label,
  className,
}: {
  // What a press does now: collapse while open, expand while collapsed.
  label: (open: boolean) => string;
  className?: string;
}) {
  const context = useAnimatedSidebar();
  return (
    <button
      type="button"
      aria-hidden
      title={label(context.open)}
      tabIndex={-1}
      onClick={context.toggle}
      className={cn(
        "absolute inset-y-0 end-0 z-20 w-3 cursor-col-resize outline-none",
        "after:absolute after:inset-y-0 after:end-0 after:w-px after:bg-transparent after:transition-colors hover:after:bg-foreground/25",
        className,
      )}
    />
  );
}

"use client";

import { ChevronDown } from "lucide-react";
import { type HTMLMotionProps, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import {
  createContext,
  type RefObject,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/components/ui/cn";
import { EASE_OUT, SPRING_LAYOUT } from "./lib/ease";

type CollapsibleContextValue = {
  open: boolean;
  toggle: () => void;
  reduce: boolean;
  contentId: string;
  triggerId: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
};

const CollapsibleContext = createContext<CollapsibleContextValue | null>(null);

function useCollapsibleContext(component: string) {
  const context = useContext(CollapsibleContext);
  if (!context) {
    throw new Error(`${component} must be used within <Collapsible>`);
  }
  return context;
}

export interface CollapsibleProps
  extends Omit<HTMLMotionProps<"div">, "layout"> {
  defaultOpen?: boolean;
  /** Layout classes for the inner wrapper, separate from the animated surface. */
  contentClassName?: string;
}

export function Collapsible({
  defaultOpen = false,
  className,
  contentClassName,
  children,
  style,
  ...props
}: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  const reduce = useReducedMotion() ?? false;
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const context = useMemo<CollapsibleContextValue>(
    () => ({
      open,
      toggle: () => setOpen((current) => !current),
      reduce,
      contentId: `${id}-content`,
      triggerId: `${id}-trigger`,
      triggerRef,
    }),
    [id, open, reduce],
  );

  return (
    <CollapsibleContext.Provider value={context}>
      <m.div
        {...props}
        layout={!reduce}
        transition={{ layout: SPRING_LAYOUT }}
        data-state={open ? "open" : "closed"}
        className={cn("relative w-full", className)}
        style={{ ...style, originY: 0 }}
      >
        <m.div
          layout={reduce ? false : "position"}
          transition={{ layout: SPRING_LAYOUT }}
          style={{ originY: 0 }}
          className={cn("min-w-0", contentClassName)}
        >
          {children}
        </m.div>
      </m.div>
    </CollapsibleContext.Provider>
  );
}

export interface CollapsibleTriggerProps
  extends Omit<HTMLMotionProps<"button">, "id" | "layout"> {}

export function CollapsibleTrigger({
  className,
  children,
  onClick,
  ...props
}: CollapsibleTriggerProps) {
  const context = useCollapsibleContext("CollapsibleTrigger");
  return (
    <m.button
      {...props}
      ref={context.triggerRef}
      id={context.triggerId}
      type="button"
      aria-expanded={context.open}
      aria-controls={context.contentId}
      data-state={context.open ? "open" : "closed"}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) context.toggle();
      }}
      layout={context.reduce ? false : "position"}
      transition={{ layout: SPRING_LAYOUT }}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-start font-medium text-sm outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {children}
    </m.button>
  );
}

export interface CollapsibleContentProps
  extends Omit<
    HTMLMotionProps<"div">,
    "id" | "layout" | "animate" | "initial"
  > {
  /** Padding and layout classes for the measured content, inside the clipping wrapper. */
  contentClassName?: string;
}

export function CollapsibleContent({
  className,
  contentClassName,
  children,
  style,
  ...props
}: CollapsibleContentProps) {
  const context = useCollapsibleContext("CollapsibleContent");
  const contentRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const node = innerRef.current;
    if (!node) return;
    const measure = () => setHeight(node.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!context.open && contentRef.current?.contains(document.activeElement)) {
      context.triggerRef.current?.focus({ preventScroll: true });
    }
  }, [context.open, context.triggerRef]);

  return (
    <m.div
      {...props}
      ref={contentRef}
      id={context.contentId}
      aria-hidden={!context.open}
      inert={!context.open}
      data-state={context.open ? "open" : "closed"}
      initial={false}
      layout={!context.reduce}
      transition={{ layout: SPRING_LAYOUT }}
      // A one-pixel closed box keeps transform projection continuous at zero.
      // Geometry changes once; the inner layout projection keeps text sharp.
      style={{
        ...style,
        height: context.open ? height || "auto" : 1,
        originY: 0,
      }}
      className={cn("overflow-hidden", className)}
    >
      <m.div
        ref={innerRef}
        layout={!context.reduce}
        style={{ originY: 0 }}
        initial={false}
        animate={{ opacity: context.open ? 1 : 0 }}
        transition={{
          opacity: { duration: context.open ? 0.18 : 0.12, ease: EASE_OUT },
          layout: SPRING_LAYOUT,
        }}
        className={cn("flow-root", contentClassName)}
      >
        {children}
      </m.div>
    </m.div>
  );
}

export interface CollapsibleIndicatorProps extends HTMLMotionProps<"span"> {}

export function CollapsibleIndicator({
  className,
  children,
  ...props
}: CollapsibleIndicatorProps) {
  const { open, reduce } = useCollapsibleContext("CollapsibleIndicator");
  return (
    <m.span
      {...props}
      aria-hidden="true"
      initial={false}
      animate={{ transform: `rotate(${open ? 180 : 0}deg)` }}
      transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
      className={cn(
        "ms-auto inline-flex shrink-0 items-center justify-center text-muted-foreground",
        className,
      )}
    >
      {children ?? <ChevronDown className="size-4" />}
    </m.span>
  );
}

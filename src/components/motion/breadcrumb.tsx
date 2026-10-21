"use client";

import { ChevronRight } from "lucide-react";
import {
  AnimatePresence,
  type HTMLMotionProps,
  LayoutGroup,
  useIsPresent,
  useReducedMotion,
} from "motion/react";
import * as m from "motion/react-m";
import {
  type ComponentPropsWithRef,
  type ReactElement,
  useId,
  useLayoutEffect,
  useRef,
} from "react";
import { cn } from "@/components/ui/cn";
import { EASE_OUT, SPRING_LAYOUT } from "./lib/ease.ts";

export type BreadcrumbProps = ComponentPropsWithRef<"nav"> & {
  /** The trail's accessible name, from the message catalog. */
  "aria-label": string;
};

/** A navigation landmark. Keep it mounted while the route changes. */
export function Breadcrumb({ className, children, ...props }: BreadcrumbProps) {
  const id = useId();
  return (
    <nav {...props} className={cn("min-w-0", className)}>
      <LayoutGroup id={id}>{children}</LayoutGroup>
    </nav>
  );
}

/** Pass keyed BreadcrumbItems directly, so entering and leaving pages animate. */
export function BreadcrumbList({
  className,
  children,
  ...props
}: ComponentPropsWithRef<"ol">) {
  return (
    <ol
      {...props}
      className={cn(
        "relative flex flex-wrap items-center gap-x-1 gap-y-1 text-sm",
        className,
      )}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {children}
      </AnimatePresence>
    </ol>
  );
}

/** Use a stable key per page; put its separator inside this item. */
export function BreadcrumbItem({
  className,
  style,
  children,
  ref,
  ...props
}: HTMLMotionProps<"li">) {
  const reduce = useReducedMotion();
  const present = useIsPresent();
  const itemRef = useRef<HTMLLIElement>(null);
  useLayoutEffect(() => {
    const item = itemRef.current;
    if (!item || !present) return;
    const measure = () => {
      // popLayout snapshots offsetWidth (whole pixels). Keep the exact width, so the leaving item
      // cannot wrap its last letter for a fraction of a pixel.
      item.style.setProperty(
        "--breadcrumb-exit-width",
        `${item.getBoundingClientRect().width}px`,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(item);
    return () => observer.disconnect();
  }, [present]);
  const hidden = { opacity: 0, y: reduce ? 0 : 6 };
  return (
    <m.li
      ref={(node) => {
        itemRef.current = node;
        if (typeof ref === "function") return ref(node);
        if (ref) ref.current = node;
      }}
      layout={reduce ? false : "position"}
      initial={hidden}
      animate={{ opacity: 1, y: 0 }}
      exit={hidden}
      transition={{ duration: 0.2, ease: EASE_OUT, layout: SPRING_LAYOUT }}
      {...props}
      inert={!present}
      aria-hidden={!present || undefined}
      style={{
        ...style,
        minWidth: present ? style?.minWidth : "var(--breadcrumb-exit-width)",
        pointerEvents: present ? style?.pointerEvents : "none",
      }}
      className={cn(
        "relative inline-flex min-w-0 max-w-full items-center gap-1",
        className,
      )}
    >
      {children}
    </m.li>
  );
}

export type BreadcrumbLinkProps = ComponentPropsWithRef<"a"> & {
  /** Renders the router's Link, spreading these props onto it. */
  render?: (props: ComponentPropsWithRef<"a">) => ReactElement;
};

export function BreadcrumbLink({
  className,
  render,
  ...props
}: BreadcrumbLinkProps) {
  const linkProps = {
    ...props,
    className: cn(
      // 44 px tall on a touch screen, like every other control.
      "inline-flex min-h-8 min-w-0 items-center gap-1.5 rounded-md px-2 text-muted-foreground transition-colors duration-150 hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 pointer-coarse:min-h-11 [&>svg]:size-3.5 [&>svg]:shrink-0",
      className,
    ),
  };
  return render ? render(linkProps) : <a {...linkProps} />;
}

export function BreadcrumbPage({
  className,
  children,
  ...props
}: ComponentPropsWithRef<"span">) {
  return (
    <span
      {...props}
      aria-current="page"
      className={cn(
        "relative isolate inline-flex min-h-8 min-w-0 items-center gap-1.5 rounded-md px-2 text-foreground [overflow-wrap:anywhere] [&>svg]:size-3.5 [&>svg]:shrink-0",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Decorative; placed inside the item it leads to. It points the way the trail reads. */
export function BreadcrumbSeparator({
  className,
  children,
  ...props
}: ComponentPropsWithRef<"span">) {
  return (
    <span
      {...props}
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center text-muted-foreground/60 [&>svg]:size-3.5 rtl:rotate-180",
        className,
      )}
    >
      {children ?? <ChevronRight />}
    </span>
  );
}

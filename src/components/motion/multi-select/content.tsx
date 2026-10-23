"use client";

import type { Transition } from "motion/react";
import * as m from "motion/react-m";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/components/ui/cn";
import { usePopoverPortalPosition } from "../lib/popover-position.ts";
import { useMultiSelectContext } from "./context.tsx";

type Side = "top" | "bottom";

// One weighted spring both ways, so opening and closing travel through the same geometry.
const MORPH: Transition = {
  type: "spring",
  duration: 0.5,
  bounce: 0.22,
};
const SIDE_OFFSET = 6;

// The list's panel, portalled to the body and as wide as the field. It opens below the field, or
// above it when there is more room there.
export function MultiSelectContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const context = useMultiSelectContext("MultiSelectContent");
  const measureRef = useRef<HTMLDivElement>(null);
  const [portalReady, setPortalReady] = useState(false);
  const [side, setSide] = useState<Side>("bottom");
  const [morphReady, setMorphReady] = useState(false);
  // Followed while open only: a closed list has nowhere to be.
  const layout = usePopoverPortalPosition(
    context.triggerRef,
    measureRef,
    portalReady && context.open,
  );

  useEffect(() => setPortalReady(true), []);
  useLayoutEffect(() => {
    if (!portalReady) return;
    const frame = requestAnimationFrame(() => setMorphReady(true));
    return () => cancelAnimationFrame(frame);
  }, [portalReady]);

  useLayoutEffect(() => {
    // The side holds while the panel closes, so a panel above closes upward.
    if (!context.open || !layout) return;
    const below =
      window.innerHeight - (layout.trigger.top + layout.trigger.height);
    const above = layout.trigger.top;
    setSide(
      below < layout.content.height + SIDE_OFFSET && above > below
        ? "top"
        : "bottom",
    );
  }, [context.open, layout]);

  if (!portalReady) return null;
  const transition = context.reduce || !morphReady ? { duration: 0 } : MORPH;

  return createPortal(
    <m.div
      ref={context.contentRef}
      data-side={side}
      aria-hidden={!context.open}
      inert={!context.open}
      initial={false}
      animate={{
        height: context.open ? (layout?.content.height ?? 0) : 0,
        opacity: context.open ? 1 : 0,
        y: context.open ? (side === "bottom" ? SIDE_OFFSET : -SIDE_OFFSET) : 0,
      }}
      transition={transition}
      style={
        {
          left: layout?.trigger.left ?? 0,
          width: layout?.trigger.width ?? 0,
          top:
            side === "bottom" && layout
              ? layout.trigger.top + layout.trigger.height
              : undefined,
          bottom:
            side === "top" && layout
              ? window.innerHeight - layout.trigger.top
              : undefined,
          pointerEvents: context.open ? "auto" : "none",
          transformOrigin: side === "bottom" ? "top" : "bottom",
          visibility: layout ? "visible" : "hidden",
        } as CSSProperties
      }
      className={cn(
        "fixed z-[9999] overflow-hidden rounded-lg border bg-popover text-foreground shadow-lg outline-none will-change-[height,transform]",
        className,
      )}
    >
      <m.div
        ref={measureRef}
        initial={false}
        animate={{ opacity: context.open ? 1 : 0 }}
        transition={transition}
      >
        {children}
      </m.div>
    </m.div>,
    document.body,
  );
}

"use client";

import {
  AnimatePresence,
  type PanInfo,
  useDragControls,
  useReducedMotion,
} from "motion/react";
import * as m from "motion/react-m";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/components/ui/cn";
import { EASE_DRAWER } from "./lib/ease";
import { PresenceGate } from "./lib/presence-gate";
import { useFocusTrap } from "./lib/use-focus-trap";

// Vaul-style glide: a long, fully-damped tween reads smoother than a spring on
// open — no settle/overshoot, just one clean decel. Same curve drives the
// backdrop fade so the surface and scrim move as one.
const DRAWER = { duration: 0.5, ease: EASE_DRAWER } as const;

// From BeUI's lib/touch.ts: a long press on a coarse pointer must not hand the
// drag to iOS's callout or start a text selection.
const TOUCH_GESTURE_CONTENT_CLASS =
  "[-webkit-touch-callout:none] pointer-coarse:select-none";

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Heights (0-1 = fraction of viewport, or "auto"). First entry is default. */
  snapPoints?: (number | "auto")[];
  defaultSnap?: number;
  /** The sheet's heading, which also names the dialog. */
  title: string;
  description?: string;
  /** The accessible name of the scrim that closes the sheet. */
  closeLabel: string;
  children?: ReactNode;
  className?: string;
  /** Min drag distance (px) past current snap to dismiss. */
  dismissThreshold?: number;
}

export function BottomSheet({
  open,
  onOpenChange,
  snapPoints = [0.5, 0.92],
  defaultSnap = 0,
  title,
  description,
  closeLabel,
  children,
  className,
  dismissThreshold = 120,
}: BottomSheetProps) {
  const [snap, setSnap] = useState(defaultSnap);
  const [mounted, setMounted] = useState(false);
  const dragControls = useDragControls();
  const sheetRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const uid = useId();
  const titleId = `${uid}-title`;
  const descriptionId = `${uid}-description`;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) setSnap(defaultSnap);
  }, [open, defaultSnap]);

  // Focus moves into the sheet on open, Tab stays inside it, and focus returns
  // to the opener on close. `mounted` gates it because the sheet only exists
  // once the portal can render.
  useFocusTrap(open && mounted, sheetRef, {
    onEscape: () => onOpenChange(false),
  });

  // Lock background scroll while open. overflow:hidden alone is ignored by
  // iOS Safari — boundary scrolls inside the sheet chain to the page, which
  // scrolls underneath and ends up somewhere else on close. position:fixed
  // is the lock that actually holds; restore the scroll position after.
  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const scrollY = window.scrollY;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      overflow: body.style.overflow,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.overflow = "hidden";

    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const velocity = info.velocity.y;
    const offset = info.offset.y;

    // Strong downward fling or large drag → dismiss.
    if (velocity > 600 || offset > dismissThreshold) {
      const smaller = snapPoints.map((_, i) => i).filter((i) => i < snap);
      if (smaller.length && velocity < 800 && offset < dismissThreshold * 1.6) {
        setSnap(smaller[smaller.length - 1]);
      } else {
        onOpenChange(false);
      }
      return;
    }

    // Strong upward fling → next snap.
    if (velocity < -500) {
      setSnap((current) => Math.min(snapPoints.length - 1, current + 1));
      return;
    }

    // Otherwise snap to nearest by current offset.
    setSnap((current) => {
      if (offset > 80 && current > 0) return current - 1;
      if (offset < -80 && current < snapPoints.length - 1) return current + 1;
      return current;
    });
  };

  const snapValue = snapPoints[snap];
  const heightStyle =
    snapValue === "auto"
      ? { maxHeight: "92dvh" }
      : { height: `${snapValue * 100}dvh` };

  // Portal to <body>: an ancestor with backdrop-filter or transform becomes
  // the containing block for fixed descendants, which would position the
  // sheet against that ancestor instead of the viewport.
  if (!mounted) return null;

  // Two fixed siblings, no wrapper: the scrim spans the viewport edges but
  // carries a colour, and the sheet is pinned to the bottom, stops short of the
  // top edge at every snap point the component ships, and paints an opaque
  // surface either way. Both hang off `PresenceGate`, so interaction releases in
  // the same commit that starts the exit rather than when it ends.
  return createPortal(
    <AnimatePresence>
      {open ? (
        <PresenceGate key="backdrop">
          {({ gate }) => (
            <m.button
              type="button"
              aria-label={closeLabel}
              // Outside the sheet, so the focus trap never lands on it; it is
              // a pointer target, and Escape closes from the keyboard.
              tabIndex={-1}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={DRAWER}
              {...gate}
              onClick={() => onOpenChange(false)}
              // A dim scrim with a light blur. backdrop-blur is GPU-expensive and
              // re-rasterizes every frame the sheet drags over it; a small radius
              // plus more opacity keeps the glass look without the jank.
              className="pointer-events-auto fixed inset-0 z-50 bg-background/40 backdrop-blur-sm"
            />
          )}
        </PresenceGate>
      ) : null}
      {open ? (
        <PresenceGate key="sheet">
          {({ gate }) => (
            <m.div
              ref={sheetRef}
              drag="y"
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.02, bottom: 0.4 }}
              dragMomentum={false}
              onDragEnd={onDragEnd}
              initial={reduce ? { y: 0, opacity: 0 } : { y: "100%" }}
              animate={reduce ? { y: 0, opacity: 1 } : { y: 0 }}
              exit={reduce ? { y: 0, opacity: 0 } : { y: "100%" }}
              transition={
                reduce ? { duration: 0.18, ease: EASE_DRAWER } : DRAWER
              }
              {...gate}
              style={{ ...heightStyle, ...gate.style }}
              className={cn(
                "pointer-events-auto fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-2xl flex-col overflow-hidden rounded-t-xl outline-none will-change-transform",
                "border border-border bg-background pb-[env(safe-area-inset-bottom)] shadow-lg",
                className,
              )}
              role="dialog"
              aria-modal="true"
              tabIndex={-1}
              aria-labelledby={titleId}
              aria-describedby={description ? descriptionId : undefined}
            >
              <div className="flex flex-col items-center px-4 pt-3 pb-2">
                {/* Drag only the pill so the title and description stay selectable. */}
                <div
                  onPointerDown={(event) => dragControls.start(event)}
                  // A slow pull must not hand the gesture to iOS's callout,
                  // which would leave the sheet frozen mid-drag.
                  className={cn(
                    "flex cursor-grab touch-none items-center justify-center py-1 active:cursor-grabbing",
                    TOUCH_GESTURE_CONTENT_CLASS,
                  )}
                >
                  <div className="h-1.5 w-10 rounded-full bg-muted-foreground/40" />
                </div>
                <div className="mt-2 w-full">
                  <h2
                    id={titleId}
                    className="font-medium text-base text-foreground"
                  >
                    {title}
                  </h2>
                  {description ? (
                    <p
                      id={descriptionId}
                      className="mt-0.5 text-muted-foreground text-sm"
                    >
                      {description}
                    </p>
                  ) : null}
                </div>
              </div>
              {/* overscroll-contain stops boundary scrolls from chaining to the page. */}
              <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
                {children}
              </div>
            </m.div>
          )}
        </PresenceGate>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

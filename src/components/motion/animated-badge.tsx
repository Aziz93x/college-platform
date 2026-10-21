"use client";

import { Check, Circle, type LucideIcon } from "lucide-react";
import {
  AnimatePresence,
  type HTMLMotionProps,
  useReducedMotion,
  type Variants,
} from "motion/react";
import * as m from "motion/react-m";
import { cn } from "@/components/ui/cn";
import { EASE_OUT, SPRING_LAYOUT, SPRING_SWAP } from "./lib/ease.ts";

// The states a badge shows so far: something in use, and something set aside. A step whose badge
// needs another state (an account, readiness, a task) adds it here with its identity colors.
type AnimatedBadgeStatus = "neutral" | "success";

export interface AnimatedBadgeProps
  extends Omit<HTMLMotionProps<"span">, "children"> {
  status?: AnimatedBadgeStatus;
  children: string;
}

// The identity has no green dark enough for small text on white: a state in use takes its teal
// for the fill and the icon, and the primary blue for the words.
const STATUS_CLASS: Record<AnimatedBadgeStatus, string> = {
  neutral: "border-border bg-card text-muted-foreground",
  success:
    "border-secondary/40 bg-secondary/10 text-primary [&_[data-badge-icon]]:text-secondary",
};

const ICONS: Record<AnimatedBadgeStatus, LucideIcon> = {
  neutral: Circle,
  success: Check,
};

// Status swaps roll like the action swap: the leaving glyphs slide up and out while the next ones
// slide in from below. Both fade through a light blur, so the label never reads as a solid smudge
// sitting on top of the badge, and the exit outruns the entry.
const ROLL_EXIT_TRANSITION = { duration: 0.14, ease: EASE_OUT } as const;
const ROLL_BLUR = "blur(3px)";

const ROLL_VARIANTS = (distance: number | string): Variants => ({
  initial: { opacity: 0, y: distance, filter: ROLL_BLUR },
  animate: { opacity: 1, y: 0, filter: "blur(0px)", transition: SPRING_SWAP },
  exit: {
    opacity: 0,
    y: typeof distance === "number" ? -distance : `-${distance}`,
    filter: ROLL_BLUR,
    transition: ROLL_EXIT_TRANSITION,
  },
});
const ICON_ROLL = ROLL_VARIANTS(12);
const TEXT_ROLL = ROLL_VARIANTS("90%");

// Reduced motion swaps in place: the next content lands at rest and the leaving content hides on
// its first frame instead of overlapping it.
const REST = { opacity: 1, y: 0, filter: "blur(0px)" } as const;
const REST_EXIT = { opacity: 0, transition: { duration: 0 } } as const;

// A state in a pill, whose icon and words roll to the next state when it changes.
export function AnimatedBadge({
  status = "neutral",
  children,
  className,
  ...rest
}: AnimatedBadgeProps) {
  const reduce = useReducedMotion();
  // Reduced motion skips the layout projection altogether: a zero-duration layout animation still
  // paints one transformed frame.
  const slotLayout = reduce ? false : ("position" as const);
  const Icon = ICONS[status];

  return (
    <m.span
      layout={!reduce}
      transition={SPRING_LAYOUT}
      className={cn(
        "relative inline-flex h-7 shrink-0 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-full border px-2.5 font-medium text-xs transition-colors duration-300",
        STATUS_CLASS[status],
        className,
      )}
      {...rest}
    >
      {/* The badge animates its width with a scale transform. The slots opt into position-only
          layout, so Motion counter-scales them and the glyphs keep their shape. */}
      <m.span
        layout={slotLayout}
        transition={SPRING_LAYOUT}
        className="relative inline-grid shrink-0 place-items-center overflow-hidden"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <m.span
            key={status}
            aria-hidden
            data-badge-icon
            variants={ICON_ROLL}
            initial={reduce ? false : "initial"}
            animate={reduce ? REST : "animate"}
            exit={reduce ? REST_EXIT : "exit"}
            className="col-start-1 row-start-1 inline-flex items-center justify-center"
          >
            <Icon className="size-3.5" />
          </m.span>
        </AnimatePresence>
      </m.span>
      {/* The roll is clipped to the line box only; a longer leaving label may run past the slot and
          is clipped by the pill instead of cut mid-glyph. */}
      <m.span
        layout={slotLayout}
        transition={SPRING_LAYOUT}
        className="relative inline-flex"
        style={{ clipPath: "inset(0 -999px)" }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <m.span
            key={children}
            variants={TEXT_ROLL}
            initial={reduce ? false : "initial"}
            animate={reduce ? REST : "animate"}
            exit={reduce ? REST_EXIT : "exit"}
            className="inline-block"
          >
            {children}
          </m.span>
        </AnimatePresence>
      </m.span>
    </m.span>
  );
}

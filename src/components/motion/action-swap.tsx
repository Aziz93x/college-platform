"use client";

import {
  AnimatePresence,
  type HTMLMotionProps,
  useReducedMotion,
  type Variants,
} from "motion/react";
import * as m from "motion/react-m";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import {
  EASE_OUT,
  SPRING_LAYOUT,
  SPRING_PRESS,
  SPRING_SWAP,
} from "./lib/ease.ts";

type ActionSwapItem = {
  id: string;
  label: string;
  icon?: ReactNode;
};

// The arriving layer springs in (SPRING_SWAP), so a second change mid-swap bends it toward
// the new target instead of restarting. The leaving layer is a little quicker,
// still long enough to cross the arrival so the swap reads as one morph.
const EXIT = { duration: 0.16, ease: EASE_OUT } as const;
// A light blur softens the crossing without smearing small glyphs.
const SWAP_BLUR = "blur(2px)";

const TEXT_VARIANTS: Variants = {
  initial: { opacity: 0, scale: 0.9, filter: SWAP_BLUR },
  animate: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: SPRING_SWAP,
  },
  exit: { opacity: 0, scale: 0.96, filter: SWAP_BLUR, transition: EXIT },
};

const ICON_VARIANTS: Variants = {
  initial: { opacity: 0, scale: 0.25, filter: SWAP_BLUR },
  animate: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: SPRING_SWAP,
  },
  exit: { opacity: 0, scale: 0.25, filter: SWAP_BLUR, transition: EXIT },
};

const VARIANT_CLASS = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
} as const;

export function ActionSwapText({
  value,
  children,
}: {
  value: string;
  children: string;
}) {
  const reduce = useReducedMotion();
  return (
    <span
      className="relative -my-[0.08em] inline-block max-w-full whitespace-nowrap py-[0.08em] align-bottom"
      style={{ clipPath: "inset(0 -999px)" }}
    >
      {/* Holds the width of the words on show, which the layers above glide to. */}
      <span aria-hidden className="invisible inline-block whitespace-nowrap">
        {children}
      </span>
      <AnimatePresence initial={false}>
        <m.span
          key={value}
          variants={TEXT_VARIANTS}
          initial={reduce ? false : "initial"}
          animate={
            reduce ? { opacity: 1, filter: "blur(0px)", scale: 1 } : "animate"
          }
          exit={reduce ? undefined : "exit"}
          className="absolute start-0 top-[0.08em] inline-block max-w-full truncate will-change-[opacity,filter,transform]"
        >
          {children}
        </m.span>
      </AnimatePresence>
    </span>
  );
}

function ActionSwapIcon({
  value,
  children,
}: {
  value: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <span className="relative inline-grid size-4 shrink-0 place-items-center overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false}>
        <m.span
          key={value}
          aria-hidden
          variants={ICON_VARIANTS}
          initial={reduce ? false : "initial"}
          animate={
            reduce ? { opacity: 1, filter: "blur(0px)", scale: 1 } : "animate"
          }
          exit={reduce ? undefined : "exit"}
          className="col-start-1 row-start-1 inline-flex items-center justify-center will-change-[opacity,filter,transform] [&_svg]:size-4"
        >
          {children}
        </m.span>
      </AnimatePresence>
    </span>
  );
}

export interface ActionSwapButtonProps
  extends Omit<HTMLMotionProps<"button">, "children" | "value"> {
  /** Every state the button shows; `value` picks the one on show. */
  items: ActionSwapItem[];
  value: string;
  variant?: keyof typeof VARIANT_CLASS;
}

// A button whose label and icon trade places as its state changes ("Save", "Saving", "Saved"),
// its width gliding to the new words. Its name is the words on show.
export function ActionSwapButton({
  items,
  value,
  variant = "primary",
  className,
  disabled,
  style,
  // Set either way: Motion adds tabIndex 0 to an element with whileTap, which the server renders
  // and a client that prefers reduced motion would not.
  tabIndex = 0,
  ...rest
}: ActionSwapButtonProps) {
  const reduce = useReducedMotion();
  const item = items.find((entry) => entry.id === value) ?? items[0];
  if (!item) return null;
  const layoutTransition = reduce ? { duration: 0 } : SPRING_LAYOUT;

  return (
    <m.button
      type="button"
      disabled={disabled}
      tabIndex={tabIndex}
      // Words of another length resize the button: the width glides on the soft layout spring,
      // and only when the state changes, so other reflow on the page never animates it.
      layout
      layoutDependency={item.id}
      whileTap={reduce || disabled ? undefined : { scale: 0.97 }}
      transition={{ ...SPRING_PRESS, layout: layoutTransition }}
      // Layout animations correct only a radius set inline.
      style={{ borderRadius: 9999, ...style }}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 overflow-hidden px-4 font-medium text-sm transition-colors pointer-coarse:h-11",
        "outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
        VARIANT_CLASS[variant],
        className,
      )}
      {...rest}
    >
      {/* Position-only layout keeps the contents from stretching with the
          button while its width glides. */}
      {item.icon ? (
        <m.span
          layout="position"
          layoutDependency={item.id}
          transition={layoutTransition}
          className="inline-flex shrink-0"
        >
          <ActionSwapIcon value={item.id}>{item.icon}</ActionSwapIcon>
        </m.span>
      ) : null}
      <m.span
        layout="position"
        layoutDependency={item.id}
        transition={layoutTransition}
        className="inline-flex min-w-0 max-w-full"
      >
        <ActionSwapText value={item.id}>{item.label}</ActionSwapText>
      </m.span>
    </m.button>
  );
}

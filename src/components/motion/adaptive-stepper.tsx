"use client";

import { Minus, Plus } from "lucide-react";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { cn } from "@/components/ui/cn";
import { EASE_OUT, SPRING_PRESS } from "./lib/ease.ts";
import { Liquid, LiquidItem, type LiquidTransition } from "./liquid.tsx";

// The deliberately elastic separation curve of BeUI's liquid stepper.
const STEPPER_LIQUID_TRANSITION = {
  duration: 600,
  ease: [0.22, 1.3, 0.71, 1],
} as const satisfies LiquidTransition;

type StepDirection = -1 | 0 | 1;

type AdaptiveStepperContextValue = {
  value: number;
  valueText: string;
  display: ReactNode;
  direction: StepDirection;
  atMin: boolean;
  atMax: boolean;
  disabled: boolean;
  reduce: boolean;
  decrement: (restoreFocus: boolean) => void;
  increment: (restoreFocus: boolean) => void;
  decrementRef: RefObject<HTMLButtonElement | null>;
  incrementRef: RefObject<HTMLButtonElement | null>;
};

const AdaptiveStepperContext =
  createContext<AdaptiveStepperContextValue | null>(null);

function useAdaptiveStepperContext(component: string) {
  const context = useContext(AdaptiveStepperContext);
  if (!context) {
    throw new Error(`${component} must be used within <AdaptiveStepper>`);
  }
  return context;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface AdaptiveStepperProps {
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  /** The id of the text that names the count, such as a setting's label. */
  "aria-labelledby": string;
  "aria-describedby"?: string;
  /** The buttons' names. */
  labels: { decrease: string; increase: string };
  /** The value in words, with its unit, as screen readers announce it. */
  formatValueText: (value: number) => string;
  /** The value as shown: in the page's digits. */
  formatValue: (value: number) => string;
  disabled?: boolean;
  className?: string;
}

// A count stepped one at a time. Its footprint stays fixed: at a bound the button that cannot act
// leaves, and the value's surface flows into its place. Lower values sit at the inline start, so
// right to left the whole stepper is mirrored, as a slider is.
export function AdaptiveStepper({
  value,
  onValueChange,
  min,
  max,
  labels,
  formatValueText,
  formatValue,
  disabled = false,
  className,
  ...aria
}: AdaptiveStepperProps) {
  const reduce = useReducedMotion() ?? false;
  const decrementRef = useRef<HTMLButtonElement>(null);
  const incrementRef = useRef<HTMLButtonElement>(null);
  const current = clamp(value, min, max);
  const previousValueRef = useRef(current);
  const currentValueRef = useRef(current);
  const direction: StepDirection =
    current === previousValueRef.current
      ? 0
      : current > previousValueRef.current
        ? 1
        : -1;

  useLayoutEffect(() => {
    previousValueRef.current = current;
    currentValueRef.current = current;
  }, [current]);

  // A keyboard press that reaches a bound hands focus to the button that is left, since the
  // pressed one leaves.
  const commit = useCallback(
    (next: number, restoreFocus: boolean) => {
      if (next === current) return;
      onValueChange(next);
      if (!restoreFocus) return;
      requestAnimationFrame(() => {
        if (next === max && currentValueRef.current === max) {
          decrementRef.current?.focus();
        } else if (next === min && currentValueRef.current === min) {
          incrementRef.current?.focus();
        }
      });
    },
    [current, max, min, onValueChange],
  );

  const context = useMemo<AdaptiveStepperContextValue>(
    () => ({
      value: current,
      valueText: formatValueText(current),
      display: formatValue(current),
      direction,
      atMin: current <= min,
      atMax: current >= max,
      disabled,
      reduce,
      decrement: (restoreFocus) => {
        if (!disabled && current > min) commit(current - 1, restoreFocus);
      },
      increment: (restoreFocus) => {
        if (!disabled && current < max) commit(current + 1, restoreFocus);
      },
      decrementRef,
      incrementRef,
    }),
    [
      commit,
      current,
      direction,
      disabled,
      formatValue,
      formatValueText,
      max,
      min,
      reduce,
    ],
  );

  return (
    <AdaptiveStepperContext.Provider value={context}>
      <fieldset
        {...aria}
        disabled={disabled}
        className={cn(
          "relative isolate m-0 inline-block h-12 w-[13.5rem] border-0 p-0",
          className,
        )}
      >
        <Liquid
          blur={8}
          contrast={22}
          fill="var(--card)"
          edgeColor="var(--input)"
          edgeOpacity={1}
          // A height of its own: percentages do not resolve inside a fieldset.
          className="h-12 w-full rtl:-scale-x-100"
        >
          <StepperAction direction={-1} label={labels.decrease} />
          <AdaptiveStepperValue />
          <StepperAction direction={1} label={labels.increase} />
        </Liquid>
      </fieldset>
    </AdaptiveStepperContext.Provider>
  );
}

function StepperAction({
  direction,
  label,
}: {
  direction: -1 | 1;
  label: string;
}) {
  const context = useAdaptiveStepperContext("AdaptiveStepper action");
  const hidden = direction === -1 ? context.atMin : context.atMax;
  const actionRef =
    direction === -1 ? context.decrementRef : context.incrementRef;
  const action = direction === -1 ? context.decrement : context.increment;
  const x = direction === -1 ? (hidden ? 32 : 0) : hidden ? 136 : 168;

  return (
    <LiquidItem
      x={x}
      y={0}
      width={48}
      height={48}
      radius={24}
      transition={STEPPER_LIQUID_TRANSITION}
    >
      <m.button
        ref={actionRef}
        type="button"
        aria-label={label}
        aria-hidden={hidden || undefined}
        // Set either way: Motion adds tabIndex 0 to an element with whileTap, which the server
        // renders and a client that prefers reduced motion would not.
        tabIndex={hidden ? -1 : 0}
        disabled={context.disabled || hidden}
        whileTap={
          context.reduce || context.disabled || hidden
            ? undefined
            : { scale: 0.94 }
        }
        transition={context.reduce ? { duration: 0 } : SPRING_PRESS}
        className={cn(
          "grid size-full place-items-center rounded-full text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none",
          hidden && "hover:bg-transparent",
          context.disabled && "opacity-50",
        )}
        // A click with no pointer (Enter or Space) is the keyboard.
        onClick={(event) => action(event.detail === 0)}
      >
        <m.span
          aria-hidden
          initial={false}
          animate={{
            opacity: hidden ? 0 : 1,
            filter: hidden ? "blur(2px)" : "blur(0px)",
          }}
          transition={{ duration: context.reduce ? 0 : 0.15, ease: EASE_OUT }}
        >
          {direction === -1 ? (
            <Minus className="size-5" strokeWidth={2.5} />
          ) : (
            <Plus className="size-5" strokeWidth={2.5} />
          )}
        </m.span>
      </m.button>
    </LiquidItem>
  );
}

function AdaptiveStepperValue() {
  const context = useAdaptiveStepperContext("AdaptiveStepperValue");
  const geometry =
    context.atMin && context.atMax
      ? { x: 0, width: 216 }
      : context.atMin
        ? { x: 0, width: 152 }
        : context.atMax
          ? { x: 64, width: 152 }
          : { x: 64, width: 88 };
  // The number rolls the way it moved: up as it grows, down as it shrinks.
  const distance = context.reduce ? 0 : context.direction * 32;

  return (
    <LiquidItem
      x={geometry.x}
      y={0}
      width={geometry.width}
      height={48}
      radius={24}
      transition={STEPPER_LIQUID_TRANSITION}
    >
      {/* Mirrored back, so the number reads the right way round. */}
      <output
        aria-live="polite"
        aria-atomic="true"
        className="flex size-full min-w-0 items-center justify-center overflow-hidden rounded-full px-4 font-medium text-foreground text-lg tabular-nums rtl:-scale-x-100"
      >
        <span className="sr-only">{context.valueText}</span>
        <span
          aria-hidden
          className="relative grid min-h-[1.1em] min-w-[1ch] place-items-center overflow-hidden leading-none"
        >
          <AnimatePresence initial={false} mode="popLayout">
            <m.span
              key={context.value}
              initial={{
                opacity: context.reduce ? 1 : 0.35,
                filter: context.reduce ? "blur(0px)" : "blur(2px)",
                transform: `translateY(${distance}%)`,
              }}
              animate={{
                opacity: 1,
                filter: "blur(0px)",
                transform: "translateY(0%)",
              }}
              exit={{
                opacity: context.reduce ? 1 : 0,
                filter: context.reduce ? "blur(0px)" : "blur(2px)",
                transform: `translateY(${-distance}%)`,
                transition: {
                  duration: context.reduce ? 0 : 0.12,
                  ease: EASE_OUT,
                },
              }}
              transition={{
                duration: context.reduce ? 0 : 0.18,
                ease: EASE_OUT,
              }}
              className="col-start-1 row-start-1 will-change-[transform,filter,opacity]"
            >
              {context.display}
            </m.span>
          </AnimatePresence>
        </span>
      </output>
    </LiquidItem>
  );
}

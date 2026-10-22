"use client";

import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { useId } from "react";
import { cn } from "@/components/ui/cn";
import { EASE_OUT, SPRING_PRESS } from "./lib/ease.ts";

const CHECK_PATH = "M5 13l4 4L19 7";

export interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  /** Supporting text under the label, announced as the description rather than the name. */
  description?: string;
  /** Submits "on" under this name while checked, as a native checkbox would. */
  name?: string;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({
  checked,
  onCheckedChange,
  label,
  description,
  name,
  disabled,
  className,
}: CheckboxProps) {
  const id = useId();
  const reduce = useReducedMotion();
  const descriptionId = description ? `${id}-description` : undefined;
  // The wrapping <label> would fold the description into the name, so name from the label text alone.
  const labelId = `${id}-label`;

  return (
    <label
      htmlFor={id}
      className={cn(
        "inline-flex gap-3 pointer-coarse:min-h-11",
        description ? "items-start" : "items-center",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
        className,
      )}
    >
      <m.button
        id={id}
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        whileTap={reduce || disabled ? undefined : { scale: 0.92 }}
        // Set either way: Motion adds tabIndex 0 to an element with whileTap, which the server
        // renders and a client that prefers reduced motion would not.
        tabIndex={0}
        transition={SPRING_PRESS}
        data-state={checked ? "checked" : "unchecked"}
        className={cn(
          // 20 px drawn, with a hit area of 44 px.
          "relative mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-md border-2 outline-none transition-colors after:absolute after:-inset-3.5 after:content-['']",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-60",
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-input bg-background hover:border-muted-foreground",
        )}
      >
        <AnimatePresence initial={false}>
          {checked ? (
            <m.svg
              key="checked"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.5 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              exit={
                reduce
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.5, filter: "blur(4px)" }
              }
              transition={
                reduce ? { duration: 0 } : { duration: 0.16, ease: EASE_OUT }
              }
              aria-hidden
            >
              <m.path
                d={CHECK_PATH}
                initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : { duration: 0.3, ease: EASE_OUT, delay: 0.04 }
                }
              />
            </m.svg>
          ) : null}
        </AnimatePresence>
      </m.button>
      <span
        className={cn(
          "flex min-w-0 flex-col gap-0.5 select-none",
          disabled && "opacity-60",
        )}
      >
        <span id={labelId} className="text-sm">
          {label}
        </span>
        {description ? (
          <span id={descriptionId} className="text-muted-foreground text-xs">
            {description}
          </span>
        ) : null}
      </span>
      {name && checked ? <input type="hidden" name={name} value="on" /> : null}
    </label>
  );
}

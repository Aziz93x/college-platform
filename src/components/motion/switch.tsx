"use client";

import { MotionConfig, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { useState } from "react";
import { cn } from "@/components/ui/cn";

// Heavy, deliberate thumb: high mass keeps the travel weighty without wobble.
const THUMB_SPRING = {
  type: "spring",
  stiffness: 800,
  damping: 80,
  mass: 4,
} as const;

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** The id of the text that names the switch, such as a setting's label. */
  "aria-labelledby": string;
  "aria-describedby"?: string;
  disabled?: boolean;
  className?: string;
}

// On sits at the inline end, so right to left the thumb travels to the left, as on a phone.
export function Switch({
  checked,
  onCheckedChange,
  disabled,
  className,
  ...aria
}: SwitchProps) {
  const reduce = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const squish = !disabled && pressed && !reduce;

  return (
    <MotionConfig transition={reduce ? { duration: 0 } : THUMB_SPRING}>
      <m.button
        {...aria}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        initial={false}
        data-state={checked ? "checked" : "unchecked"}
        className={cn(
          // 28 px tall, with a hit area of 44 px.
          "relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full px-1 outline-none transition-colors duration-200",
          "after:absolute after:inset-x-0 after:-inset-y-2 after:content-['']",
          "focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-60",
          checked
            ? "justify-end bg-primary"
            : "justify-start bg-muted-foreground/45",
          className,
        )}
      >
        <m.span
          layout
          animate={{ scale: squish ? 0.9 : 1 }}
          className="pointer-events-none block size-5 rounded-full bg-background shadow-md"
        >
          {/* Stretches toward where it is going while pressed. */}
          <span
            className={cn(
              "block size-5",
              squish && (checked ? "ms-1" : "me-1"),
            )}
          />
        </m.span>
      </m.button>
    </MotionConfig>
  );
}

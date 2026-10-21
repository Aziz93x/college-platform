"use client";

import { CircleAlert, Info } from "lucide-react";
import {
  AnimatePresence,
  type HTMLMotionProps,
  useReducedMotion,
} from "motion/react";
import * as m from "motion/react-m";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { EASE_OUT, SPRING_LAYOUT } from "./lib/ease.ts";
import { PresenceGate } from "./lib/presence-gate.tsx";

// "alert" is the one red the identity allows (docs/PLAN.md section 4): errors and refusals only.
type AlertVariant = "info" | "alert";

const VARIANT_CLASS: Record<AlertVariant, string> = {
  info: "bg-primary/5 text-primary",
  alert: "bg-alert/5 text-alert",
};

const VARIANT_ICON = { info: Info, alert: CircleAlert };

// An alert is announced at once; information politely, when it changes.
const LIVE_REGION = { info: "status", alert: "alert" } as const;

export interface AlertProps
  extends Omit<
    HTMLMotionProps<"div">,
    | "initial"
    | "animate"
    | "exit"
    | "layout"
    | "transition"
    | "role"
    | "children"
  > {
  variant: AlertVariant;
  children?: ReactNode;
  open?: boolean;
  /** Layout classes for the inner row, separate from the animated surface. */
  contentClassName?: string;
}

// Inline feedback that eases in and out of the flow.
export function Alert({
  variant,
  open = true,
  contentClassName,
  className,
  children,
  ...props
}: AlertProps) {
  const reduce = useReducedMotion() ?? false;
  const Icon = VARIANT_ICON[variant];
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <PresenceGate key="alert">
          {({ gate, isPresent }) => (
            <m.div
              {...props}
              {...gate}
              role={LIVE_REGION[variant]}
              aria-hidden={!isPresent || undefined}
              data-variant={variant}
              initial={{
                opacity: 0,
                transform: reduce ? "none" : "translateY(-6px)",
              }}
              animate={{ opacity: 1, transform: "none" }}
              exit={{
                opacity: 0,
                transform: reduce ? "none" : "translateY(-6px)",
                transition: { duration: 0.12, ease: EASE_OUT },
              }}
              layout={!reduce}
              transition={{
                opacity: { duration: 0.18, ease: EASE_OUT },
                transform: { duration: 0.2, ease: EASE_OUT },
                layout: SPRING_LAYOUT,
              }}
              style={{ ...gate.style, originY: 0 }}
              className={cn(
                "relative w-full rounded-xl p-4 text-sm",
                VARIANT_CLASS[variant],
                className,
              )}
            >
              <div
                className={cn(
                  "flex min-w-0 items-start gap-3",
                  contentClassName,
                )}
              >
                <Icon aria-hidden className="mt-1 size-4 shrink-0" />
                <div className="min-w-0 space-y-1">{children}</div>
              </div>
            </m.div>
          )}
        </PresenceGate>
      ) : null}
    </AnimatePresence>
  );
}

export function AlertTitle({ className, ...props }: ComponentProps<"p">) {
  return <p {...props} className={cn("font-medium text-pretty", className)} />;
}

export function AlertDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p {...props} className={cn("text-pretty text-foreground/80", className)} />
  );
}

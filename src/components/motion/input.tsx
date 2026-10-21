"use client";

import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import {
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "@/components/ui/cn";

// No dir: the padding and the icons follow the page, and the text takes the direction of what is
// typed (unicode-bidi: plaintext), so an email runs left to right without moving the padding.
export interface InputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "value" | "defaultValue" | "onChange" | "dir"
  > {
  label: string;
  /** Keeps the label for screen readers only, where the page already shows the field's name. */
  hideLabel?: boolean;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** A message shakes the field once and shows under it; it is announced at once. */
  error?: string;
  /** Help under the field while there is no error. */
  hint?: string;
  /** Holds one message line, so a message appearing does not move what follows. */
  reserveErrorLine?: boolean;
  startIcon?: ReactNode;
  /** A control at the end of the field, such as a button that shows the password. */
  endSlot?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

// The shake: a few pixels each way, settling, once per new error.
const SHAKE = [0, -6, 6, -4, 4, -2, 0].map((x) => ({
  transform: `translateX(${x}px)`,
}));

export function Input({
  label,
  hideLabel = false,
  value: valueProp,
  defaultValue,
  onChange,
  onFocus,
  onBlur,
  error,
  hint,
  reserveErrorLine = false,
  startIcon,
  endSlot,
  className,
  disabled,
  id: idProp,
  ref,
  ...rest
}: InputProps) {
  const reactId = useId();
  const id = idProp ?? reactId;
  const reduce = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const fieldRef = useRef<HTMLDivElement>(null);

  // The Web Animations API moves the field, so the shake needs none of Motion's code.
  useEffect(() => {
    if (!error || reduce) return;
    fieldRef.current?.animate(SHAKE, { duration: 450 });
  }, [error, reduce]);

  const messageId = `${id}-message`;
  const message = error ?? hint;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={id}
        className={cn("px-1 font-medium text-sm", hideLabel && "sr-only")}
      >
        {label}
      </label>
      <div
        ref={fieldRef}
        data-state={error ? "error" : focused ? "focused" : "idle"}
        className={cn(
          "relative h-11 overflow-hidden rounded-lg bg-background transition-shadow",
          // The border is drawn over the field, not around it, so the input fills all 44 px and a
          // tap on the edge reaches it.
          "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border after:border-input after:transition-colors",
          focused && !error && "ring-3 ring-ring/30 after:border-ring",
          error && "ring-3 ring-alert/20 after:border-alert",
          disabled && "opacity-60",
        )}
      >
        {startIcon ? (
          <span className="pointer-events-none absolute start-3 top-1/2 flex -translate-y-1/2 items-center text-muted-foreground [&_svg]:size-4">
            {startIcon}
          </span>
        ) : null}
        <input
          ref={ref}
          id={id}
          // Uncontrolled without a value, so a form action's reset empties the field.
          value={valueProp}
          defaultValue={defaultValue}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          {...rest}
          onChange={(event) => onChange?.(event.target.value)}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          className={cn(
            "h-full w-full bg-transparent text-base text-foreground caret-foreground outline-none [unicode-bidi:plaintext] placeholder:text-muted-foreground/70",
            startIcon ? "ps-10" : "ps-3.5",
            endSlot ? "pe-11" : "pe-3.5",
            disabled && "cursor-not-allowed",
          )}
        />
        {endSlot ? (
          <span className="absolute end-0 top-0 flex h-full items-center text-muted-foreground [&_button]:grid [&_button]:size-11 [&_button]:place-items-center [&_svg]:size-4">
            {endSlot}
          </span>
        ) : null}
      </div>
      <div className={reserveErrorLine ? "min-h-5" : "contents"}>
        <AnimatePresence initial={false} mode="popLayout">
          {error ? (
            <m.p
              key="error"
              id={messageId}
              role="alert"
              initial={
                reduce
                  ? { opacity: 0 }
                  : { opacity: 0, y: -4, filter: "blur(4px)" }
              }
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={
                reduce
                  ? { opacity: 0 }
                  : { opacity: 0, y: -4, filter: "blur(4px)" }
              }
              transition={{ duration: 0.2 }}
              className="px-1 text-alert text-sm"
            >
              {error}
            </m.p>
          ) : hint ? (
            <p
              key="hint"
              id={messageId}
              className="px-1 text-muted-foreground text-sm"
            >
              {hint}
            </p>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

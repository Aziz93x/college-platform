"use client";

import { ChevronsUpDown, Search, X } from "lucide-react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import type {
  InputHTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  Ref,
} from "react";
import { cn } from "@/components/ui/cn";
import { mergeRefs } from "../combobox/context.tsx";
import { EASE_OUT, SPRING_LAYOUT, SPRING_SWAP } from "../lib/ease.ts";
import { useMultiSelectContext } from "./context.tsx";

// The field's visible name, tied to the input.
export function MultiSelectLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const context = useMultiSelectContext("MultiSelectLabel");
  return (
    <label
      htmlFor={context.inputId}
      className={cn("mb-1.5 block px-1 font-medium text-sm", className)}
    >
      {children}
    </label>
  );
}

// Looks like the text fields: at least 44 px tall, the input border and focus ring. The chosen
// options wrap inside it, before the input, and it grows with them, a row of 44 px each on a touch
// screen. A press anywhere on it but a chip opens the list.
export function MultiSelectTrigger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const context = useMultiSelectContext("MultiSelectTrigger");
  return (
    <div
      ref={context.triggerRef}
      data-state={context.open ? "open" : "closed"}
      onPointerDown={(event) => {
        const target = event.target as HTMLElement;
        if (
          context.disabled ||
          target === context.inputRef.current ||
          target.closest("[data-multi-select-remove]")
        ) {
          return;
        }
        event.preventDefault();
        context.inputRef.current?.focus({ preventScroll: true });
        context.setOpen(true);
      }}
      className={cn(
        "relative flex min-h-11 w-full cursor-text items-center gap-2 rounded-lg bg-background py-1.5 ps-3 pe-3 transition-shadow pointer-coarse:py-0",
        "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border after:border-input after:transition-colors",
        "focus-within:ring-3 focus-within:ring-ring/30 focus-within:after:border-ring",
        context.disabled && "pointer-events-none opacity-60",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {children}
      </div>
      <span aria-hidden className="shrink-0 text-muted-foreground">
        <ChevronsUpDown className="size-4" />
      </span>
    </div>
  );
}

// The chosen options, in the order they were chosen, each a chip that takes it out when pressed,
// named by `removeLabel` from the catalog. A chip is drawn 28 px tall, and its button is 44 px on a
// touch screen.
export function MultiSelectValue({
  removeLabel,
  className,
}: {
  removeLabel: (label: string) => string;
  className?: string;
}) {
  const context = useMultiSelectContext("MultiSelectValue");
  return (
    <AnimatePresence initial={false} mode="popLayout">
      {context.values.map((value) => {
        const label = context.labelFor(value);
        return (
          <m.button
            layout="position"
            key={value}
            type="button"
            data-multi-select-remove=""
            aria-label={removeLabel(label)}
            disabled={context.disabled}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={
              context.reduce
                ? { duration: 0 }
                : {
                    layout: SPRING_LAYOUT,
                    opacity: { duration: 0.18, ease: EASE_OUT },
                    scale: SPRING_SWAP,
                  }
            }
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              context.remove(value);
              context.inputRef.current?.focus({ preventScroll: true });
            }}
            className={cn(
              "group inline-flex h-7 max-w-full items-center outline-none pointer-coarse:h-11",
              className,
            )}
          >
            <span className="inline-flex h-7 min-w-0 items-center gap-1 rounded-md bg-muted ps-2 pe-1.5 font-medium text-foreground text-xs transition-colors group-hover:bg-foreground/10 group-focus-visible:ring-2 group-focus-visible:ring-ring">
              <span className="truncate">{label}</span>
              <X
                aria-hidden
                className="size-3 shrink-0 text-muted-foreground"
              />
            </span>
          </m.button>
        );
      })}
    </AnimatePresence>
  );
}

export interface MultiSelectInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "defaultValue" | "value"
  > {
  ref?: Ref<HTMLInputElement>;
}

// What is typed filters the list. Up and down move through it, Enter adds or takes out the option
// it points at, Backspace in an empty field takes out the last chosen one, Escape closes.
export function MultiSelectInput({
  ref,
  className,
  onChange,
  onKeyDown,
  placeholder,
  ...props
}: MultiSelectInputProps) {
  const context = useMultiSelectContext("MultiSelectInput");

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (
      event.key === "Backspace" &&
      !context.query &&
      context.values.length > 0
    ) {
      event.preventDefault();
      context.remove(context.values[context.values.length - 1]);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      // Opening is the whole action: the next key steps through the list on show.
      if (!context.open) {
        context.setOpen(true);
        return;
      }
      context.moveActive(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Home" && context.open) {
      event.preventDefault();
      context.moveActive("first");
    } else if (event.key === "End" && context.open) {
      event.preventDefault();
      context.moveActive("last");
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (context.open) context.toggleActive();
      else context.setOpen(true);
    } else if (event.key === "Escape" && context.open) {
      // Closes the list before a sheet around it sees the key: the sheet's trap listens on the
      // document, ahead of the window.
      event.preventDefault();
      context.setOpen(false, true);
    }
  };

  return (
    <span className="flex min-w-24 flex-1 items-center gap-2">
      {context.values.length === 0 ? (
        <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      ) : null}
      <input
        {...props}
        ref={mergeRefs(ref, context.inputRef)}
        id={context.inputId}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={context.open}
        aria-controls={context.listId}
        aria-activedescendant={context.open ? context.activeItemId : undefined}
        autoComplete="off"
        disabled={context.disabled}
        value={context.query}
        placeholder={context.values.length > 0 ? undefined : placeholder}
        onFocus={() => context.setOpen(true)}
        onClick={() => context.setOpen(true)}
        onChange={(event) => {
          context.setOpen(true);
          context.setQuery(event.target.value);
          onChange?.(event);
        }}
        onKeyDown={handleKeyDown}
        className={cn(
          "h-7 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none [unicode-bidi:plaintext] placeholder:text-muted-foreground/70 disabled:cursor-not-allowed pointer-coarse:h-11",
          className,
        )}
      />
    </span>
  );
}

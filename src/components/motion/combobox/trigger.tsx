"use client";

import { ChevronsUpDown, Search } from "lucide-react";
import type {
  InputHTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  Ref,
} from "react";
import { cn } from "@/components/ui/cn";
import { mergeRefs, useComboboxContext } from "./context.tsx";

// The field's visible name, tied to the input.
export function ComboboxLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const context = useComboboxContext("ComboboxLabel");
  return (
    <label
      htmlFor={context.inputId}
      className={cn("mb-1.5 block px-1 font-medium text-sm", className)}
    >
      {children}
    </label>
  );
}

// Looks like the text fields: 44 px tall, the input border and focus ring. The border is drawn over
// the field, not around it, so the input fills all 44 px and a tap on the edge reaches it. A press
// anywhere on it opens the list.
export function ComboboxTrigger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const context = useComboboxContext("ComboboxTrigger");
  return (
    <div
      ref={context.triggerRef}
      data-state={context.open ? "open" : "closed"}
      onPointerDown={(event) => {
        if (context.disabled || event.target === context.inputRef.current) {
          return;
        }
        event.preventDefault();
        context.inputRef.current?.focus({ preventScroll: true });
        context.setOpen(true);
      }}
      className={cn(
        "relative flex h-11 w-full cursor-text items-center gap-2 rounded-lg bg-background ps-3 pe-3 transition-shadow",
        "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border after:border-input after:transition-colors",
        "focus-within:ring-3 focus-within:ring-ring/30 focus-within:after:border-ring",
        context.disabled && "pointer-events-none opacity-60",
        className,
      )}
    >
      {children}
      <span aria-hidden className="shrink-0 text-muted-foreground">
        <ChevronsUpDown className="size-4" />
      </span>
    </div>
  );
}

export interface ComboboxInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "defaultValue" | "value"
  > {
  ref?: Ref<HTMLInputElement>;
}

// Shows the chosen option while closed and what is typed while open. Up and down move through the
// list, Enter picks, Escape closes.
export function ComboboxInput({
  ref,
  className,
  onChange,
  onKeyDown,
  ...props
}: ComboboxInputProps) {
  const context = useComboboxContext("ComboboxInput");
  const selectedLabel = context.labelFor(context.value);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
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
      if (context.open) context.selectActive();
      else context.setOpen(true);
    }
  };

  return (
    <>
      <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
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
        value={context.open ? context.query : (selectedLabel ?? "")}
        onFocus={() => context.setOpen(true)}
        onClick={() => context.setOpen(true)}
        onChange={(event) => {
          context.setOpen(true);
          context.setQuery(event.target.value);
          onChange?.(event);
        }}
        onKeyDown={handleKeyDown}
        className={cn(
          "h-full min-w-0 flex-1 bg-transparent text-base text-foreground outline-none [unicode-bidi:plaintext] placeholder:text-muted-foreground/70 disabled:cursor-not-allowed",
          className,
        )}
      />
    </>
  );
}

"use client";

import { Check } from "lucide-react";
import * as m from "motion/react-m";
import { type ReactNode, useId, useLayoutEffect, useMemo, useRef } from "react";
import { cn } from "@/components/ui/cn";
import { EASE_OUT, SPRING_LAYOUT } from "../lib/ease.ts";
import { useComboboxContext } from "./context.tsx";

export function ComboboxList({
  children,
  "aria-label": ariaLabel,
  className,
}: {
  children: ReactNode;
  /** The list's name, from the message catalog. */
  "aria-label": string;
  className?: string;
}) {
  const context = useComboboxContext("ComboboxList");
  return (
    <div
      id={context.listId}
      role="listbox"
      aria-label={ariaLabel}
      data-combobox-list=""
      className={cn(
        "relative isolate max-h-64 overflow-y-auto overscroll-contain p-1.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface ComboboxItemProps {
  value: string;
  children: ReactNode;
  /** What the field shows once the option is chosen, and what typing matches first. */
  textValue: string;
  /** More words typing matches, such as an employee number. */
  keywords?: string[];
  disabled?: boolean;
  className?: string;
}

// An option: the pointer or the keyboard moves a soft highlight onto it, and a check marks the
// chosen one. 44 px tall on a touch screen.
export function ComboboxItem({
  value,
  children,
  textValue,
  keywords = [],
  disabled = false,
  className,
}: ComboboxItemProps) {
  const context = useComboboxContext("ComboboxItem");
  const id = useId();
  const itemRef = useRef<HTMLButtonElement>(null);
  const visible = context.isVisible(value);
  const active = context.activeValue === value;
  const selected = context.value === value;
  const keywordKey = keywords.join("\u0000");
  const normalizedKeywords = useMemo(
    () => (keywordKey ? keywordKey.split("\u0000") : []),
    [keywordKey],
  );
  const { registerItem, unregisterItem } = context;

  useLayoutEffect(() => {
    registerItem({
      value,
      label: textValue,
      keywords: normalizedKeywords,
      disabled,
      id,
      ref: itemRef,
    });
    return () => unregisterItem(value);
  }, [
    disabled,
    id,
    normalizedKeywords,
    registerItem,
    textValue,
    unregisterItem,
    value,
  ]);

  if (!visible) return null;

  return (
    <button
      ref={itemRef}
      id={id}
      type="button"
      role="option"
      aria-selected={selected}
      disabled={disabled}
      tabIndex={-1}
      data-active={active || undefined}
      onPointerMove={() => {
        if (!disabled) context.setActiveValue(value);
      }}
      onPointerDown={(event) => event.preventDefault()}
      onClick={() => {
        if (!disabled) context.select(value);
      }}
      className={cn(
        "relative flex w-full items-center gap-2 rounded-md px-2 py-2 text-start text-sm outline-none transition-colors duration-150 pointer-coarse:min-h-11",
        active ? "text-foreground" : "text-muted-foreground",
        "disabled:pointer-events-none disabled:opacity-45",
        className,
      )}
    >
      {active ? (
        <m.span
          aria-hidden
          layoutId={context.activeLayoutId}
          className="absolute inset-0 -z-10 rounded-md bg-muted"
          transition={context.reduce ? { duration: 0 } : SPRING_LAYOUT}
        />
      ) : null}
      <span className="min-w-0 flex-1">{children}</span>
      <m.span
        aria-hidden
        initial={false}
        animate={{ opacity: selected ? 1 : 0, scale: selected ? 1 : 0.82 }}
        transition={
          context.reduce ? { duration: 0 } : { duration: 0.14, ease: EASE_OUT }
        }
        className="grid size-5 shrink-0 place-items-center text-primary"
      >
        <Check className="size-4" />
      </m.span>
    </button>
  );
}

// What the list says when nothing matches what is typed.
export function ComboboxEmpty({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const context = useComboboxContext("ComboboxEmpty");
  if (context.visibleCount > 0) return null;
  return (
    <output
      className={cn(
        "block px-3 py-8 text-center text-muted-foreground text-sm",
        className,
      )}
    >
      {children}
    </output>
  );
}

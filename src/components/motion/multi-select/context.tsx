"use client";

import { useReducedMotion } from "motion/react";
import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/components/ui/cn";
import { toLatinDigits } from "@/platform/validation/digits";
import { useActiveOption } from "../combobox/use-active-option.ts";
import { searchCommands } from "../lib/command-search.ts";

export type RegisteredMultiSelectItem = {
  value: string;
  label: string;
  keywords: string[];
  disabled: boolean;
  id: string;
  ref: RefObject<HTMLButtonElement | null>;
};

type MultiSelectFilter = (
  value: string,
  query: string,
  keywords: string[],
) => boolean;

// The combobox's search: Arabic words match with or without the article and across their
// spellings, and digits typed on an Arabic keyboard match Latin ones, such as employee numbers.
const defaultFilter: MultiSelectFilter = (value, query, [label, ...keywords]) =>
  searchCommands([{ label: label ?? value, keywords }], toLatinDigits(query))
    .length > 0;

export type MultiSelectContextValue = {
  open: boolean;
  setOpen: (open: boolean, restoreFocus?: boolean) => void;
  values: string[];
  toggle: (value: string) => void;
  remove: (value: string) => void;
  query: string;
  setQuery: (query: string) => void;
  /** The option the list is pointing at, resolved during render. */
  activeValue: string | null;
  setActiveValue: (value: string | null) => void;
  moveActive: (direction: 1 | -1 | "first" | "last") => void;
  toggleActive: () => void;
  registerItem: (item: RegisteredMultiSelectItem) => void;
  unregisterItem: (value: string) => void;
  labelFor: (value: string) => string;
  isVisible: (value: string) => boolean;
  visibleCount: number;
  activeItemId: string | undefined;
  listId: string;
  inputId: string;
  disabled: boolean;
  reduce: boolean;
  triggerRef: RefObject<HTMLDivElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  inputRef: RefObject<HTMLInputElement | null>;
  activeLayoutId: string;
};

const MultiSelectContext = createContext<MultiSelectContextValue | null>(null);

export function useMultiSelectContext(component: string) {
  const context = useContext(MultiSelectContext);
  if (!context) {
    throw new Error(`${component} must be used within <MultiSelect>`);
  }
  return context;
}

// A field that filters a list as one types and takes several of its options, each shown as a chip
// in the field. Controlled: the page holds the chosen values, in the order they were chosen.
export function MultiSelect({
  children,
  value,
  onValueChange,
  filter = defaultFilter,
  disabled = false,
  className,
}: {
  children: ReactNode;
  value: string[];
  onValueChange: (value: string[]) => void;
  filter?: MultiSelectFilter;
  disabled?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion() ?? false;
  const baseId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpenState] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Map<string, RegisteredMultiSelectItem>>(
    new Map(),
  );

  const setOpen = useCallback(
    (next: boolean, restoreFocus = false) => {
      if (disabled && next) return;
      setOpenState(next);
      if (!next) setQuery("");
      if (restoreFocus) {
        requestAnimationFrame(() =>
          inputRef.current?.focus({ preventScroll: true }),
        );
      }
    },
    [disabled],
  );

  const registerItem = useCallback((item: RegisteredMultiSelectItem) => {
    setItems((current) => {
      const existing = current.get(item.value);
      if (
        existing?.label === item.label &&
        existing.disabled === item.disabled &&
        existing.id === item.id &&
        existing.ref === item.ref &&
        existing.keywords.join("\u0000") === item.keywords.join("\u0000")
      ) {
        return current;
      }
      const next = new Map(current);
      next.set(item.value, item);
      return next;
    });
  }, []);

  const unregisterItem = useCallback((itemValue: string) => {
    setItems((current) => {
      if (!current.has(itemValue)) return current;
      const next = new Map(current);
      next.delete(itemValue);
      return next;
    });
  }, []);

  // Closing clears the query, but the panel is still on screen for its exit, so it keeps filtering
  // by the query it was open with rather than refilling while it folds away.
  const [openQuery, setOpenQuery] = useState(query);
  if (open && openQuery !== query) setOpenQuery(query);
  const listQuery = open ? query : openQuery;

  const visibleItems = useMemo(
    () =>
      Array.from(items.values()).filter(
        (item) =>
          !listQuery.trim() ||
          filter(item.value, listQuery, [item.label, ...item.keywords]),
      ),
    [filter, items, listQuery],
  );
  const enabledVisibleItems = useMemo(
    () => visibleItems.filter((item) => !item.disabled),
    [visibleItems],
  );
  const visibleValues = useMemo(
    () => new Set(visibleItems.map((item) => item.value)),
    [visibleItems],
  );

  const { activeValue, setActiveValue, moveActive } = useActiveOption({
    open,
    query: listQuery,
    value: value[0],
    enabledItems: enabledVisibleItems,
  });

  // A pick adds the option, or takes it out if it was chosen, and keeps the list open for the next,
  // with the query cleared and the focus on the field.
  const toggle = useCallback(
    (next: string) => {
      if (items.get(next)?.disabled) return;
      onValueChange(
        value.includes(next)
          ? value.filter((each) => each !== next)
          : [...value, next],
      );
      setQuery("");
      requestAnimationFrame(() =>
        inputRef.current?.focus({ preventScroll: true }),
      );
    },
    [items, onValueChange, value],
  );

  const remove = useCallback(
    (itemValue: string) => {
      if (!value.includes(itemValue)) return;
      onValueChange(value.filter((each) => each !== itemValue));
    },
    [onValueChange, value],
  );

  const toggleActive = useCallback(() => {
    if (activeValue) toggle(activeValue);
  }, [activeValue, toggle]);

  useEffect(() => {
    if (!activeValue || !open) return;
    const item = items.get(activeValue)?.ref.current;
    const list = item?.closest<HTMLElement>("[data-multi-select-list]");
    if (!item || !list) return;
    const itemRect = item.getBoundingClientRect();
    const listRect = list.getBoundingClientRect();
    if (itemRect.top < listRect.top) {
      list.scrollTop -= listRect.top - itemRect.top;
    } else if (itemRect.bottom > listRect.bottom) {
      list.scrollTop += itemRect.bottom - listRect.bottom;
    }
  }, [activeValue, items, open]);

  // A press or focus outside, or Escape, closes the list.
  useEffect(() => {
    if (!open) return;
    const isInside = (target: Node) =>
      rootRef.current?.contains(target) || contentRef.current?.contains(target);
    const onPointerDown = (event: PointerEvent) => {
      if (!isInside(event.target as Node)) setOpen(false);
    };
    const onFocusIn = (event: FocusEvent) => {
      if (!isInside(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false, true);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("focusin", onFocusIn);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, setOpen]);

  const activeItem = activeValue ? items.get(activeValue) : undefined;
  const context = useMemo<MultiSelectContextValue>(
    () => ({
      open,
      setOpen,
      values: value,
      toggle,
      remove,
      query,
      setQuery,
      activeValue,
      setActiveValue,
      moveActive,
      toggleActive,
      registerItem,
      unregisterItem,
      labelFor: (itemValue) => items.get(itemValue)?.label ?? itemValue,
      isVisible: (itemValue) =>
        !listQuery.trim() || visibleValues.has(itemValue),
      visibleCount: visibleItems.length,
      activeItemId: activeItem?.id,
      listId: `${baseId}-list`,
      inputId: `${baseId}-input`,
      disabled,
      reduce,
      triggerRef,
      contentRef,
      inputRef,
      activeLayoutId: `${baseId}-active`,
    }),
    [
      activeItem?.id,
      activeValue,
      baseId,
      disabled,
      items,
      listQuery,
      moveActive,
      open,
      query,
      reduce,
      registerItem,
      remove,
      setActiveValue,
      setOpen,
      toggle,
      toggleActive,
      unregisterItem,
      value,
      visibleItems.length,
      visibleValues,
    ],
  );

  return (
    <MultiSelectContext.Provider value={context}>
      <div ref={rootRef} className={cn("relative w-full", className)}>
        {children}
      </div>
    </MultiSelectContext.Provider>
  );
}

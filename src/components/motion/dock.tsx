"use client";

import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import {
  createContext,
  type ReactNode,
  useContext,
  useId,
  useMemo,
} from "react";
import { cn } from "@/components/ui/cn";
import { SPRING_LAYOUT } from "./lib/ease";

type DockContextValue = {
  pillLayoutId: string;
};

const DockContext = createContext<DockContextValue | null>(null);

interface DockProps {
  children: ReactNode;
  className?: string;
}

// A list of items whose active pill glides between them. Each DockItem is a list item, so a dock
// of links inside a <nav> reads as a list of pages.
export function Dock({ children, className }: DockProps) {
  const pillLayoutId = useId();
  const ctx = useMemo<DockContextValue>(
    () => ({ pillLayoutId }),
    [pillLayoutId],
  );

  return (
    <DockContext.Provider value={ctx}>
      <ul
        className={cn(
          "inline-flex h-auto items-end gap-1.5 rounded-xl border border-border bg-card/80 px-2 py-1 shadow-lg backdrop-blur-xl",
          className,
        )}
      >
        {children}
      </ul>
    </DockContext.Provider>
  );
}

interface DockItemProps {
  children: ReactNode;
  className?: string;
  active?: boolean;
  /** Classes for the gliding pill behind the active item. */
  pillClassName?: string;
}

// One item; its children carry their own link or button and its accessible name.
export function DockItem({
  children,
  className,
  active,
  pillClassName,
}: DockItemProps) {
  const dock = useContext(DockContext);
  const reduce = useReducedMotion();
  const pillLayoutId = dock?.pillLayoutId ?? "dock-pill";

  return (
    <li
      className={cn(
        "relative isolate flex shrink-0 items-center justify-center rounded-lg text-foreground",
        className,
      )}
    >
      {active ? (
        <m.span
          layoutId={pillLayoutId}
          transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
          className={cn(
            "absolute inset-0.5 -z-10 rounded-lg bg-muted/60",
            pillClassName,
          )}
        />
      ) : null}
      {children}
    </li>
  );
}

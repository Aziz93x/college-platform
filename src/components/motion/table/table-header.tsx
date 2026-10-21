"use client";

import { ChevronUp } from "lucide-react";
import * as m from "motion/react-m";
import { cn } from "@/components/ui/cn";
import { EASE_OUT } from "../lib/ease.ts";
import type { SortState, TableColumn } from "./types.ts";
import { alignFlex, alignText } from "./utils.ts";

export interface TableHeaderProps<T> {
  columns: TableColumn<T>[];
  reduce: boolean;
  sort: SortState | null;
  onToggleSort: (key: string) => void;
}

export function TableHeader<T>({
  columns,
  reduce,
  sort,
  onToggleSort,
}: TableHeaderProps<T>) {
  return (
    <thead>
      <tr>
        {columns.map((column) => {
          const active = sort?.key === column.key;
          return (
            <th
              key={column.key}
              scope="col"
              style={column.width ? { width: column.width } : undefined}
              aria-sort={
                active
                  ? sort?.direction === "asc"
                    ? "ascending"
                    : "descending"
                  : undefined
              }
              // The labels in the foreground color: the muted one is too light on the header's fill.
              className={cn(
                "h-12 border-b bg-muted/40 p-0 font-medium text-foreground",
                column.className,
              )}
            >
              {column.sortable ? (
                <button
                  type="button"
                  onClick={() => onToggleSort(column.key)}
                  className={cn(
                    "flex h-12 w-full min-w-0 select-none items-center gap-1 px-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                    alignFlex(column.align),
                  )}
                >
                  <span className="truncate">{column.header}</span>
                  <m.span
                    aria-hidden
                    className="inline-flex shrink-0"
                    animate={{
                      rotate: active && sort?.direction === "desc" ? 180 : 0,
                      opacity: active ? 1 : 0.35,
                    }}
                    transition={
                      reduce
                        ? { duration: 0 }
                        : { duration: 0.18, ease: EASE_OUT }
                    }
                  >
                    <ChevronUp className="size-3.5" />
                  </m.span>
                </button>
              ) : (
                <span
                  className={cn("block truncate px-4", alignText(column.align))}
                >
                  {column.header}
                </span>
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

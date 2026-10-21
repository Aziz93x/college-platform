"use client";

import { useReducedMotion } from "motion/react";
import { cn } from "@/components/ui/cn";
import { TableHeader } from "./table-header.tsx";
import type { TableProps } from "./types.ts";
import { useColumnSort } from "./use-column-sort.ts";
import { alignText, readCell } from "./utils.ts";

export type { TableColumn, TableProps } from "./types.ts";

// BeUI's table with what its first page uses: columns, sorting from a header, and an empty state.
// Selection, a fixed-height scroll area under a sticky header, and virtualized rows join with the
// long lists that need them (people, sections, the audit log). A narrow screen scrolls the table
// sideways inside its frame, never the page.
export function Table<T>({
  data,
  columns,
  getRowId,
  caption,
  sort: sortProp,
  defaultSort = null,
  onSortChange,
  emptyState,
  className,
}: TableProps<T>) {
  const reduce = useReducedMotion();
  const rows = data.map((row, index) => ({ row, id: getRowId(row, index) }));
  const { sort, sortedRows, toggleSort } = useColumnSort({
    rows,
    columns,
    sort: sortProp,
    defaultSort,
    onSortChange,
  });

  return (
    <div
      className={cn(
        "w-full overflow-x-auto rounded-xl border bg-card text-sm",
        className,
      )}
    >
      <table className="w-full border-collapse">
        <caption className="sr-only">{caption}</caption>
        <TableHeader
          columns={columns}
          reduce={!!reduce}
          sort={sort}
          onToggleSort={toggleSort}
        />
        <tbody>
          {sortedRows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="p-10 text-center text-muted-foreground"
              >
                {emptyState}
              </td>
            </tr>
          ) : (
            sortedRows.map(({ row, id }) => (
              <tr
                key={id}
                className="border-border/60 border-b transition-colors last:border-b-0 hover:bg-muted/20"
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "px-4 py-3 align-middle text-foreground",
                      alignText(column.align),
                      column.className,
                    )}
                  >
                    {readCell(row, column)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

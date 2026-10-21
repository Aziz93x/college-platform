import { useCallback, useMemo, useState } from "react";
import type { SortState, TableColumn, TableRow } from "./types.ts";
import { readSortValue } from "./utils.ts";

// Text sorts in the page's language, so Arabic names follow the Arabic alphabet and numbers inside
// names count up. Sorting starts with a press, in the browser: the server keeps the rows' order.
const compareText = (a: string, b: string) =>
  new Intl.Collator(document.documentElement.lang || undefined, {
    numeric: true,
  }).compare(a, b);

export function useColumnSort<T>({
  rows,
  columns,
  sort: sortProp,
  defaultSort = null,
  onSortChange,
}: {
  rows: TableRow<T>[];
  columns: TableColumn<T>[];
  sort?: SortState | null;
  defaultSort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
}) {
  const [internalSort, setInternalSort] = useState<SortState | null>(
    defaultSort,
  );
  const sort = sortProp !== undefined ? sortProp : internalSort;

  const commit = useCallback(
    (next: SortState | null) => {
      if (sortProp === undefined) setInternalSort(next);
      onSortChange?.(next);
    },
    [sortProp, onSortChange],
  );

  // Ascending, descending, then back to the rows' own order.
  const toggleSort = useCallback(
    (key: string) => {
      if (!sort || sort.key !== key) {
        commit({ key, direction: "asc" });
      } else if (sort.direction === "asc") {
        commit({ key, direction: "desc" });
      } else {
        commit(null);
      }
    },
    [sort, commit],
  );

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = readSortValue(a.row, column);
      const bv = readSortValue(b.row, column);
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : compareText(String(av), String(bv));
      return sort.direction === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sort, columns]);

  return { sort, sortedRows, toggleSort };
}

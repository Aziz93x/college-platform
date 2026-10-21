import type { ReactNode } from "react";

type SortDirection = "asc" | "desc";

export type SortState = {
  key: string;
  direction: SortDirection;
};

export type TableColumn<T> = {
  /** Stable key; also the row property read for the cell and its sort value. */
  key: string;
  /** Header content. */
  header: ReactNode;
  /** A press on the header sorts by this column. */
  sortable?: boolean;
  /** Cell alignment along the reading direction. */
  align?: "start" | "center" | "end";
  /** Header width as a CSS length; omitted, the column takes what its content needs. */
  width?: string;
  /** Classes for the column's header and cells, such as hiding the column on a phone. */
  className?: string;
  /** Custom cell renderer. Falls back to `row[key]`. */
  cell?: (row: T) => ReactNode;
  /** Value used for sorting. Falls back to `row[key]`. */
  sortValue?: (row: T) => string | number;
};

export interface TableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  /** A stable id per row, so a sort keeps each row's state with its row. */
  getRowId: (row: T, index: number) => string;
  /** The table's accessible name. */
  caption: string;
  sort?: SortState | null;
  defaultSort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
  /** Shown in place of the rows when there are none; a caller that draws its own leaves it out. */
  emptyState?: ReactNode;
  className?: string;
}

/** A data row paired with its stable id. */
export type TableRow<T> = { row: T; id: string };

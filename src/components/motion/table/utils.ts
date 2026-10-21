import type { ReactNode } from "react";
import type { TableColumn } from "./types.ts";

export function alignFlex(align: TableColumn<unknown>["align"]) {
  if (align === "end") return "justify-end";
  if (align === "center") return "justify-center";
  return "justify-start";
}

export function alignText(align: TableColumn<unknown>["align"]) {
  if (align === "end") return "text-end";
  if (align === "center") return "text-center";
  return "text-start";
}

export function readCell<T>(row: T, column: TableColumn<T>): ReactNode {
  if (column.cell) return column.cell(row);
  return (row as Record<string, ReactNode>)[column.key];
}

export function readSortValue<T>(
  row: T,
  column: TableColumn<T>,
): string | number {
  if (column.sortValue) return column.sortValue(row);
  return (row as Record<string, string | number>)[column.key];
}

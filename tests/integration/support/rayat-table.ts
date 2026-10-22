import { rayatColumns, rayatHeaders } from "../../../db/seed/rayat-columns.ts";
import type { RayatKind } from "../../../src/modules/rayat/index.ts";

// A report as Rayat exports it: its header row, then each row's columns read, by field, and the
// others, by header.
export function rayatTable<K extends RayatKind>(
  kind: K,
  rows: Partial<Record<keyof (typeof rayatColumns)[K], string>>[],
  dropped: Record<string, string>[] = [],
) {
  const columns = rayatColumns[kind] as Record<string, string>;
  return [
    rayatHeaders[kind],
    ...rows.map((row, at) =>
      rayatHeaders[kind].map((header) => {
        const field = Object.keys(columns).find(
          (name) => columns[name] === header,
        );
        return field
          ? ((row as Record<string, string>)[field] ?? "")
          : (dropped[at]?.[header] ?? "");
      }),
    ),
  ];
}

import { foldCase, oneLine } from "../../../platform/validation/text.ts";
import { type RayatField, type RayatKind, rayatFields } from "./reports.ts";

// A report's row as the platform reads it: the fields it keeps, each as tidied text, and its line
// in the file, so that its problems point to it.
export type RayatRow<K extends RayatKind = RayatKind> = {
  line: number;
  values: Record<RayatField<K>, string>;
};

export type RayatFile<K extends RayatKind = RayatKind> =
  | { status: "read"; rows: RayatRow<K>[] }
  | { status: "empty" }
  | { status: "missingColumns"; missing: RayatField<K>[] };

// How far down a title or a date above the header row may push it.
const HEADER_SEARCH = 20;

const key = (text: string) => foldCase(oneLine(text));

// A report's rows under its header row: of its first rows, the one that names the most of the
// fields, by the column map's header for each, in any spacing and any case of its Latin letters.
// Only the cells of those columns are read; every other column is dropped here. Rows with nothing
// in them are skipped.
export function readRayatFile<K extends RayatKind>(
  kind: K,
  table: readonly (readonly string[])[],
  columns: Readonly<Record<RayatField<K>, string>>,
): RayatFile<K> {
  const fields = rayatFields[kind] as readonly RayatField<K>[];
  const filled = (row: readonly string[]) =>
    row.some((cell) => cell.trim() !== "");
  const headers = fields.map((field) => key(columns[field]));
  const named = (row: readonly string[]) => {
    const cells = row.map(key);
    return headers.map((header) => cells.indexOf(header));
  };
  let start = -1;
  let index: number[] = [];
  for (const [line, row] of table.slice(0, HEADER_SEARCH).entries()) {
    const found = named(row);
    const count = found.filter((at) => at >= 0).length;
    if (count > index.filter((at) => at >= 0).length) {
      start = line;
      index = found;
    }
  }
  if (start < 0) {
    return table.some(filled)
      ? { status: "missingColumns", missing: [...fields] }
      : { status: "empty" };
  }
  const missing = fields.filter((_, at) => index[at] < 0);
  if (missing.length > 0) return { status: "missingColumns", missing };

  const rows: RayatRow<K>[] = [];
  for (const [offset, cells] of table.slice(start + 1).entries()) {
    if (!filled(cells)) continue;
    const values = {} as Record<RayatField<K>, string>;
    for (const [at, field] of fields.entries()) {
      values[field] = oneLine(cells[index[at]] ?? "");
    }
    rows.push({ line: start + offset + 2, values });
  }
  return rows.length === 0 ? { status: "empty" } : { status: "read", rows };
}

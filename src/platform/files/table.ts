import { inflateRawSync } from "node:zlib";
import Papa from "papaparse";
import { readSheet } from "read-excel-file/node";

// How far an XLSX file may inflate, all its archive's entries together. A college's largest Rayat
// report, an SF01 of 25,000 rows, inflates to about 17 MB; a file made to inflate far past its size
// is refused before the reader holds it in memory (lead review C).
export const MAX_INFLATED_BYTES = 50 * 1024 * 1024;

// Whether a ZIP archive inflates within a budget, read as the workbook's reader reads it: record
// after record from the first byte, each entry ended by its own header's size, or by the data
// descriptor after it, so an entry the central directory leaves out counts too (the platform-wide
// check). Each entry is inflated in turn and counted, not taken at the size the archive declares;
// the inflated bytes are dropped.
const DESCRIPTOR = Buffer.from([0x50, 0x4b, 0x07, 0x08]);
function inflatesWithin(bytes: Uint8Array, budget: number) {
  const zip = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (at: number) =>
    at + 2 <= zip.length ? zip.readUInt16LE(at) : -1;
  const u32 = (at: number) =>
    at + 4 <= zip.length ? zip.readUInt32LE(at) : -1;
  let left = budget;
  for (let at = 0; ; ) {
    const signature = u32(at);
    // The end of the central directory, as the reader stops there.
    if (signature === 0x06054b50) return true;
    // An entry of the central directory, which the reader passes over.
    if (signature === 0x02014b50) {
      at += 46 + u16(at + 28) + u16(at + 30) + u16(at + 32);
      continue;
    }
    if (signature !== 0x04034b50) return false;
    const method = u16(at + 8);
    const size = u32(at + 18);
    if (method !== 0 && method !== 8) return false;
    if (size === 0xffffffff || u32(at + 22) === 0xffffffff) return false;
    const start = at + 30 + u16(at + 26) + u16(at + 28);
    const sized = !(u16(at + 6) & 0x08) || size > 0;
    const stop = sized ? start + size : zip.indexOf(DESCRIPTOR, start);
    if (stop < start || stop > zip.length) return false;
    const body = zip.subarray(start, stop);
    try {
      left -=
        method === 0
          ? body.length
          : inflateRawSync(body, { maxOutputLength: Math.max(left, 1) }).length;
    } catch {
      return false;
    }
    if (left < 0) return false;
    at = sized ? stop : stop + 16;
  }
}

// The cells of an uploaded table as text, row by row: the first sheet of an XLSX workbook, or a CSV
// file. Excel saves "CSV UTF-8", or, on an Arabic Windows, "CSV" in the Windows-1256 code page, so
// text that is not UTF-8 is read in that one. Undefined for any other file, one that cannot be read,
// and a workbook that inflates past MAX_INFLATED_BYTES.
export async function readTable(file: {
  name: string;
  bytes: Uint8Array;
}): Promise<string[][] | undefined> {
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension === "xlsx") {
    if (!inflatesWithin(file.bytes, MAX_INFLATED_BYTES)) return undefined;
    try {
      const rows = await readSheet(Buffer.from(file.bytes));
      return rows.map((row) =>
        row.map((cell) => (cell === null ? "" : String(cell))),
      );
    } catch {
      return undefined;
    }
  }
  if (extension === "csv") {
    const { data } = Papa.parse<string[]>(decode(file.bytes), {
      skipEmptyLines: "greedy",
    });
    return data;
  }
  return undefined;
}

function decode(bytes: Uint8Array) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1256").decode(bytes);
  }
}

// Rows as CSV lines, each ended by CRLF as Excel writes them. A cell a spreadsheet would read as a
// formula (=, +, -, @, a tab or a return first) gets a ' before it, so it shows as the text people
// typed. Its first character alone decides, as Papa's own pattern misses a cell with a line break.
const FORMULA = /^[=+\-@\t\r]/;
export function csvLines(rows: string[][]) {
  return rows.length === 0
    ? ""
    : `${Papa.unparse(rows, { escapeFormulae: FORMULA, newline: "\r\n" })}\r\n`;
}

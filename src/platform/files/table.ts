import { inflateRawSync } from "node:zlib";
import Papa from "papaparse";
import { readSheet } from "read-excel-file/node";

// How far an XLSX file may inflate, all its archive's entries together. A college's largest Rayat
// report, an SF01 of 25,000 rows, inflates to about 17 MB; a file made to inflate far past its size
// is refused before the reader holds it in memory (lead review C).
export const MAX_INFLATED_BYTES = 50 * 1024 * 1024;

// Whether a ZIP archive inflates within a budget. Each entry is inflated in turn and counted, not
// taken at the size the archive declares; the inflated bytes are dropped.
function inflatesWithin(bytes: Uint8Array, budget: number) {
  const zip = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (at: number) =>
    at + 2 <= zip.length ? zip.readUInt16LE(at) : -1;
  const u32 = (at: number) =>
    at + 4 <= zip.length ? zip.readUInt32LE(at) : -1;
  // The end of the central directory, within its comment's 64 KiB of the file's end.
  let end = zip.length - 22;
  while (end >= Math.max(0, zip.length - 65_557) && u32(end) !== 0x06054b50) {
    end -= 1;
  }
  if (end < 0 || u32(end) !== 0x06054b50) return false;
  let left = budget;
  let entry = u32(end + 16);
  for (let count = u16(end + 10); count > 0; count--) {
    if (u32(entry) !== 0x02014b50) return false;
    const local = u32(entry + 42);
    if (u32(local) !== 0x04034b50) return false;
    const start = local + 30 + u16(local + 26) + u16(local + 28);
    const body = zip.subarray(start, start + u32(entry + 20));
    const method = u16(entry + 10);
    if (method !== 0 && method !== 8) return false;
    try {
      left -=
        method === 0
          ? body.length
          : inflateRawSync(body, { maxOutputLength: Math.max(left, 1) }).length;
    } catch {
      return false;
    }
    if (left < 0) return false;
    entry += 46 + u16(entry + 28) + u16(entry + 30) + u16(entry + 32);
  }
  return true;
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
// typed.
export function csvLines(rows: string[][]) {
  return rows.length === 0
    ? ""
    : `${Papa.unparse(rows, { escapeFormulae: true, newline: "\r\n" })}\r\n`;
}

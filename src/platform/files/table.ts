import Papa from "papaparse";
import { readSheet } from "read-excel-file/node";

// The cells of an uploaded table as text, row by row: the first sheet of an XLSX workbook, or a CSV
// file. Excel saves "CSV UTF-8", or, on an Arabic Windows, "CSV" in the Windows-1256 code page, so
// text that is not UTF-8 is read in that one. Undefined for any other file, or one that cannot be read.
export async function readTable(file: {
  name: string;
  bytes: Uint8Array;
}): Promise<string[][] | undefined> {
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension === "xlsx") {
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

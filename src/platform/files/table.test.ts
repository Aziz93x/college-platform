import { describe, expect, it } from "vitest";
import writeXlsxFile from "write-excel-file/node";
import { readTable } from "./table.ts";

const header = ["employee", "name"];

describe("readTable", () => {
  it("reads the first sheet of a workbook as text, numbers included", async () => {
    const bytes = await writeXlsxFile([
      header.map((value) => ({ value })),
      [{ value: 200101, type: Number }, { value: "Sara" }],
      [{ value: "200102" }, null],
    ]).toBuffer();
    expect(await readTable({ name: "People.XLSX", bytes })).toEqual([
      header,
      ["200101", "Sara"],
      ["200102", ""],
    ]);
  });

  it("reads a CSV in UTF-8, with its byte order mark, quotes and empty lines", async () => {
    const text = '﻿employee,name\n200101,"Sara, the second"\n\n';
    const bytes = new TextEncoder().encode(text);
    expect(await readTable({ name: "people.csv", bytes })).toEqual([
      header,
      ["200101", "Sara, the second"],
    ]);
  });

  it("reads a CSV that Arabic Excel saved in Windows-1256", async () => {
    // The Arabic letter beh (U+0628) is 0xC8 in Windows-1256, which is no UTF-8 on its own.
    const bytes = Uint8Array.from([
      ...new TextEncoder().encode("employee,name\n200101,"),
      0xc8,
    ]);
    expect(await readTable({ name: "people.csv", bytes })).toEqual([
      header,
      ["200101", "ب"],
    ]);
  });

  it("reads no other kind of file, and no file that is not what its name says", async () => {
    const bytes = new TextEncoder().encode("employee,name");
    expect(await readTable({ name: "people.txt", bytes })).toBeUndefined();
    expect(await readTable({ name: "people.xlsx", bytes })).toBeUndefined();
  });
});

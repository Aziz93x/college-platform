import { crc32, deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import writeXlsxFile from "write-excel-file/node";
import { csvLines, MAX_INFLATED_BYTES, readTable } from "./table.ts";

type Entry = [name: string, data: Buffer];

// A ZIP archive of deflated entries, each header declaring the size the entry gives, or `declared`;
// the `unlisted` entries follow them, left out of the central directory.
function zipOf(entries: Entry[], declared?: number, unlisted: Entry[] = []) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [index, [name, data]] of [...entries, ...unlisted].entries()) {
    const body = deflateRawSync(data, { level: 9 });
    const file = Buffer.from(name);
    const size = declared ?? data.length;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc32(data), 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(file.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc32(data), 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(file.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, file, body);
    if (index < entries.length) centrals.push(central, file);
    offset += local.length + file.length + body.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const xml = (text: string) =>
  Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>${text}`);
const main = "http://schemas.openxmlformats.org";
// A workbook's parts but its sheet.
const parts: Entry[] = [
  [
    "[Content_Types].xml",
    xml(
      `<Types xmlns="${main}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    ),
  ],
  [
    "_rels/.rels",
    xml(
      `<Relationships xmlns="${main}/package/2006/relationships"><Relationship Id="rId1" Type="${main}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
  ],
  [
    "xl/workbook.xml",
    xml(
      `<workbook xmlns="${main}/spreadsheetml/2006/main" xmlns:r="${main}/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ),
  ],
  [
    "xl/_rels/workbook.xml.rels",
    xml(
      `<Relationships xmlns="${main}/package/2006/relationships"><Relationship Id="rId1" Type="${main}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    ),
  ],
];

// The workbook's sheet: `rows` rows, each of one cell that holds `bytes` of one letter.
function sheetOf(rows: number, bytes: number): Entry {
  const cell = Buffer.alloc(bytes, "a");
  return [
    "xl/worksheets/sheet1.xml",
    Buffer.concat([
      xml(`<worksheet xmlns="${main}/spreadsheetml/2006/main"><sheetData>`),
      ...Array.from({ length: rows }, (_, row) =>
        Buffer.concat([
          Buffer.from(
            `<row r="${row + 1}"><c r="A${row + 1}" t="inlineStr"><is><t>`,
          ),
          cell,
          Buffer.from("</t></is></c></row>"),
        ]),
      ),
      Buffer.from("</sheetData></worksheet>"),
    ]),
  ];
}

// A workbook of one sheet whose one cell holds `bytes` of one letter.
function workbookOf(bytes: number, declared?: number) {
  return zipOf([...parts, sheetOf(1, bytes)], declared);
}

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

  it("reads a workbook that inflates within the budget, and refuses one that inflates past it, whatever size it declares (lead review C)", async () => {
    expect(
      await readTable({ name: "ss01.xlsx", bytes: workbookOf(3) }),
    ).toEqual([["aaa"]]);
    const past = workbookOf(MAX_INFLATED_BYTES);
    expect(past.length).toBeLessThan(1_000_000);
    expect(await readTable({ name: "ss01.xlsx", bytes: past })).toBeUndefined();
    expect(
      await readTable({
        name: "ss01.xlsx",
        bytes: workbookOf(MAX_INFLATED_BYTES, 1000),
      }),
    ).toBeUndefined();
  });

  it("refuses a workbook whose sheet that inflates past the budget follows the listed ones unlisted, as the reader keeps it (the platform-wide check)", async () => {
    // About 60 MB of cells in some 80 KB, behind a sheet of one cell that the directory lists.
    const bytes = zipOf([...parts, sheetOf(1, 3)], undefined, [
      sheetOf(2000, 30_000),
    ]);
    expect(bytes.length).toBeLessThan(100_000);
    expect(await readTable({ name: "ss01.xlsx", bytes })).toBeUndefined();
  });

  it("reads no other kind of file, and no file that is not what its name says", async () => {
    const bytes = new TextEncoder().encode("employee,name");
    expect(await readTable({ name: "people.txt", bytes })).toBeUndefined();
    expect(await readTable({ name: "people.xlsx", bytes })).toBeUndefined();
  });
});

it("csvLines quotes what needs it and keeps formulas as text", () => {
  expect(
    csvLines([
      ["a", "b,c"],
      ['say "hi"', "=HYPERLINK(1)"],
      ["-5", "line\nbreak"],
    ]),
  ).toBe(
    'a,"b,c"\r\n"say ""hi""","\'=HYPERLINK(1)"\r\n"\'-5","line\nbreak"\r\n',
  );
  // A formula whose cell also breaks a line (the platform-wide check).
  expect(csvLines([["=HYPERLINK(1)\nmore", "@SUM(1)\r\n"]])).toBe(
    '"\'=HYPERLINK(1)\nmore","\'@SUM(1)\r\n"\r\n',
  );
  expect(csvLines([])).toBe("");
});

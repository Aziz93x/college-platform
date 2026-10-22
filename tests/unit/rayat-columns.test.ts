import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { rayatColumns, rayatHeaders } from "../../db/seed/rayat-columns.ts";
import {
  rayatFields,
  rayatKinds,
  readRayatFile,
} from "../../src/modules/rayat/index.ts";
import { settingsRegistry } from "../../src/modules/settings/index.ts";
import { readTable } from "../../src/platform/files/table.ts";

// The header-only fixtures: each report's header row as Rayat exports it (docs/PLAN.md, section 9).
const fixture = (kind: string) =>
  readTable({
    name: `${kind}.csv`,
    bytes: readFileSync(
      new URL(`../fixtures/rayat/${kind}.csv`, import.meta.url),
    ),
  });

describe.each(rayatKinds)("the %s column map", (kind) => {
  const setting = settingsRegistry[`rayat.columns.${kind}`];

  it("has a header for each field the import reads, and the base seed's passes its schema", () => {
    expect(Object.keys(setting.schema.unwrap().shape)).toEqual([
      ...rayatFields[kind],
    ]);
    expect(setting.schema.safeParse(rayatColumns[kind]).success).toBe(true);
  });

  it("finds every column it names in Rayat's header row", async () => {
    const table = await fixture(kind);
    expect(table).toBeDefined();
    expect(
      readRayatFile(kind, table ?? [], rayatColumns[kind] as never),
    ).toEqual({ status: "empty" });
  });
});

it.each(
  rayatKinds,
)("keeps the %s fixture's header row as the demo files write it", async (kind) => {
  expect((await fixture(kind))?.[0]).toEqual(rayatHeaders[kind]);
});

it("holds every column of Rayat's original SS01 and SF01 exports", () => {
  expect(rayatHeaders.ss01).toHaveLength(31);
  expect(rayatHeaders.sf01).toHaveLength(20);
});

it("refuses a column map that gives two columns one header", () => {
  const schema = settingsRegistry["rayat.columns.sf01"].schema;
  expect(
    schema.safeParse({ ...rayatColumns.sf01, traineeStatus: " حالة  تسجيل " })
      .success,
  ).toBe(false);
});

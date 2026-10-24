import { createTranslator } from "next-intl";
import { expect, it } from "vitest";
import messages from "../../messages/ar.json" with { type: "json" };
import {
  type ReadinessRow,
  type RowCatalog,
  rowWords,
} from "../../src/modules/readiness/index.ts";
import { settingsRegistry } from "../../src/modules/settings/index.ts";

// The board's rows named from the catalog itself, a missing message failing the test: the board,
// the console and a reminder all name a row by these (lead review D, proposal 5).
const locale = `ar-u-nu-${settingsRegistry["locale.digits"].default}`;
const strict = (namespace: "readiness" | "rayat") => {
  const t = createTranslator({
    locale,
    messages,
    namespace,
    onError: (error) => {
      throw error;
    },
  });
  return (key: string, values?: Record<string, string | number>) =>
    t(key as never, values as never);
};
const list = new Intl.ListFormat(locale);
const catalog: RowCatalog = {
  readiness: strict("readiness"),
  rayat: strict("rayat"),
  list: (items) => list.format(items),
};
const t = catalog.readiness;
const owned = { owners: [], href: "/" };

it("names every row of the board, in each of its states, from the catalog", () => {
  const rows: ReadinessRow[] = [
    { id: "term", status: "draft", state: "open", ...owned },
    { id: "term", status: "active", state: "done", ...owned },
    { id: "framework", state: "open", ...owned },
    { id: "framework", state: "done", ...owned },
    {
      id: "people",
      lacking: ["الكهرباء", "الميكانيكا"],
      state: "open",
      ...owned,
    },
    { id: "people", lacking: [], state: "done", ...owned },
    { id: "rayat", missing: ["ss01", "sf01"], state: "open", ...owned },
    { id: "rayat", missing: [], state: "done", ...owned },
    {
      id: "matched",
      unmatched: 0,
      disabled: 0,
      imported: false,
      state: "open",
      ...owned,
    },
    {
      id: "matched",
      unmatched: 0,
      disabled: 0,
      imported: true,
      state: "done",
      ...owned,
    },
    { id: "tasks", run: null, state: "open", ...owned },
    { id: "tasks", run: "failed", state: "open", ...owned },
    {
      id: "plan",
      departmentId: "d",
      department: "الكهرباء",
      state: "open",
      ...owned,
    },
    {
      id: "plan",
      departmentId: "d",
      department: "الكهرباء",
      state: "done",
      ...owned,
    },
  ];
  for (const row of rows) {
    const { title, detail } = rowWords(row, catalog);
    expect(title, row.id).not.toBe("");
    expect(detail, row.id).not.toBe("");
  }
});

it("says what an open matched row waits on: trainers to add, accounts to enable, or both", () => {
  const matched = (unmatched: number, disabled: number) =>
    rowWords(
      {
        id: "matched",
        unmatched,
        disabled,
        imported: true,
        state: "open",
        ...owned,
      },
      catalog,
    ).detail;
  const add = t("rows.matched.open", { count: 2 });
  const enable = t("rows.matched.disabled", { count: 1 });
  expect(matched(2, 0)).toBe(add);
  expect(matched(0, 1)).toBe(enable);
  expect(matched(2, 1)).toBe(list.format([add, enable]));
});

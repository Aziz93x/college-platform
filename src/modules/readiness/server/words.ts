import type { ReadinessRow } from "./board.ts";

// A message of the catalog by its key under a namespace, filled with values.
type Translate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

// The catalog's words the board's rows are named with: its own (readiness.*), Rayat's report titles
// (rayat.*), and a list in the reader's language.
export type RowCatalog = {
  readiness: Translate;
  rayat: Translate;
  list: (items: string[]) => string;
};

// A row's title and what it waits on, as the board words them (Step 22), the console lists them and
// a reminder names them (lead review D, proposal 5).
export function rowWords(
  row: ReadinessRow,
  { readiness: t, rayat, list }: RowCatalog,
) {
  switch (row.id) {
    case "term":
      return {
        title: t("rows.term.title"),
        detail: t("rows.term.detail", { status: row.status }),
      };
    case "people":
      return {
        title: t("rows.people.title"),
        detail:
          row.state === "done"
            ? t("rows.people.done")
            : t("rows.people.open", { departments: list(row.lacking) }),
      };
    case "rayat":
      return {
        title: t("rows.rayat.title"),
        detail:
          row.state === "done"
            ? t("rows.rayat.done")
            : t("rows.rayat.open", {
                reports: list(
                  row.missing.map((kind) => rayat(`reports.${kind}.title`)),
                ),
              }),
      };
    case "matched":
      return {
        title: t("rows.matched.title"),
        detail: !row.imported
          ? t("rows.matched.waiting")
          : row.state === "done"
            ? t("rows.matched.done")
            : list([
                ...(row.unmatched > 0
                  ? [t("rows.matched.open", { count: row.unmatched })]
                  : []),
                ...(row.disabled > 0
                  ? [t("rows.matched.disabled", { count: row.disabled })]
                  : []),
              ]),
      };
    case "tasks":
      return {
        title: t("rows.tasks.title"),
        detail: t("rows.tasks.detail", { run: row.run ?? "none" }),
      };
    case "plan":
      return {
        title: t("rows.plan.title", { department: row.department }),
        detail:
          row.state === "done" ? t("rows.plan.done") : t("rows.plan.open"),
      };
    case "framework":
      return {
        title: t("rows.framework.title"),
        detail:
          row.state === "done"
            ? t("rows.framework.done")
            : t("rows.framework.open"),
      };
  }
}

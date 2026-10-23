import { expect, it } from "vitest";
import { applyTexts, type Catalog, checkText, flatten } from "./catalog.ts";

const catalog: Catalog = {
  nav: { today: "اليوم", people: "المنسوبون" },
  plan: { impact: "{tasks, plural, one {مهمة} other {# مهام}}" },
};

it("lists every message by its dotted key, in the catalog's order", () => {
  expect(flatten(catalog)).toEqual([
    { key: "nav.today", value: "اليوم" },
    { key: "nav.people", value: "المنسوبون" },
    { key: "plan.impact", value: "{tasks, plural, one {مهمة} other {# مهام}}" },
  ]);
});

it("lays a college's wording over the catalog, leaving it and any key it no longer has", () => {
  const changed = applyTexts(catalog, [
    { key: "nav.today", value: "يومي" },
    { key: "nav.gone", value: "لا شيء" },
    { key: "nav", value: "ليس رسالة" },
  ]);
  expect(changed).toEqual({
    nav: { today: "يومي", people: "المنسوبون" },
    plan: catalog.plan,
  });
  expect(catalog.nav).toEqual({ today: "اليوم", people: "المنسوبون" });
  // Only the branch it changed is new.
  expect(changed.plan).toBe(catalog.plan);
});

it("leaves a list out, and as it is", () => {
  const rows: Catalog = { design: { title: "التصميم", rows: [["أ", "1"]] } };
  expect(flatten(rows)).toEqual([{ key: "design.title", value: "التصميم" }]);
  expect(applyTexts(rows, [{ key: "design.rows.0.0", value: "ب" }])).toEqual(
    rows,
  );
});

it.each([
  ["", "empty"],
  ["   ", "empty"],
  ["{tasks, plural, one {مهمة}", "syntax"],
  ["{tasks, plural, one {مهمة}}", "syntax"],
  ["مهام كثيرة", "arguments"],
  ["{count, plural, one {مهمة} other {# مهام}}", "arguments"],
  ["{tasks, plural, one {مهمة} other {# مهام لـ{name}}}", "arguments"],
] as const)("refuses %j: %s", (value, problem) => {
  expect(checkText(value, "{tasks, plural, one {مهمة} other {# مهام}}")).toBe(
    problem,
  );
});

it("takes other words with the default's arguments and tags", () => {
  expect(
    checkText(
      "{tasks, plural, =0 {لا مهام} one {مهمة واحدة} other {# من المهام}}",
      "{tasks, plural, one {مهمة} other {# مهام}}",
    ),
  ).toBeUndefined();
  expect(checkText("<b>{name}</b> أضاف", "أضاف <b>{name}</b>")).toBeUndefined();
  expect(checkText("أضاف {name}", "أضاف <b>{name}</b>")).toBe("arguments");
});

import { expect, it } from "vitest";
import { notificationKindKeys, notificationPage } from "./kinds.ts";

it("opens each kind's own page, and a reminder of the board its row's (lead review D, proposal 5)", () => {
  expect(notificationPage("quickRequest", {})).toBe("/today");
  expect(notificationPage("transferConflict", {})).toBe("/sections");
  expect(
    notificationPage("readinessReminder", {
      title: "مطابقة مدربي رايات بحساباتهم",
      detail: "",
      from: "",
      href: "/rayat",
    }),
  ).toBe("/rayat");
  for (const kind of notificationKindKeys) {
    expect(notificationPage(kind, { href: "/rayat" }), kind).toMatch(/^\//);
  }
});

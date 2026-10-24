import { expect, it } from "vitest";
import { notificationKindKeys, notificationPage } from "./kinds.ts";

it("opens each kind's own page, and a reminder of the board its row's on its term (lead review D, proposal 5)", () => {
  expect(notificationPage("quickRequest", {})).toBe("/today");
  expect(notificationPage("transferConflict", {})).toBe("/sections");
  expect(
    notificationPage("readinessReminder", {
      title: "خطة التقنية الكهربائية",
      detail: "",
      from: "",
      href: "/plan?department=electrical",
      termId: "next",
      term: "الفصل التدريبي الثاني 1448",
    }),
  ).toBe("/switch-term/next?next=%2Fplan%3Fdepartment%3Delectrical");
  for (const kind of notificationKindKeys) {
    expect(notificationPage(kind, { href: "/rayat" }), kind).toMatch(/^\//);
  }
});

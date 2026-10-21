import { CalendarCheck } from "lucide-react";
import { describe, expect, it } from "vitest";
import {
  isCurrent,
  type NavigationItem,
  navigation,
  orderFor,
  phoneTabs,
  visibleNavigation,
} from "./navigation.ts";

// A fixture registry: one open page and pages behind three permission keys.
const registry = [
  { id: "today", href: "/today", icon: CalendarCheck },
  {
    id: "plan",
    href: "/plan",
    icon: CalendarCheck,
    permission: "plan.edit",
  },
  {
    id: "review",
    href: "/review",
    icon: CalendarCheck,
    permission: "review.decide",
  },
  {
    id: "settings",
    href: "/settings",
    icon: CalendarCheck,
    permission: "settings.edit",
  },
] satisfies NavigationItem<string>[];

const ids = (items: readonly { id: string }[]) => items.map(({ id }) => id);

describe("visibleNavigation", () => {
  it.each([
    ["no permission", [], ["today"]],
    [
      "a head's keys",
      ["plan.edit", "review.decide"],
      ["today", "plan", "review"],
    ],
    ["an admin's key", ["settings.edit"], ["today", "settings"]],
    [
      "every key",
      ["plan.edit", "review.decide", "settings.edit"],
      ["today", "plan", "review", "settings"],
    ],
    ["a key no page needs", ["task.complete"], ["today"]],
  ])("shows the pages %s opens", (_name, keys, expected) => {
    expect(ids(visibleNavigation(registry, new Set(keys)))).toEqual(expected);
  });

  it("follows the given order, and pages it leaves out keep the registry's order after it", () => {
    const keys = new Set(["plan.edit", "review.decide", "settings.edit"]);
    expect(ids(visibleNavigation(registry, keys, ["review", "today"]))).toEqual(
      ["review", "today", "plan", "settings"],
    );
  });

  it("ignores ids in the order that are not visible or not pages", () => {
    expect(
      ids(
        visibleNavigation(registry, new Set(), ["settings", "gone", "today"]),
      ),
    ).toEqual(["today"]);
  });

  it("opens today's page to everyone in the real registry", () => {
    expect(ids(visibleNavigation(navigation, new Set()))).toEqual(["today"]);
  });
});

describe("orderFor", () => {
  const orders = { trainer: ["today"], head: ["review", "plan"] };

  it("takes the order of the first role that has one", () => {
    expect(orderFor(["secretary", "head", "trainer"], orders)).toEqual([
      "review",
      "plan",
    ]);
  });

  it("gives no order when no role has one, or for inherited object keys", () => {
    expect(orderFor([], orders)).toEqual([]);
    expect(orderFor(["secretary"], orders)).toEqual([]);
    expect(orderFor(["constructor", "toString"], orders)).toEqual([]);
  });
});

describe("phoneTabs", () => {
  const pages = (count: number) =>
    Array.from({ length: count }, (_, index) => `page-${index + 1}`);

  it.each([1, 4, 5])("keeps %i pages as tabs", (count) => {
    expect(phoneTabs(pages(count))).toEqual({ tabs: pages(count), more: [] });
  });

  it("keeps four tabs and moves the rest to the sheet beyond five", () => {
    const { tabs, more } = phoneTabs(pages(7));
    expect(tabs).toEqual(pages(4));
    expect(more).toEqual(["page-5", "page-6", "page-7"]);
  });
});

describe("isCurrent", () => {
  it.each([
    ["/today", "/today", true],
    ["/today/week", "/today", true],
    ["/todays", "/today", false],
    ["/", "/today", false],
  ])("%s is under %s: %s", (pathname, href, expected) => {
    expect(isCurrent(pathname, href)).toBe(expected);
  });
});

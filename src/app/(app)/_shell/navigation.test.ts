import { CalendarCheck } from "lucide-react";
import { describe, expect, it } from "vitest";
import {
  type SettingKey,
  settingControl,
  settingsRegistry,
} from "@/modules/settings";
import {
  isCurrent,
  type NavigationItem,
  navigation,
  orderFor,
  phoneTabs,
  tabSlots,
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
  {
    id: "people",
    href: "/people",
    icon: CalendarCheck,
    permission: ["people.manage", "accounts.resetPassword"],
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
      "one of a page's several keys",
      ["accounts.resetPassword"],
      ["today", "people"],
    ],
    [
      "every key",
      ["plan.edit", "review.decide", "settings.edit", "people.manage"],
      ["today", "plan", "review", "settings", "people"],
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

  it("opens today's page and the term's framework to everyone in the real registry, and the departments, the roles and the settings to whoever manages them", () => {
    expect(ids(visibleNavigation(navigation, new Set()))).toEqual([
      "today",
      "framework",
    ]);
    expect(
      ids(visibleNavigation(navigation, new Set(["settings.manage"]))),
    ).toEqual(["today", "settings", "framework"]);
    expect(
      ids(
        visibleNavigation(
          navigation,
          new Set(["departments.manage", "roles.manage", "settings.manage"]),
        ),
      ),
    ).toEqual(["today", "departments", "roles", "settings", "framework"]);
  });
});

// The settings page shows each setting with a control to whoever holds the key that edits it (Step
// 13 gave the vice-dean how a term's weeks are counted), so its item opens for every one of those
// keys. The page order, edited on a role's page, has no control there.
it("opens the settings page for every key that edits a setting it shows", () => {
  const settings = navigation.find(({ id }) => id === "settings");
  const shown = (Object.keys(settingsRegistry) as SettingKey[]).filter((key) =>
    settingControl(key),
  );
  for (const permission of shown.map(
    (key) => settingsRegistry[key].permission,
  )) {
    expect(
      visibleNavigation(navigation, new Set([permission])).map(({ id }) => id),
      permission,
    ).toContain(settings?.id);
  }
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

  it("keeps fewer tabs in a narrower bar", () => {
    expect(phoneTabs(pages(5), 3)).toEqual({
      tabs: pages(2),
      more: ["page-3", "page-4", "page-5"],
    });
    expect(phoneTabs(pages(3), 3)).toEqual({ tabs: pages(3), more: [] });
  });
});

describe("tabSlots", () => {
  it.each([
    // A 390 px phone, a 320 px one, and both at 200% text (195 and 160 CSS px), less the bar's
    // 12 px from each edge of the screen.
    [366, 5],
    [296, 5],
    [171, 3],
    [136, 2],
    // Exactly four 44 px tabs, and a pixel short of them.
    [202, 4],
    [201, 3],
    // The bar is hidden on a desktop.
    [0, 5],
  ])("a %i px bar holds %i targets", (width, slots) => {
    expect(tabSlots(width)).toBe(slots);
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

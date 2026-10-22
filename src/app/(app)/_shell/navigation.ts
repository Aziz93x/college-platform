import {
  Building2,
  CalendarCheck,
  CalendarRange,
  Contact,
  History,
  Layers,
  type LucideIcon,
  Megaphone,
  Settings,
  UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";
import type { PermissionKey } from "@/modules/access";

// The sidebar's groups of pages, each under its label nav.groups.<id>; a page in none stands above
// them.
const navigationGroups = ["administration"] as const;
export type NavigationGroup = (typeof navigationGroups)[number];

// The cookie that keeps the desktop sidebar open or on its icon rail ("collapsed"), so the server
// draws it as the viewer left it.
export const SIDEBAR_COOKIE = "sidebar";

// A page of the app shell. Its label is the message nav.<id>. Its permission is a permission key,
// or several of which the viewer holds any; an item without one is open to everyone who reaches
// the shell. The registry below takes only the keys in code; the functions work on any keys, so
// their tests can use their own.
export type NavigationItem<Key extends string = PermissionKey> = {
  id: string;
  href: string;
  icon: LucideIcon;
  permission?: Key | readonly Key[];
  group?: NavigationGroup;
};

// An item as the shell draws it: its label translated and its icon rendered on the server.
export type ShellLink = {
  id: string;
  href: string;
  label: string;
  icon: ReactNode;
  group?: NavigationGroup;
};

// The shell's pages in their default order. A step that adds a page adds its item here.
export const navigation = [
  { id: "today", href: "/today", icon: CalendarCheck },
  {
    id: "departments",
    href: "/departments",
    icon: Building2,
    permission: "departments.manage",
    group: "administration",
  },
  {
    id: "roles",
    href: "/roles",
    icon: UsersRound,
    permission: "roles.manage",
    group: "administration",
  },
  {
    id: "people",
    href: "/people",
    icon: Contact,
    // The people page serves each of these keys; a head holds the last two in their department.
    permission: [
      "people.manage",
      "accounts.resetPassword",
      "accounts.linkEmployeeNumber",
    ],
    group: "administration",
  },
  {
    id: "settings",
    href: "/settings",
    icon: Settings,
    // Every key that edits a setting (src/modules/settings/domain/registry.ts): the vice-dean's
    // counts a term's weeks there.
    permission: ["settings.manage", "term.manage"],
    group: "administration",
  },
  {
    id: "audit",
    href: "/audit",
    icon: History,
    permission: "audit.view",
    group: "administration",
  },
  // The portfolio's axes, the administration's catalog (Step 14).
  {
    id: "axes",
    href: "/axes",
    icon: Layers,
    permission: "axes.manage",
    group: "administration",
  },
  // The vice-dean's terms and their calendars (Step 13). After the administration's pages, so Today
  // still leads an admin setting the college up to its departments, and a vice-dean here.
  {
    id: "terms",
    href: "/terms",
    icon: CalendarRange,
    permission: "term.manage",
  },
  // A head announces to their department, the dean and the vice-dean to the college (ADR-0017).
  // Last, so Today still leads an admin setting the college up to its departments.
  {
    id: "announcements",
    href: "/announcements",
    icon: Megaphone,
    permission: "announcements.publish",
  },
] as const satisfies readonly NavigationItem[];

// The items a viewer may open: those whose permission the viewer holds, in the given order of ids.
// Items the order leaves out follow in the registry's order, and ids it names that are not
// visible are ignored.
export function visibleNavigation<T extends NavigationItem<string>>(
  items: readonly T[],
  permissions: ReadonlySet<string>,
  order: readonly string[] = [],
): T[] {
  const rank = (item: T) => {
    const index = order.indexOf(item.id);
    return index < 0 ? order.length + items.indexOf(item) : index;
  };
  return items
    .filter(
      (item) =>
        item.permission === undefined ||
        [item.permission].flat().some((key) => permissions.has(key)),
    )
    .sort((a, b) => rank(a) - rank(b));
}

// The order the navigation.order setting gives the first of the viewer's roles that has one;
// none when no role has one.
export function orderFor(
  roleKeys: readonly string[],
  orders: Readonly<Record<string, readonly string[]>>,
): readonly string[] {
  const key = roleKeys.find((roleKey) => Object.hasOwn(orders, roleKey));
  return key === undefined ? [] : orders[key];
}

// Five targets fit across a phone. With more pages, the last target opens a sheet that lists the
// rest. A narrower bar, on a small phone or with enlarged text, holds fewer, each still 44 px wide.
const PHONE_TABS = 5;
// A tab's 44 px and the 4 px gap before the next one.
const TAB_SPAN = 48;
// The bar's padding and border (14 px), less the gap the last tab does not have.
const BAR_EDGES = 10;

// How many targets fit in a tab bar this wide; a bar that is not shown (0 px) keeps five.
export function tabSlots(barWidth: number): number {
  if (barWidth <= 0) return PHONE_TABS;
  const fit = Math.floor((barWidth - BAR_EDGES) / TAB_SPAN);
  return Math.max(2, Math.min(PHONE_TABS, fit));
}

export function phoneTabs<T>(
  items: readonly T[],
  slots = PHONE_TABS,
): { tabs: T[]; more: T[] } {
  if (items.length <= slots) return { tabs: [...items], more: [] };
  return { tabs: items.slice(0, slots - 1), more: items.slice(slots - 1) };
}

// Whether a page is the one open, or an ancestor of it.
export function isCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

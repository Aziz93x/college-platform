import {
  Building2,
  CalendarCheck,
  type LucideIcon,
  Settings,
  UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";
import type { PermissionKey } from "@/modules/access";

// A page of the app shell. Its label is the message nav.<id>. Its permission is a permission key;
// an item without one is open to everyone who reaches the shell. The registry below takes only the
// keys in code; the functions work on any keys, so their tests can use their own.
export type NavigationItem<Key extends string = PermissionKey> = {
  id: string;
  href: string;
  icon: LucideIcon;
  permission?: Key;
};

// An item as the shell draws it: its label translated and its icon rendered on the server.
export type ShellLink = {
  id: string;
  href: string;
  label: string;
  icon: ReactNode;
};

// The shell's pages in their default order. A step that adds a page adds its item here.
export const navigation = [
  { id: "today", href: "/today", icon: CalendarCheck },
  {
    id: "departments",
    href: "/departments",
    icon: Building2,
    permission: "departments.manage",
  },
  {
    id: "roles",
    href: "/roles",
    icon: UsersRound,
    permission: "roles.manage",
  },
  {
    id: "settings",
    href: "/settings",
    icon: Settings,
    permission: "settings.manage",
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
        item.permission === undefined || permissions.has(item.permission),
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

// Five targets fit across a phone. With more pages, four tabs stay and the fifth opens a sheet
// that lists the rest.
const PHONE_TABS = 5;

export function phoneTabs<T>(items: readonly T[]): { tabs: T[]; more: T[] } {
  if (items.length <= PHONE_TABS) return { tabs: [...items], more: [] };
  return {
    tabs: items.slice(0, PHONE_TABS - 1),
    more: items.slice(PHONE_TABS - 1),
  };
}

// Whether a page is the one open, or an ancestor of it.
export function isCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

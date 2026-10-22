import { cookies } from "next/headers";
import { connection } from "next/server";
import { getFormatter, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { platformName } from "@/i18n/platform-name";
import { requireViewer } from "@/modules/access";
import {
  latestUnread,
  type NotificationParams,
  unreadAnnouncements,
  unreadCount,
} from "@/modules/notifications";
import { findCollege } from "@/modules/org";
import { getSetting } from "@/modules/settings";
import { Announcements } from "./_shell/announcements.tsx";
import { Bell } from "./_shell/bell.tsx";
import { CommandMenu } from "./_shell/command-menu.tsx";
import { Header } from "./_shell/header.tsx";
import {
  navigation,
  orderFor,
  type ShellLink,
  SIDEBAR_COOKIE,
  visibleNavigation,
} from "./_shell/navigation.ts";
import { Sidebar } from "./_shell/sidebar.tsx";
import { TabBar } from "./_shell/tab-bar.tsx";
import { notificationViews } from "./notifications/view.ts";

// The shell around every page of a signed-in role: the sidebar on desktop, open or on its icon rail
// as the viewer left it, the tab bar on a phone, the header with the viewer's unread notifications
// on its bell, what was announced to them and is not closed yet (ADR-0017), and the command palette. Navigation is data: the pages the viewer's permissions open,
// in the order the navigation.order setting gives the viewer's role. Signed out, or with a password
// to replace or two-factor to set up, the viewer is sent there first.
export default async function AppLayout({ children }: { children: ReactNode }) {
  // The shell reads the session and the database, which next build does not reach.
  await connection();
  const viewer = await requireViewer();
  const college = await findCollege();
  const [orders, name, cookieStore] = await Promise.all([
    college ? getSetting("navigation.order", { collegeId: college.id }) : {},
    platformName(),
    cookies(),
  ]);
  const items = visibleNavigation(
    navigation,
    viewer.permissions,
    orderFor(viewer.roleKeys, orders),
  );
  const t = await getTranslations("shell");
  const nav = await getTranslations("nav");
  const reader = { collegeId: viewer.collegeId, userId: viewer.userId };
  const [unread, latest, announced, notices, announcing, format] =
    await Promise.all([
      unreadCount(reader),
      latestUnread(reader, 3),
      unreadAnnouncements(reader, 10),
      getTranslations("notifications"),
      getTranslations("announcements.dialog"),
      getFormatter(),
    ]);
  const now = new Date();
  const announcements = announced.map(({ id, params, createdAt }) => {
    const said = params as NotificationParams["announcement"];
    return {
      id,
      title: said.title,
      body: said.body,
      from: `${said.author} · ${said.scope === "department" ? said.department : announcing("college")}`,
      ago: format.relativeTime(createdAt, now),
      iso: createdAt.toISOString(),
    };
  });
  const bellItems = (await notificationViews(latest)).map(
    ({ id, title, description, ago, href }) => ({
      id,
      title,
      description,
      ago,
      href,
    }),
  );
  const links: ShellLink[] = items.map((item) => ({
    id: item.id,
    href: item.href,
    label: nav(item.id),
    icon: <item.icon />,
    group: "group" in item ? item.group : undefined,
  }));

  return (
    <CommandMenu
      links={links}
      labels={{
        dialog: t("commandPalette.dialog"),
        placeholder: t("commandPalette.placeholder"),
        list: t("commandPalette.list"),
        empty: t("commandPalette.empty"),
        close: t("commandPalette.close"),
        escape: t("commandPalette.escape"),
        hints: {
          move: t("commandPalette.hints.move"),
          open: t("commandPalette.hints.open"),
          close: t("commandPalette.hints.close"),
        },
        keys: {
          up: t("commandPalette.keys.up"),
          down: t("commandPalette.keys.down"),
          enter: t("commandPalette.keys.enter"),
        },
      }}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:shadow-md"
      >
        {t("skipToContent")}
      </a>
      <div className="flex min-h-dvh">
        <Sidebar
          open={cookieStore.get(SIDEBAR_COOKIE)?.value !== "collapsed"}
          platformName={name}
          collegeName={college?.name}
          links={links}
          groups={{ administration: nav("groups.administration") }}
          labels={{
            navigation: t("navigation"),
            collapse: t("sidebar.collapse"),
            expand: t("sidebar.expand"),
          }}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header
            collegeName={college?.shortName}
            account={{ name: viewer.name, email: viewer.email }}
            bell={
              <Bell
                count={unread}
                countText={format.number(unread)}
                items={bellItems}
                labels={{
                  bell: notices("bell", { count: unread }),
                  panel: notices("panel"),
                  markAllRead: notices("markAllRead"),
                  viewAll: notices("stack.viewAll"),
                  stack: {
                    collapsed: notices("stack.collapsed"),
                    viewAll: notices("stack.viewAll"),
                    empty: notices("stack.empty"),
                    expand: notices("stack.expand", { count: unread }),
                    open: notices("stack.open", { count: unread }),
                  },
                }}
              />
            }
          />
          <main
            id="main"
            tabIndex={-1}
            // Clear of the phone's tab bar, which a viewer with one page does not have.
            className={cn(
              "mx-auto w-full max-w-6xl flex-1 px-4 pt-6 outline-none lg:px-8 lg:pb-12",
              links.length > 1 ? "pb-32" : "pb-12",
            )}
          >
            {children}
          </main>
        </div>
      </div>
      {announcements.length > 0 ? (
        <Announcements
          items={announcements}
          labels={{
            eyebrow: announcing("eyebrow"),
            close: announcing("close"),
          }}
        />
      ) : null}
      <TabBar
        links={links}
        labels={{
          navigation: t("navigation"),
          more: t("more"),
          moreTitle: t("moreTitle"),
          close: t("close"),
        }}
      />
    </CommandMenu>
  );
}

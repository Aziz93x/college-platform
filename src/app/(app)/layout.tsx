import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { MotionProvider } from "@/components/motion/motion-provider";
import { findCollege } from "@/modules/org";
import { getSetting } from "@/modules/settings";
import { CommandMenu } from "./_shell/command-menu.tsx";
import { Header } from "./_shell/header.tsx";
import {
  navigation,
  orderFor,
  type ShellLink,
  visibleNavigation,
} from "./_shell/navigation.ts";
import { Sidebar } from "./_shell/sidebar.tsx";
import { TabBar } from "./_shell/tab-bar.tsx";

// What the shell shows a viewer with no permissions and no roles. Step 6 signs people in and puts
// their permissions and role keys here.
const viewer = { permissions: new Set<string>(), roleKeys: [] as string[] };

// The shell around every page of a signed-in role: the sidebar on desktop, the tab bar on a phone,
// the header and the command palette. Navigation is data: the pages the viewer's permissions open,
// in the order the navigation.order setting gives the viewer's role.
export default async function AppLayout({ children }: { children: ReactNode }) {
  // The shell reads the database, which next build does not reach.
  await connection();
  const college = await findCollege();
  const orders = college
    ? await getSetting("navigation.order", { collegeId: college.id })
    : {};
  const items = visibleNavigation(
    navigation,
    viewer.permissions,
    orderFor(viewer.roleKeys, orders),
  );
  const t = await getTranslations("shell");
  const nav = await getTranslations("nav");
  const links: ShellLink[] = items.map(({ id, href, icon: Icon }) => ({
    id,
    href,
    label: nav(id),
    icon: <Icon />,
  }));

  return (
    <MotionProvider>
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
            collegeName={college?.name}
            links={links}
            label={t("navigation")}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <Header collegeName={college?.shortName} />
            <main
              id="main"
              tabIndex={-1}
              className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-32 outline-none lg:px-8 lg:pb-12"
            >
              {children}
            </main>
          </div>
        </div>
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
    </MotionProvider>
  );
}

"use client";

import { Ellipsis } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Dock, DockItem } from "@/components/motion/dock";
import { cn } from "@/components/ui/cn";
import { isCurrent, phoneTabs, type ShellLink } from "./navigation.ts";

// Loaded only for a viewer with more pages than tabs.
const BottomSheet = dynamic(
  () =>
    import("@/components/motion/bottom-sheet").then((mod) => mod.BottomSheet),
  { ssr: false },
);

const TAB =
  "flex min-h-14 w-16 flex-col items-center justify-center gap-1 rounded-lg px-1 text-xs transition-[color,scale] active:scale-95 sm:w-20";

// The current tab's pill: lighter than the bar, with a short gradient mark under the icon.
const PILL =
  "bg-foreground/15 after:absolute after:inset-x-1/3 after:bottom-1 after:h-0.5 after:rounded-full after:bg-gradient-end";

// The phone's navigation: BeUI's dock as a floating bar of up to five tabs; beyond five, the last
// tab opens BeUI's bottom sheet with the rest.
export function TabBar({
  links,
  labels,
}: {
  links: ShellLink[];
  labels: {
    navigation: string;
    more: string;
    moreTitle: string;
    close: string;
  };
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { tabs, more } = phoneTabs(links);
  const moreCurrent = more.some((link) => isCurrent(pathname, link.href));

  return (
    <nav
      aria-label={labels.navigation}
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex justify-center lg:hidden"
    >
      <Dock className="dark max-w-full items-stretch gap-1 bg-background/95 p-1.5 text-foreground ring-1 ring-foreground/10 inset-shadow-[0_1px_0_color-mix(in_srgb,var(--foreground)_12%,transparent)] backdrop-blur-md">
        {tabs.map((link) => {
          const current = isCurrent(pathname, link.href);
          return (
            <DockItem key={link.id} active={current} pillClassName={PILL}>
              <Link
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  TAB,
                  current ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <span aria-hidden className="[&>svg]:size-5">
                  {link.icon}
                </span>
                <span className="max-w-full truncate">{link.label}</span>
              </Link>
            </DockItem>
          );
        })}
        {more.length > 0 ? (
          <DockItem active={moreCurrent} pillClassName={PILL}>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={open}
              onClick={() => setOpen(true)}
              className={cn(
                TAB,
                moreCurrent ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <Ellipsis aria-hidden className="size-5" />
              <span className="max-w-full truncate">{labels.more}</span>
            </button>
          </DockItem>
        ) : null}
      </Dock>
      {more.length > 0 ? (
        <BottomSheet
          open={open}
          onOpenChange={setOpen}
          snapPoints={["auto"]}
          title={labels.moreTitle}
          closeLabel={labels.close}
        >
          <ul className="grid grid-cols-3 gap-2 pt-2">
            {more.map((link) => {
              const current = isCurrent(pathname, link.href);
              return (
                <li key={link.id}>
                  <Link
                    href={link.href}
                    aria-current={current ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border p-2 text-center text-sm transition-[background-color,scale] active:scale-95",
                      current
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-card hover:bg-muted",
                    )}
                  >
                    <span aria-hidden className="[&>svg]:size-5">
                      {link.icon}
                    </span>
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </BottomSheet>
      ) : null}
    </nav>
  );
}

"use client";

import * as m from "motion/react-m";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SPRING_LAYOUT } from "@/components/motion/lib/ease";
import { SharedLayoutBg } from "@/components/motion/shared-layout-bg";
import { cn } from "@/components/ui/cn";
import { isCurrent, type ShellLink } from "./navigation.ts";

// The desktop sidebar's links. BeUI's shared-layout pill follows the pointer or the keyboard
// across them, the current page's pill glides to the page that opens, and the links rise in one
// after another when the shell first paints.
export function SidebarNav({
  links,
  label,
}: {
  links: ShellLink[];
  label: string;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="relative px-3">
      <SharedLayoutBg
        as="ul"
        inset={0}
        className="gap-1"
        pillClassName="rounded-lg bg-foreground/5"
      >
        {links.map((link, index) => {
          const current = isCurrent(pathname, link.href);
          return (
            <li
              key={link.id}
              className="fade-in slide-in-from-start-2 animate-in fill-mode-both duration-500"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <Link
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "relative isolate flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                  current
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {current ? (
                  <m.span
                    layoutId="sidebar-current"
                    transition={SPRING_LAYOUT}
                    className="absolute inset-0 -z-10 rounded-lg bg-foreground/10 inset-shadow-[0_1px_0_color-mix(in_srgb,var(--foreground)_10%,transparent)] shadow-sm"
                  >
                    <span className="absolute inset-y-3 start-0 w-1 rounded-full bg-gradient-end shadow-[0_0_12px_var(--gradient-end)]" />
                  </m.span>
                ) : null}
                <span aria-hidden className="[&>svg]:size-5">
                  {link.icon}
                </span>
                {link.label}
              </Link>
            </li>
          );
        })}
      </SharedLayoutBg>
    </nav>
  );
}

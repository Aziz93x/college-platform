"use client";

import * as m from "motion/react-m";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId } from "react";
import { useAnimatedSidebar } from "@/components/motion/animated-sidebar";
import { SPRING_LAYOUT } from "@/components/motion/lib/ease";
import { SharedLayoutBg } from "@/components/motion/shared-layout-bg";
import { cn } from "@/components/ui/cn";
import {
  isCurrent,
  type NavigationGroup,
  type ShellLink,
} from "./navigation.ts";

// The desktop sidebar's links, a page in no group first and then each group under its label, in
// the order the viewer's role gives them. BeUI's shared-layout pill follows the pointer or the
// keyboard across a group, the current page's pill glides to the page that opens, and the links
// rise in one after another when the shell first paints. On the icon rail, the labels and the
// groups' names fade, a line stands for each name, and each icon carries its page's name.
export function SidebarNav({
  links,
  groups,
  label,
}: {
  links: ShellLink[];
  groups: Record<NavigationGroup, string>;
  label: string;
}) {
  const pathname = usePathname();
  const { open } = useAnimatedSidebar();
  const id = useId();
  const sections: { group?: NavigationGroup; links: ShellLink[] }[] = [];
  for (const link of links) {
    const section = sections.find((each) => each.group === link.group);
    if (section) section.links.push(link);
    else sections.push({ group: link.group, links: [link] });
  }
  return (
    <nav aria-label={label} className="relative flex flex-col gap-4 px-3">
      {sections.map((section) => (
        <div key={section.group ?? ""}>
          {section.group ? (
            <p
              id={`${id}-${section.group}`}
              className="relative mb-1 flex h-6 items-center px-3 font-medium text-foreground/55 text-xs"
            >
              <span className="whitespace-nowrap transition-opacity duration-200 group-data-[state=collapsed]/sidebar:opacity-0">
                {groups[section.group]}
              </span>
              <span
                aria-hidden
                className="absolute inset-x-3 top-1/2 h-px bg-foreground/20 opacity-0 transition-opacity duration-200 group-data-[state=collapsed]/sidebar:opacity-100"
              />
            </p>
          ) : null}
          <SharedLayoutBg
            as="ul"
            inset={0}
            aria-labelledby={
              section.group ? `${id}-${section.group}` : undefined
            }
            className="gap-1"
            pillClassName="rounded-lg bg-foreground/5"
          >
            {section.links.map((link) => {
              const current = isCurrent(pathname, link.href);
              return (
                <li
                  key={link.id}
                  className="fade-in slide-in-from-start-2 animate-in fill-mode-both duration-500"
                  style={{ animationDelay: `${links.indexOf(link) * 40}ms` }}
                >
                  <Link
                    href={link.href}
                    aria-current={current ? "page" : undefined}
                    title={open ? undefined : link.label}
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
                    <span aria-hidden className="shrink-0 [&>svg]:size-5">
                      {link.icon}
                    </span>
                    <span className="whitespace-nowrap transition-opacity duration-200 group-data-[state=collapsed]/sidebar:opacity-0">
                      {link.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </SharedLayoutBg>
        </div>
      ))}
    </nav>
  );
}

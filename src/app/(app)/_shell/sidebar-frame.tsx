"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import {
  AnimatedSidebar,
  AnimatedSidebarRail,
  AnimatedSidebarTrigger,
} from "@/components/motion/animated-sidebar";
import { SIDEBAR_COOKIE } from "./navigation.ts";

// A year: the sidebar stays as the viewer left it.
const KEEP = 60 * 60 * 24 * 365;

// The desktop sidebar's frame, BeUI's animated sidebar: its full width or its icon rail, from the
// trigger at its top, its inner edge or Ctrl (Cmd) + B, kept in a cookie for the next page.
export function SidebarFrame({
  open,
  labels,
  children,
}: {
  open: boolean;
  labels: { collapse: string; expand: string };
  children: ReactNode;
}) {
  const name = (isOpen: boolean) => (isOpen ? labels.collapse : labels.expand);
  return (
    <AnimatedSidebar
      defaultOpen={open}
      onOpenChange={(next) => {
        // biome-ignore lint/suspicious/noDocumentCookie: one preference, read by the server's layout.
        document.cookie = `${SIDEBAR_COOKIE}=${next ? "expanded" : "collapsed"}; path=/; max-age=${KEEP}; samesite=lax`;
      }}
      style={
        {
          "--sidebar-width": "17rem",
          "--sidebar-width-icon": "4.25rem",
        } as CSSProperties
      }
      className="dark hidden lg:block"
      panelClassName="bg-background text-foreground"
    >
      {children}
      {/* At the top end, beside the names; on the rail, above the gradient's bar. */}
      <AnimatedSidebarTrigger
        label={name}
        className="absolute end-4 top-7 z-10 grid size-9 place-items-center rounded-lg text-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground pointer-coarse:size-11"
      >
        {(isOpen) =>
          isOpen ? (
            <PanelLeftClose aria-hidden className="size-5 rtl:-scale-x-100" />
          ) : (
            <PanelLeftOpen aria-hidden className="size-5 rtl:-scale-x-100" />
          )
        }
      </AnimatedSidebarTrigger>
      <AnimatedSidebarRail label={name} />
    </AnimatedSidebar>
  );
}

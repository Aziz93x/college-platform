"use client";

import { Bell as BellIcon, CheckCheck } from "lucide-react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useId, useRef, useState, useTransition } from "react";
import { ActionSwapText } from "@/components/motion/action-swap";
import { EASE_OUT, SPRING_SWAP } from "@/components/motion/lib/ease";
import { useDismiss } from "@/components/motion/lib/use-dismiss";
import { markReadAction } from "../notifications/actions.ts";

// The stack loads when the bell is first reached for, so no page pays for it before (ADR-0010).
const loadStack = () => import("@/components/motion/notification-stack");
const NotificationStack = dynamic(
  () => loadStack().then((module) => module.NotificationStack),
  { ssr: false },
);

// A notification on the bell's stack: its words and how long ago it came.
export type BellItem = {
  id: string;
  title: string;
  description?: string;
  ago: string;
};

export type BellLabels = {
  bell: string;
  panel: string;
  markAllRead: string;
  viewAll: string;
  stack: {
    collapsed: string;
    viewAll: string;
    empty: string;
    expand: string;
    open: string;
  };
};

// The bell in the header, on every page and on a phone too (ADR-0008): the unread count on it, and
// under it a panel of the newest unread notifications stacked, which leads to the notification
// center. The panel hangs from the header, so it fits a phone's width.
export function Bell({
  count,
  countText,
  items,
  labels,
}: {
  count: number;
  /** The count in the page's digits. */
  countText: string;
  items: BellItem[];
  labels: BellLabels;
}) {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [marking, startMarking] = useTransition();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback(() => {
    setOpen(false);
    // Focus left inside the closing panel goes back to the bell.
    if (panel.current?.contains(document.activeElement))
      button.current?.focus();
  }, []);
  // A press on the bell itself toggles it; anywhere else, or Escape, closes the panel.
  const ignore = useCallback(
    (target: Element) => button.current?.contains(target) ?? false,
    [],
  );
  useDismiss(open, close, panel, { ignore });
  const viewAll = () => {
    setOpen(false);
    router.push("/notifications");
  };
  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={labels.bell}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onPointerEnter={() => void loadStack()}
        onFocus={() => void loadStack()}
        onClick={() => setOpen(!open)}
        className="relative grid size-11 place-items-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-muted aria-expanded:text-foreground lg:size-10"
      >
        <span className="relative">
          <BellIcon aria-hidden className="size-5" />
          <AnimatePresence initial={false}>
            {count > 0 ? (
              <m.span
                key="count"
                aria-hidden
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1, transition: SPRING_SWAP }}
                exit={{
                  scale: 0.4,
                  opacity: 0,
                  transition: { duration: 0.12 },
                }}
                className="absolute -end-2.5 -top-2 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-primary px-1 font-medium text-[0.625rem] text-primary-foreground leading-none ring-2 ring-background"
              >
                <ActionSwapText value={countText}>{countText}</ActionSwapText>
              </m.span>
            ) : null}
          </AnimatePresence>
        </span>
      </button>
      <AnimatePresence>
        {open ? (
          <m.div
            ref={panel}
            id={id}
            role="region"
            aria-labelledby={`${id}-title`}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            className="absolute inset-x-3 top-full z-40 mt-2 origin-top rounded-xl border bg-background p-2 shadow-lg sm:inset-x-auto sm:end-4 sm:w-[22rem] lg:end-8"
          >
            <div className="flex min-h-11 items-center justify-between gap-2 ps-2">
              <h2 id={`${id}-title`} className="font-medium text-sm">
                {labels.panel}
              </h2>
              {count > 0 ? (
                <button
                  type="button"
                  disabled={marking}
                  onClick={() =>
                    // The page is drawn again: the count leaves the bell and the stack says there
                    // is nothing new. No toast: Sonner loads only on the screens that need it
                    // (ADR-0010).
                    startMarking(async () => {
                      await markReadAction({});
                    })
                  }
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-muted-foreground text-xs outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                >
                  <CheckCheck aria-hidden className="size-4" />
                  {labels.markAllRead}
                </button>
              ) : null}
            </div>
            <NotificationStack
              items={items.map((item) => ({
                id: item.id,
                title: item.title,
                description: item.description,
                trailing: item.ago,
              }))}
              count={countText}
              onViewAll={viewAll}
              labels={labels.stack}
              className="mt-1"
            />
            {items.length === 0 ? (
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="mt-2 flex min-h-11 items-center justify-center rounded-lg font-medium text-primary text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              >
                {labels.viewAll}
              </Link>
            ) : null}
          </m.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

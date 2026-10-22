"use client";

import {
  Bell,
  CalendarClock,
  type LucideIcon,
  Megaphone,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type MouseEvent, useId, useTransition } from "react";
import { cn } from "@/components/ui/cn";
import { markReadAction } from "./actions.ts";
import type { NotificationView } from "./view.ts";

const ICONS: Record<string, LucideIcon> = {
  membershipAdded: UserPlus,
  membershipRemoved: UserMinus,
  weeklyDigest: CalendarClock,
  announcement: Megaphone,
};

// A person's notifications newest first, a day at a time. Opening one marks it read, then goes to
// the page it is about.
export function NotificationList({
  notifications,
  unreadLabel,
}: {
  notifications: NotificationView[];
  unreadLabel: string;
}) {
  const id = useId();
  const days: { day: string; notifications: NotificationView[] }[] = [];
  for (const notification of notifications) {
    const last = days.at(-1);
    if (last?.day === notification.day) last.notifications.push(notification);
    else days.push({ day: notification.day, notifications: [notification] });
  }
  return (
    <div className="flex flex-col gap-6">
      {days.map((group, index) => (
        <section key={group.day} aria-labelledby={`${id}-${index}`}>
          <h2
            id={`${id}-${index}`}
            className="mb-2 px-1 font-medium text-muted-foreground text-sm"
          >
            {group.day}
          </h2>
          <ol className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
            {group.notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                unreadLabel={unreadLabel}
              />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function NotificationItem({
  notification,
  unreadLabel,
}: {
  notification: NotificationView;
  unreadLabel: string;
}) {
  const router = useRouter();
  const [opening, startOpening] = useTransition();
  const Icon = ICONS[notification.kind] ?? Bell;

  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    // A new tab or window opens the page as it is; here, the notification is read first.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)
      return;
    event.preventDefault();
    startOpening(async () => {
      if (notification.unread) {
        await markReadAction({ ids: [notification.id] });
      }
      router.push(notification.href);
    });
  };

  return (
    <li>
      <a
        href={notification.href}
        onClick={open}
        aria-busy={opening || undefined}
        className={cn(
          "group/row flex gap-3 px-4 py-3 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:px-5",
          notification.unread && "bg-primary/5",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg",
            notification.unread
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block text-sm",
              notification.unread && "font-medium",
            )}
          >
            {notification.title}
          </span>
          {notification.description ? (
            <span
              className={cn(
                "mt-0.5 block text-xs leading-relaxed transition-colors group-hover/row:text-foreground",
                // The muted grey measures 4.2:1 on an unread row's tint (Audit 4).
                notification.unread
                  ? "text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {notification.description}
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1.5">
          <time
            dateTime={notification.iso}
            className={cn(
              "text-xs tabular-nums transition-colors group-hover/row:text-foreground",
              notification.unread ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {notification.time}
          </time>
          {notification.unread ? (
            <span className="size-2 rounded-full bg-primary">
              <span className="sr-only">{unreadLabel}</span>
            </span>
          ) : null}
        </span>
      </a>
    </li>
  );
}

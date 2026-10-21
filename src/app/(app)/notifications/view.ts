import { getFormatter, getTranslations } from "next-intl/server";
import {
  describeNotification,
  isNotificationKind,
  type NotificationEntry,
  notificationKinds,
  type Words,
} from "@/modules/notifications";

// A notification as a page sends it to the browser: its words in the reader's catalog, the page it
// opens, and when it came, on the college's clock.
export type NotificationView = {
  id: string;
  kind: string;
  title: string;
  description?: string;
  href: string;
  unread: boolean;
  iso: string;
  day: string;
  time: string;
  ago: string;
};

export async function notificationViews(
  entries: readonly NotificationEntry[],
): Promise<NotificationView[]> {
  const [t, format] = await Promise.all([
    getTranslations("notifications"),
    getFormatter(),
  ]);
  type Key = Parameters<typeof t>[0];
  const words: Words = Object.assign(
    (key: string, values?: Record<string, unknown>) =>
      t(key as Key, values as never),
    { has: (key: string) => t.has(key as Key) },
  );
  const list = (items: string[]) => format.list(items, { type: "unit" });
  const now = new Date();
  return entries.map((entry) => ({
    id: entry.id,
    kind: entry.kind,
    ...describeNotification(entry, words, list),
    href: isNotificationKind(entry.kind)
      ? notificationKinds[entry.kind].href
      : "/notifications",
    unread: entry.readAt === null,
    iso: entry.createdAt.toISOString(),
    day: format.dateTime(entry.createdAt, { dateStyle: "full" }),
    time: format.dateTime(entry.createdAt, { timeStyle: "short" }),
    ago: format.relativeTime(entry.createdAt, now),
  }));
}

import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireViewer } from "@/modules/access";
import { listNotifications, unreadCount } from "@/modules/notifications";
import { parseCursor } from "../audit/query.ts";
import { MarkAllRead } from "./mark-all-read.tsx";
import { NotificationList } from "./notification-list.tsx";
import { notificationViews } from "./view.ts";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("notifications");
  return { title: t("title") };
}

// The notification center: everything the platform told the signed-in person, newest first, a page
// at a time, the unread marked. Everyone signed in has one; it shows their own notifications only.
export default async function NotificationsPage({
  searchParams,
}: PageProps<"/notifications">) {
  await connection();
  const viewer = await requireViewer();
  const reader = { collegeId: viewer.collegeId, userId: viewer.userId };
  const after = parseCursor((await searchParams).after);
  const [t, page, unread] = await Promise.all([
    getTranslations("notifications"),
    listNotifications(reader, { after }),
    unreadCount(reader),
  ]);
  const notifications = await notificationViews(page.notifications);

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex flex-wrap gap-2">
            {unread > 0 ? (
              <MarkAllRead label={t("markAllRead")} done={t("markedAllRead")} />
            ) : null}
            <Button asChild variant="outline">
              <Link href="/notifications/preferences">
                <SlidersHorizontal aria-hidden />
                {t("preferences.link")}
              </Link>
            </Button>
          </div>
        }
      />
      {notifications.length > 0 ? (
        <NotificationList
          notifications={notifications}
          unreadLabel={t("unread")}
        />
      ) : (
        <EmptyState
          title={t("empty.title")}
          description={t("empty.description")}
          action={
            after ? (
              <Button asChild variant="outline">
                <Link href="/notifications">{t("newest")}</Link>
              </Button>
            ) : undefined
          }
        />
      )}
      {after || page.next ? (
        <nav
          aria-label={t("pages")}
          className="mt-6 flex flex-wrap items-center justify-between gap-2"
        >
          {after ? (
            <Button asChild variant="outline">
              <Link href="/notifications">
                <ChevronLeft aria-hidden className="rtl:-scale-x-100" />
                {t("newest")}
              </Link>
            </Button>
          ) : (
            <span />
          )}
          {page.next ? (
            <Button asChild variant="outline">
              <Link
                href={`/notifications?${new URLSearchParams({ after: `${page.next.at}|${page.next.id}` })}`}
              >
                {t("older")}
                <ChevronRight aria-hidden className="rtl:-scale-x-100" />
              </Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}

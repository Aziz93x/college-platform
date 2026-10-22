import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getFormatter, getMessages, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { permittedDepartments, requireViewer } from "@/modules/access";
import {
  announcementLengths,
  listAnnouncements,
} from "@/modules/announcements";
import { listDepartments } from "@/modules/org";
import { PublishForm } from "./publish-form.tsx";
import { WithdrawButton } from "./withdraw-button.tsx";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("announcements");
  return { title: t("title") };
}

// Where whoever holds announcements.publish announces, to the departments it is held in or, held
// across the college, to the college and any department (ADR-0017); and what is live there, newest
// first. Its author withdraws their own, and the key across the college anyone's; whoever may
// withdraw one sees how many have read it.
export default async function AnnouncementsPage() {
  await connection();
  const viewer = await requireViewer();
  const scope = permittedDepartments(viewer, "announcements.publish");
  if (scope !== "college" && scope.length === 0) forbidden();

  const [t, format, messages, departments, live] = await Promise.all([
    getTranslations("announcements"),
    getFormatter(),
    getMessages(),
    listDepartments(viewer.collegeId),
    listAnnouncements(viewer.collegeId, scope),
  ]);
  const college = scope === "college";
  const targets = departments
    .filter(({ id, active }) => active && (college || scope.includes(id)))
    .map(({ id, name }) => ({ id, name }));

  return (
    <NextIntlClientProvider
      messages={{
        ui: messages.ui,
        actions: messages.actions,
        announcements: messages.announcements,
      }}
    >
      <PageHeader title={t("title")} description={t("description")} />
      <div className="flex flex-col gap-6">
        {college || targets.length > 0 ? (
          <PublishForm
            college={college}
            departments={targets}
            lengths={announcementLengths}
          />
        ) : null}
        <section aria-labelledby="announcements-live">
          <h2
            id="announcements-live"
            className="mb-2 px-1 font-medium text-muted-foreground text-sm"
          >
            {t("list.title")}
          </h2>
          {live.length > 0 ? (
            <ol className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
              {live.map((announcement) => (
                <li
                  key={announcement.id}
                  className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6"
                >
                  <div className="min-w-0">
                    <h3 className="font-medium">{announcement.title}</h3>
                    <p className="mt-0.5 text-muted-foreground text-xs">
                      {announcement.author}
                      <span aria-hidden> · </span>
                      {announcement.department ?? t("list.college")}
                      <span aria-hidden> · </span>
                      <time dateTime={announcement.createdAt.toISOString()}>
                        {format.dateTime(announcement.createdAt, {
                          dateStyle: "long",
                          timeStyle: "short",
                        })}
                      </time>
                    </p>
                    {/* How many have read it, for whoever may withdraw it (ADR-0017, decision 7). */}
                    {college || announcement.authorId === viewer.userId ? (
                      <p className="mt-1 font-medium text-xs tabular-nums">
                        {t("list.reads", {
                          read: announcement.read,
                          reached: announcement.reached,
                        })}
                      </p>
                    ) : null}
                    <p className="mt-2 whitespace-pre-line text-pretty text-sm leading-relaxed">
                      {announcement.body}
                    </p>
                  </div>
                  {college || announcement.authorId === viewer.userId ? (
                    <div className="shrink-0">
                      <WithdrawButton
                        id={announcement.id}
                        title={announcement.title}
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState
              title={t("list.emptyTitle")}
              description={t("list.emptyDescription")}
            />
          )}
        </section>
      </div>
    </NextIntlClientProvider>
  );
}

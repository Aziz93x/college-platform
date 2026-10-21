import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { requireViewer } from "@/modules/access";
import {
  notificationChoices,
  notificationKindKeys,
} from "@/modules/notifications";
import { PreferenceRow } from "./preference-row.tsx";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("notifications.preferences");
  return { title: t("title") };
}

// The kinds of notification the platform sends, each on or off for the signed-in person, in the
// platform: the one channel until the hosting decision (ADR-0008).
export default async function NotificationPreferencesPage() {
  await connection();
  const viewer = await requireViewer();
  const [t, ui, actions, choices] = await Promise.all([
    getTranslations("notifications"),
    getTranslations("ui"),
    getTranslations("actions"),
    notificationChoices({
      collegeId: viewer.collegeId,
      userId: viewer.userId,
    }),
  ]);
  return (
    <>
      <PageHeader
        title={t("preferences.title")}
        description={t("preferences.description")}
        breadcrumbs={[{ label: t("title"), href: "/notifications" }]}
        breadcrumbsLabel={ui("trail")}
      />
      <section
        aria-labelledby="preferences-kinds"
        className="rounded-xl border bg-card shadow-xs"
      >
        <h2
          id="preferences-kinds"
          className="border-b px-5 py-4 font-medium text-base sm:px-6"
        >
          {t("preferences.kinds")}
        </h2>
        <ul className="divide-y">
          {notificationKindKeys.map((kind) => (
            <PreferenceRow
              key={kind}
              kind={kind}
              enabled={choices[kind]}
              words={{
                label: t(`kinds.${kind}.label`),
                hint: t(`kinds.${kind}.hint`),
                channel: t("preferences.channel"),
                saved: t("preferences.saved", {
                  kind: t(`kinds.${kind}.label`),
                }),
                refused: actions("unexpected"),
              }}
            />
          ))}
        </ul>
      </section>
    </>
  );
}

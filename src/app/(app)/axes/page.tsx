import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { authorize, requireViewer } from "@/modules/access";
import { axisLimits, listAxes } from "@/modules/axes";
import { AxisGroups } from "./axis-groups.tsx";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("axes");
  return { title: t("title") };
}

// The portfolio's axes in their groups, the administration's catalog (Step 14). The admin's page.
export default async function AxesPage() {
  await connection();
  const viewer = await requireViewer();
  if (!authorize(viewer, "axes.manage", { collegeId: viewer.collegeId })) {
    forbidden();
  }
  const [t, messages, groups] = await Promise.all([
    getTranslations("axes"),
    getMessages(),
    listAxes(viewer.collegeId),
  ]);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      {groups.length > 0 ? (
        <NextIntlClientProvider
          messages={{
            ui: messages.ui,
            actions: messages.actions,
            axes: messages.axes,
          }}
        >
          <AxisGroups groups={groups} limits={axisLimits} />
        </NextIntlClientProvider>
      ) : (
        <EmptyState
          title={t("empty.title")}
          description={t("empty.description")}
        />
      )}
    </>
  );
}

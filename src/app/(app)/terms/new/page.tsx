import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTimeZone, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { authorize, requireViewer } from "@/modules/access";
import { getSetting } from "@/modules/settings";
import { termLimits } from "@/modules/terms";
import { wallClock } from "@/platform/i18n/time-zone";
import { TermForm } from "../term-form.tsx";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("terms.form");
  return { title: t("newTitle") };
}

// A new term of the viewer's college, a draft, for whoever manages the college's terms. Its weeks
// start from the college's usual length.
export default async function NewTermPage() {
  await connection();
  const viewer = await requireViewer();
  const scope = { collegeId: viewer.collegeId };
  if (!authorize(viewer, "term.manage", scope)) forbidden();

  const [t, ui, messages, timeZone, weeks] = await Promise.all([
    getTranslations("terms"),
    getTranslations("ui"),
    getMessages(),
    getTimeZone(),
    getSetting("calendar.termWeeks", scope),
  ]);
  return (
    <>
      <PageHeader
        title={t("form.newTitle")}
        description={t("form.newDescription")}
        breadcrumbs={[{ label: t("title"), href: "/terms" }]}
        breadcrumbsLabel={ui("trail")}
      />
      <NextIntlClientProvider
        messages={{
          ui: messages.ui,
          actions: messages.actions,
          dateRange: messages.dateRange,
          terms: { form: messages.terms.form },
        }}
      >
        <TermForm
          defaultWeeks={weeks}
          maxWeeks={termLimits.weeks}
          today={wallClock(new Date(), timeZone).slice(0, 10)}
        />
      </NextIntlClientProvider>
    </>
  );
}

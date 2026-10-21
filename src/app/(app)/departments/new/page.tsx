import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { authorize, requireViewer } from "@/modules/access";
import { DepartmentForm } from "../department-form.tsx";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("departments.form");
  return { title: t("newTitle") };
}

// A new department of the viewer's college, for whoever manages its departments.
export default async function NewDepartmentPage() {
  await connection();
  const viewer = await requireViewer();
  const scope = { collegeId: viewer.collegeId };
  if (!authorize(viewer, "departments.manage", scope)) forbidden();

  const [t, ui, { actions, departments }] = await Promise.all([
    getTranslations("departments"),
    getTranslations("ui"),
    getMessages(),
  ]);
  return (
    <>
      <PageHeader
        title={t("form.newTitle")}
        description={t("form.newDescription")}
        breadcrumbs={[{ label: t("title"), href: "/departments" }]}
        breadcrumbsLabel={ui("trail")}
      />
      <NextIntlClientProvider
        messages={{ actions, departments: { form: departments.form } }}
      >
        <DepartmentForm />
      </NextIntlClientProvider>
    </>
  );
}

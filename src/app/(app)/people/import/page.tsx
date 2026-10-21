import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { authorize, peopleColumns, requireViewer } from "@/modules/access";
import { ImportFlow } from "./import-flow.tsx";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("people");
  return { title: t("import.title") };
}

// People from a file, for whoever manages the people: a preview of what each row would do, which
// writes nothing, then the import and each new account's temporary password, shown once.
export default async function ImportPeoplePage() {
  await connection();
  const viewer = await requireViewer();
  if (!authorize(viewer, "people.manage", { collegeId: viewer.collegeId })) {
    forbidden();
  }
  const [t, ui, { actions, people, reauth }] = await Promise.all([
    getTranslations("people"),
    getTranslations("ui"),
    getMessages(),
  ]);
  return (
    <>
      <PageHeader
        title={t("import.title")}
        description={t("import.description")}
        breadcrumbs={[{ label: t("title"), href: "/people" }]}
        breadcrumbsLabel={ui("trail")}
      />
      <NextIntlClientProvider messages={{ actions, people, reauth }}>
        <ImportFlow
          columns={peopleColumns.map((column) => t(`import.columns.${column}`))}
        />
      </NextIntlClientProvider>
    </>
  );
}

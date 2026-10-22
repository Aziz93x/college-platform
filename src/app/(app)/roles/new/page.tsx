import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { authorize, requireViewer } from "@/modules/access";
import { RoleNameForm } from "../role-name-form.tsx";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("roles");
  return { title: t("new.title") };
}

// A new role of the viewer's college, for whoever manages the roles. It starts with no key and no
// member; its page, which opens next, gives it both.
export default async function NewRolePage() {
  await connection();
  const viewer = await requireViewer();
  if (!authorize(viewer, "roles.manage", { collegeId: viewer.collegeId })) {
    forbidden();
  }
  const [t, ui, { ui: uiWords, actions, roles }] = await Promise.all([
    getTranslations("roles"),
    getTranslations("ui"),
    getMessages(),
  ]);
  return (
    <>
      <PageHeader
        title={t("new.title")}
        description={t("new.description")}
        breadcrumbs={[{ label: t("title"), href: "/roles" }]}
        breadcrumbsLabel={ui("trail")}
      />
      <NextIntlClientProvider
        messages={{
          ui: uiWords,
          actions,
          roles: { name: roles.name, new: roles.new },
        }}
      >
        <RoleNameForm />
      </NextIntlClientProvider>
    </>
  );
}

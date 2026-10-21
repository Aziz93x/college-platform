import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import {
  authorize,
  listRoles,
  requireViewer,
  roleLabel,
} from "@/modules/access";
import { listDepartments } from "@/modules/org";
import { getSetting } from "@/modules/settings";
import { AddPersonForm } from "./add-person-form.tsx";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("people");
  return { title: t("new.title") };
}

// One new person, for whoever manages the people: their account, with a temporary password shown
// once, and a role where they hold it when the viewer manages the roles too. The system role is
// given on the roles page only.
export default async function NewPersonPage() {
  await connection();
  const viewer = await requireViewer();
  const scope = { collegeId: viewer.collegeId };
  if (!authorize(viewer, "people.manage", scope)) forbidden();
  const givesRoles = authorize(viewer, "roles.manage", scope);

  const [t, ui, { actions, people, reauth }, roles, departments, language] =
    await Promise.all([
      getTranslations("people"),
      getTranslations("ui"),
      getMessages(),
      givesRoles ? listRoles(viewer.collegeId) : [],
      listDepartments(viewer.collegeId),
      getSetting("locale.language", scope),
    ]);
  return (
    <>
      <PageHeader
        title={t("new.title")}
        description={t("new.description")}
        breadcrumbs={[{ label: t("title"), href: "/people" }]}
        breadcrumbsLabel={ui("trail")}
      />
      <NextIntlClientProvider messages={{ actions, people, reauth }}>
        <AddPersonForm
          roles={roles
            .filter((role) => !role.system)
            .map((role) => ({
              key: role.key,
              label: roleLabel(role.labels, language),
            }))}
          departments={departments
            .filter((department) => department.active)
            .map(({ name }) => name)}
        />
      </NextIntlClientProvider>
    </>
  );
}

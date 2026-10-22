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
import { employeeNumber } from "@/modules/identity";
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
// given on the roles page only. A trainer Rayat names comes with their number, department and
// role filled in from the address (ADR-0022): only an active department, a role offered here, and a
// number the form accepts.
export default async function NewPersonPage({
  searchParams,
}: PageProps<"/people/new">) {
  await connection();
  const viewer = await requireViewer();
  const scope = { collegeId: viewer.collegeId };
  if (!authorize(viewer, "people.manage", scope)) forbidden();
  const givesRoles = authorize(viewer, "roles.manage", scope);

  const [
    t,
    ui,
    { ui: uiWords, actions, people, reauth },
    roles,
    departments,
    language,
    params,
  ] = await Promise.all([
    getTranslations("people"),
    getTranslations("ui"),
    getMessages(),
    givesRoles ? listRoles(viewer.collegeId) : [],
    listDepartments(viewer.collegeId),
    getSetting("locale.language", scope),
    searchParams,
  ]);
  const offered = roles.filter((role) => !role.system);
  const active = departments.filter((department) => department.active);
  const one = (value: string | string[] | undefined) =>
    typeof value === "string" ? value : "";
  const number = employeeNumber.safeParse(one(params.number));
  const role = offered.find(({ key }) => key === one(params.role));
  const department = active.find(({ id }) => id === one(params.department));
  return (
    <>
      <PageHeader
        title={t("new.title")}
        description={t("new.description")}
        breadcrumbs={[{ label: t("title"), href: "/people" }]}
        breadcrumbsLabel={ui("trail")}
      />
      <NextIntlClientProvider
        messages={{ ui: uiWords, actions, people, reauth }}
      >
        <AddPersonForm
          roles={offered.map((each) => ({
            key: each.key,
            label: roleLabel(each.labels, language),
          }))}
          departments={active.map(({ name }) => name)}
          filled={{
            employeeNumber: number.success ? number.data : undefined,
            role: role?.key,
            department: department?.name,
          }}
        />
      </NextIntlClientProvider>
    </>
  );
}

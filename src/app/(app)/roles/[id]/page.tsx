import type { Metadata } from "next";
import { forbidden, notFound } from "next/navigation";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { cache } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import {
  authorize,
  findRole,
  permissionArea,
  permissionKeys,
  requiresTwoFactor,
  requireViewer,
  roleLabel,
} from "@/modules/access";
import { listPeople } from "@/modules/identity";
import { listDepartments } from "@/modules/org";
import { getSetting } from "@/modules/settings";
import { navigation, visibleNavigation } from "../../_shell/navigation.ts";
import { HistoryPanel } from "../../audit/history-panel.tsx";
import { parseCursor } from "../../audit/query.ts";
import { RoleNameForm } from "../role-name-form.tsx";
import { Members } from "./members.tsx";
import { PageOrder } from "./page-order.tsx";
import { type GridArea, PermissionsForm } from "./permissions-form.tsx";

// The role the address names, when the viewer manages the roles and it is one of the college's: an
// address that is no role's id, or another college's, finds none. Read once for the title and the
// page, with the college's language that names it.
const roleFor = cache(async (id: string) => {
  const viewer = await requireViewer();
  const scope = { collegeId: viewer.collegeId };
  const allowed = authorize(viewer, "roles.manage", scope);
  const role =
    allowed && z.uuid().safeParse(id).success
      ? await findRole(viewer.collegeId, id)
      : undefined;
  const language = await getSetting("locale.language", scope);
  return { viewer, allowed, role, language };
});

export async function generateMetadata({
  params,
}: PageProps<"/roles/[id]">): Promise<Metadata> {
  await connection();
  const { role, language } = await roleFor((await params).id);
  return { title: role ? roleLabel(role.labels, language) : undefined };
}

// The grid's keys by area, in the order the code lists them.
const areas: GridArea[] = [...new Set(permissionKeys.map(permissionArea))].map(
  (area) => ({
    area,
    keys: permissionKeys
      .filter((key) => permissionArea(key) === area)
      .map((key) => ({ key, twoFactor: requiresTwoFactor([key]) })),
  }),
);

// One role: its name, its keys on the grid, who holds it and where, and the order of its pages,
// then its history for whoever may read the log. Each change draws the page again, so the counts,
// the header and the history follow it.
export default async function RolePage({
  params,
  searchParams,
}: PageProps<"/roles/[id]">) {
  await connection();
  const { viewer, allowed, role, language } = await roleFor((await params).id);
  if (!allowed) forbidden();
  if (!role) notFound();

  const scope = { collegeId: viewer.collegeId };
  const [t, ui, nav, messages, departments, people, orders, twoFactor] =
    await Promise.all([
      getTranslations("roles"),
      getTranslations("ui"),
      getTranslations("nav"),
      getMessages(),
      listDepartments(viewer.collegeId),
      listPeople(viewer.collegeId),
      getSetting("navigation.order", scope),
      getSetting("auth.requireTwoFactor", scope),
    ]);
  const label = roleLabel(role.labels, language);
  const pages = visibleNavigation(
    navigation,
    new Set(role.permissions),
    orders[role.key] ?? [],
  ).map((item) => ({ id: item.id, label: nav(item.id) }));

  return (
    <>
      <PageHeader
        title={label}
        description={[
          t("count.members", { count: role.members.length }),
          role.system
            ? t("all")
            : t("count.permissions", { count: role.permissions.length }),
        ].join(" · ")}
        breadcrumbs={[{ label: t("title"), href: "/roles" }]}
        breadcrumbsLabel={ui("trail")}
      />
      <NextIntlClientProvider
        messages={{
          ui: messages.ui,
          actions: messages.actions,
          reauth: messages.reauth,
          roles: messages.roles,
        }}
      >
        <div className="flex flex-col gap-6">
          <RoleNameForm role={{ id: role.id, label }} />
          <PermissionsForm
            role={{
              id: role.id,
              label,
              system: role.system,
              permissions: role.permissions,
            }}
            areas={areas}
            twoFactorRequired={twoFactor}
          />
          <Members
            role={{ id: role.id, system: role.system, members: role.members }}
            people={people}
            departments={departments.map(({ id, name, active }) => ({
              id,
              name,
              active,
            }))}
          />
          {pages.length > 1 ? (
            <PageOrder roleId={role.id} pages={pages} />
          ) : null}
        </div>
      </NextIntlClientProvider>
      <HistoryPanel
        subjects={[
          { entityType: "role", entityId: role.id },
          { membershipsOf: "role", value: role.key },
        ]}
        after={parseCursor((await searchParams).history)}
        href={`/roles/${role.id}`}
      />
    </>
  );
}

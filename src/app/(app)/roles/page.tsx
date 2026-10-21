import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { forbidden } from "next/navigation";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  authorize,
  listRoles,
  requireViewer,
  roleLabel,
} from "@/modules/access";
import { getSetting } from "@/modules/settings";
import { RolesTable } from "./roles-table.tsx";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("roles");
  return { title: t("title") };
}

// The college's roles, each with how many hold it and how many keys it gives, for whoever manages
// the roles. The system role is always first, so the list is never empty.
export default async function RolesPage() {
  await connection();
  const viewer = await requireViewer();
  const scope = { collegeId: viewer.collegeId };
  if (!authorize(viewer, "roles.manage", scope)) forbidden();

  const [t, { actions, roles: words }, roles, language] = await Promise.all([
    getTranslations("roles"),
    getMessages(),
    listRoles(viewer.collegeId),
    getSetting("locale.language", scope),
  ]);
  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button asChild>
            <Link href="/roles/new">
              <Plus aria-hidden />
              {t("add")}
            </Link>
          </Button>
        }
      />
      <NextIntlClientProvider messages={{ actions, roles: words }}>
        <RolesTable
          roles={roles.map((role) => ({
            id: role.id,
            label: roleLabel(role.labels, language),
            system: role.system,
            members: role.members,
            permissions: role.permissions.length,
          }))}
        />
      </NextIntlClientProvider>
    </>
  );
}

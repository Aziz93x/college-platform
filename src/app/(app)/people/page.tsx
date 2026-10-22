import { Plus, Upload } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { forbidden } from "next/navigation";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { listDirectory, requireViewer } from "@/modules/access";
import { listDepartments } from "@/modules/org";
import { getSetting } from "@/modules/settings";
import { PeopleList } from "./people-list.tsx";
import { peopleScope } from "./scope.ts";
import { personView } from "./view.ts";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("people");
  return { title: t("title") };
}

// The college's people for whoever manages them; the people of their own departments for a helper
// who holds a key there, such as a head. Someone who holds none of the keys gets the refusal.
export default async function PeoplePage() {
  await connection();
  const viewer = await requireViewer();
  const scope = { collegeId: viewer.collegeId };
  const reach = peopleScope(viewer);
  if (!reach) forbidden();
  const { manages } = reach;

  const [
    t,
    { ui, actions, people: words, reauth },
    directory,
    collegeDepartments,
    language,
  ] = await Promise.all([
    getTranslations("people"),
    getMessages(),
    listDirectory(viewer.collegeId, reach.only),
    listDepartments(viewer.collegeId),
    getSetting("locale.language", scope),
  ]);
  const departmentName = (id: string) =>
    collegeDepartments.find((department) => department.id === id)?.name;
  const people = directory.map((person) =>
    personView(person, viewer, { manages, language, departmentName }),
  );
  const add = (label: string) => (
    <Button asChild>
      <Link href="/people/new">
        <Plus aria-hidden />
        {label}
      </Link>
    </Button>
  );
  return (
    <>
      <PageHeader
        title={t("title")}
        description={manages ? t("description") : t("helperDescription")}
        actions={
          manages && people.length > 0 ? (
            <>
              <Button asChild variant="outline">
                <Link href="/people/import">
                  <Upload aria-hidden />
                  {t("importAction")}
                </Link>
              </Button>
              {add(t("add"))}
            </>
          ) : null
        }
      />
      <NextIntlClientProvider messages={{ ui, actions, people: words, reauth }}>
        {people.length > 0 ? (
          <PeopleList people={people} />
        ) : (
          <EmptyState
            title={t("empty.title")}
            description={t("empty.description")}
            action={manages ? add(t("empty.action")) : undefined}
          />
        )}
      </NextIntlClientProvider>
    </>
  );
}

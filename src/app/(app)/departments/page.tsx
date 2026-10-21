import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { forbidden } from "next/navigation";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { authorize, requireViewer } from "@/modules/access";
import { findCollege, listDepartments } from "@/modules/org";
import { CollegeForm } from "./college-form.tsx";
import { DepartmentsTable } from "./departments-table.tsx";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("departments");
  return { title: t("title") };
}

// The college's departments, and the college's own names. Each part shows to whoever holds its
// permission; someone who holds neither gets the page's refusal.
export default async function DepartmentsPage() {
  await connection();
  const viewer = await requireViewer();
  const scope = { collegeId: viewer.collegeId };
  const manageDepartments = authorize(viewer, "departments.manage", scope);
  const manageCollege = authorize(viewer, "college.manage", scope);
  if (!manageDepartments && !manageCollege) forbidden();

  const [t, { actions, departments: words }, departments, college] =
    await Promise.all([
      getTranslations("departments"),
      getMessages(),
      manageDepartments ? listDepartments(viewer.collegeId) : [],
      manageCollege ? findCollege() : undefined,
    ]);
  const add = (label: string) => (
    <Button asChild>
      <Link href="/departments/new">
        <Plus aria-hidden />
        {label}
      </Link>
    </Button>
  );
  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          manageDepartments && departments.length > 0 ? add(t("add")) : null
        }
      />
      <NextIntlClientProvider messages={{ actions, departments: words }}>
        <div className="flex flex-col gap-6">
          {manageDepartments ? (
            departments.length > 0 ? (
              <DepartmentsTable departments={departments} />
            ) : (
              <EmptyState
                title={t("empty.title")}
                description={t("empty.description")}
                action={add(t("empty.action"))}
              />
            )
          ) : null}
          {college ? (
            <CollegeForm
              college={{ name: college.name, shortName: college.shortName }}
            />
          ) : null}
        </div>
      </NextIntlClientProvider>
    </>
  );
}

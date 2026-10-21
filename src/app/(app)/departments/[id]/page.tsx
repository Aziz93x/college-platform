import type { Metadata } from "next";
import { forbidden, notFound } from "next/navigation";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { cache } from "react";
import { z } from "zod";
import { AnimatedBadge } from "@/components/motion/animated-badge";
import { PageHeader } from "@/components/page-header";
import { authorize, requireViewer } from "@/modules/access";
import { findDepartment } from "@/modules/org";
import { HistoryPanel } from "../../audit/history-panel.tsx";
import { parseCursor } from "../../audit/query.ts";
import { DepartmentForm } from "../department-form.tsx";

// The department the address names, when the viewer manages the college's departments and it is
// one of them: an address that is no department's id, or another college's, finds none. Read once
// for the title and the page.
const departmentFor = cache(async (id: string) => {
  const viewer = await requireViewer();
  const allowed = authorize(viewer, "departments.manage", {
    collegeId: viewer.collegeId,
  });
  const department =
    allowed && z.uuid().safeParse(id).success
      ? await findDepartment(viewer.collegeId, id)
      : undefined;
  return { allowed, department };
});

export async function generateMetadata({
  params,
}: PageProps<"/departments/[id]">): Promise<Metadata> {
  await connection();
  const { department } = await departmentFor((await params).id);
  return { title: department?.name };
}

// One department: its names and Rayat values to change, and whether it is in use, shown beside its
// name; then its history, with the roles held in it, for whoever may read the log. A save draws the
// page again, so the trail, the title, the state and the history follow it.
export default async function DepartmentPage({
  params,
  searchParams,
}: PageProps<"/departments/[id]">) {
  await connection();
  const { allowed, department } = await departmentFor((await params).id);
  if (!allowed) forbidden();
  if (!department) notFound();

  const [t, ui, { actions, departments }] = await Promise.all([
    getTranslations("departments"),
    getTranslations("ui"),
    getMessages(),
  ]);
  return (
    <>
      <PageHeader
        title={department.name}
        description={t("form.editDescription")}
        breadcrumbs={[{ label: t("title"), href: "/departments" }]}
        breadcrumbsLabel={ui("trail")}
        status={
          <AnimatedBadge status={department.active ? "success" : "neutral"}>
            {department.active ? t("status.active") : t("status.inactive")}
          </AnimatedBadge>
        }
      />
      <NextIntlClientProvider
        messages={{ actions, departments: { form: departments.form } }}
      >
        <DepartmentForm department={department} />
      </NextIntlClientProvider>
      <HistoryPanel
        subjects={[
          { entityType: "department", entityId: department.id },
          { membershipsOf: "departmentId", value: department.id },
        ]}
        after={parseCursor((await searchParams).history)}
        href={`/departments/${department.id}`}
      />
    </>
  );
}

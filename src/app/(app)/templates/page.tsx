import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getFormatter, getMessages, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import {
  authorize,
  permittedDepartments,
  requireViewer,
} from "@/modules/access";
import { listAxes } from "@/modules/axes";
import {
  frameworkLimits,
  reachesTrainers,
  termFramework,
} from "@/modules/framework";
import { listDepartments } from "@/modules/org";
import { listTemplates } from "@/modules/planning";
import { getSetting } from "@/modules/settings";
import { ItemWords } from "../_items/item-words.tsx";
import { itemVocabulary } from "../_items/vocabulary.ts";
import { DepartmentSelect } from "../_shell/department-select.tsx";
import { viewedTerm } from "../_shell/term.ts";
import { TemplatesEditor } from "./templates-editor.tsx";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("templates");
  return { title: t("title") };
}

// The section templates of the term on view (Step 18), one department at a time: the framework's
// items for each section's trainer, the college's, and the department's own, which whoever holds
// plan.edit there adds and corrects. A closed term's are shown, and nothing changes them.
export default async function TemplatesPage({
  searchParams,
}: PageProps<"/templates">) {
  await connection();
  const viewer = await requireViewer();
  const edits = permittedDepartments(viewer, "plan.edit");
  if (edits !== "college" && edits.length === 0) forbidden();
  const scope = { collegeId: viewer.collegeId };
  const [t, { term }, params] = await Promise.all([
    getTranslations("templates"),
    viewedTerm(viewer.collegeId, authorize(viewer, "term.manage", scope)),
    searchParams,
  ]);
  const header = (
    <PageHeader title={t("title")} description={t("description")} />
  );
  if (!term) {
    return (
      <>
        {header}
        <EmptyState
          title={t("noTerm.title")}
          description={t("noTerm.description")}
        />
      </>
    );
  }

  const [
    messages,
    format,
    framework,
    calendarWords,
    departments,
    groups,
    accepted,
  ] = await Promise.all([
    getMessages(),
    getFormatter(),
    getTranslations("framework"),
    getTranslations("terms.kinds"),
    listDepartments(viewer.collegeId),
    listAxes(viewer.collegeId),
    getSetting("files.acceptedTypes", scope),
  ]);
  // The departments the viewer prepares, in the college's order; the one chosen, or the first.
  const prepared = departments.filter(
    ({ id, active }) => active && (edits === "college" || edits.includes(id)),
  );
  const department =
    prepared.find(({ id }) => id === params.department?.toString()) ??
    prepared[0];
  if (!department) {
    return (
      <>
        {header}
        <EmptyState
          title={t("noDepartment.title")}
          description={t("noDepartment.description")}
        />
      </>
    );
  }

  const [templates, { published }] = await Promise.all([
    listTemplates(viewer.collegeId, term.id, department.id),
    termFramework(viewer.collegeId, term.id),
  ]);
  const { view, options } = itemVocabulary({
    t: framework,
    calendarWords,
    format,
    axes: groups.flatMap((group) => group.axes),
    accepted,
  });
  const fromFramework = (published?.items ?? []).filter((item) =>
    reachesTrainers(item.appliesTo),
  );

  return (
    <>
      {header}
      <div className="flex flex-col gap-6">
        {prepared.length > 1 ? (
          <DepartmentSelect
            label={t("department")}
            path="/templates"
            departments={prepared}
            department={department.id}
          />
        ) : null}
        <section
          aria-labelledby="templates-college"
          className="rounded-xl border bg-card shadow-xs"
        >
          <div className="px-5 pt-5 sm:px-6">
            <h2 id="templates-college" className="font-medium text-base">
              {t("college.title")}
            </h2>
            <p className="mt-1 max-w-prose text-pretty text-muted-foreground text-sm">
              {published
                ? fromFramework.length > 0
                  ? t("college.description")
                  : t("college.none")
                : t("college.notPublished")}
            </p>
          </div>
          {fromFramework.length > 0 ? (
            <ol
              aria-labelledby="templates-college"
              className="mt-4 divide-y border-t"
            >
              {fromFramework.map((item) => (
                <li key={item.id} className="px-5 py-3 sm:px-6">
                  <ItemWords item={view(item)} />
                </li>
              ))}
            </ol>
          ) : (
            <div className="pb-5" />
          )}
        </section>
        <NextIntlClientProvider
          messages={{
            ui: messages.ui,
            actions: messages.actions,
            framework: messages.framework,
            templates: messages.templates,
          }}
        >
          <TemplatesEditor
            termId={term.id}
            departmentId={department.id}
            templates={templates.map(view)}
            editable={term.status !== "closed"}
            options={options}
            limits={frameworkLimits}
          />
        </NextIntlClientProvider>
      </div>
    </>
  );
}

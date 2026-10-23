import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import {
  getFormatter,
  getLocale,
  getMessages,
  getTranslations,
} from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import {
  listDirectory,
  listRoles,
  permittedDepartments,
  requireViewer,
  roleHolders,
  roleLabel,
} from "@/modules/access";
import {
  departmentTemplates,
  dueWeekOf,
  termAssignments,
} from "@/modules/assignments";
import { listAxes } from "@/modules/axes";
import { frameworkLimits } from "@/modules/framework";
import { listDepartments } from "@/modules/org";
import { getSetting } from "@/modules/settings";
import { itemVocabulary } from "../_items/vocabulary.ts";
import { DepartmentSelect } from "../_shell/department-select.tsx";
import { preparesTerms, viewedTerm } from "../_shell/term.ts";
import { AssignmentsBoard, type Template } from "./assignments-board.tsx";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("assignments");
  return { title: t("title") };
}

// A department's assignments for the term on view (Step 21), one department at a time: each template
// it assigns, those every department shares and then its own, with the people it is given to this
// term and its items. Whoever holds assignment.manage there assigns and revokes, and keeps the
// department's own templates. A closed term's assignments are shown, and nothing changes them.
export default async function AssignmentsPage({
  searchParams,
}: PageProps<"/assignments">) {
  await connection();
  const viewer = await requireViewer();
  const manages = permittedDepartments(viewer, "assignment.manage");
  if (manages !== "college" && manages.length === 0) forbidden();
  const [t, { term }, params] = await Promise.all([
    getTranslations("assignments"),
    viewedTerm(viewer.collegeId, preparesTerms(viewer)),
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

  const [messages, locale, format, framework, departments] = await Promise.all([
    getMessages(),
    getLocale(),
    getFormatter(),
    getTranslations("framework"),
    listDepartments(viewer.collegeId),
  ]);
  // The departments the viewer assigns in, in the college's order; the one chosen, or the first.
  const managed = departments.filter(
    ({ id, active }) =>
      active && (manages === "college" || manages.includes(id)),
  );
  const department =
    managed.find(({ id }) => id === params.department?.toString()) ??
    managed[0];
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

  const [templates, assigned, holders, directory, groups, roles, accepted] =
    await Promise.all([
      departmentTemplates(viewer.collegeId, department.id),
      termAssignments(viewer.collegeId, term.id, department.id),
      roleHolders(viewer.collegeId, term.id),
      listDirectory(viewer.collegeId, { departments: [department.id] }),
      listAxes(viewer.collegeId),
      listRoles(viewer.collegeId),
      getSetting("files.acceptedTypes", { collegeId: viewer.collegeId }),
    ]);
  // Whom the department assigns: those who hold a role in it in the term on view, as the generation
  // engine reaches them.
  const members = new Set(
    holders
      .filter(({ departmentId }) => departmentId === department.id)
      .map(({ userId }) => userId),
  );
  const axes = groups.flatMap((group) => group.axes);
  const { words, options } = itemVocabulary({
    t: framework,
    periodTypes: [],
    format,
    axes,
    accepted,
  });
  const language = locale.split("-")[0];
  const roleOf = new Map(
    roles.map((role) => [role.id, roleLabel(role.labels, language)]),
  );

  const shown: Template[] = templates.map((template) => ({
    id: template.id,
    title: template.title,
    shared: template.departmentId === null,
    axisId: template.axisId,
    axis: words.axis(template.axisId) ?? "",
    grants: template.grantsRoleId
      ? roleOf.get(template.grantsRoleId)
      : undefined,
    assigned: template.assigned,
    items: template.items.map((item) => ({
      id: item.id,
      title: item.title,
      kind: item.kind,
      evidence: item.evidence,
      words: {
        kind: words.kind(item.kind) ?? item.kind,
        evidence: words.evidence(item.evidence),
      },
    })),
    holders: assigned
      .filter(({ templateId }) => templateId === template.id)
      .map((each) => ({
        id: each.id,
        name: each.name,
        employeeNumber: each.employeeNumber,
        range:
          each.fromWeek === null || each.toWeek === null
            ? t("wholeTerm")
            : t("range", { from: each.fromWeek, to: each.toWeek }),
        due: t("due", { week: dueWeekOf(each.toWeek, term.weeks) }),
        userId: each.userId,
        granted: each.granted,
      })),
  }));

  return (
    <>
      {header}
      <div className="flex flex-col gap-6">
        {managed.length > 1 ? (
          <DepartmentSelect
            label={t("department")}
            path="/assignments"
            departments={managed}
            department={department.id}
          />
        ) : null}
        <NextIntlClientProvider
          messages={{
            ui: messages.ui,
            actions: messages.actions,
            framework: messages.framework,
            assignments: messages.assignments,
          }}
        >
          <AssignmentsBoard
            key={department.id}
            termId={term.id}
            departmentId={department.id}
            weeks={term.weeks}
            editable={term.status !== "closed"}
            templates={shown}
            people={directory
              .filter(({ userId }) => members.has(userId))
              .map(({ userId, name, employeeNumber }) => ({
                userId,
                name,
                employeeNumber,
              }))}
            axes={options.axes}
            itemOptions={options}
            limits={frameworkLimits}
          />
        </NextIntlClientProvider>
      </div>
    </>
  );
}

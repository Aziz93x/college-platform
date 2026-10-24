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
import { sectionCounts } from "@/modules/academics";
import {
  listDirectory,
  listRoles,
  requireViewer,
  roleHolders,
  roleLabel,
} from "@/modules/access";
import { listAxes } from "@/modules/axes";
import {
  busiestWeek,
  countTasks,
  departmentsReached,
  dueWeeks,
  frameworkLimits,
  type PlanItemInput,
  reachesTrainers,
  termFramework,
  weeksOutside,
} from "@/modules/framework";
import { listDepartments } from "@/modules/org";
import { departmentPlan } from "@/modules/planning";
import { getSetting } from "@/modules/settings";
import { listExamPeriodTypes } from "@/modules/terms";
import { itemVocabulary } from "../_items/vocabulary.ts";
import { DepartmentSelect } from "../_shell/department-select.tsx";
import { termCalendar, viewedTerm } from "../_shell/term.ts";
import { planAccess } from "./access.ts";
import { PlanEditor, type PlanItem } from "./plan-editor.tsx";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("plan");
  return { title: t("title") };
}

// A department's plan for the term on view (Step 19), one department at a time: its draft, which
// whoever holds plan.edit there fills, its published version, which never changes, and the
// framework's items for the department beside them, locked. Whoever holds plan.publish there
// publishes the draft, reading it without plan.edit (ADR-0027; Audit 7), and whoever holds plan.view
// there reads it all and changes nothing (lead review D, proposal 3). A closed term's plan is shown,
// and nothing changes it.
export default async function PlanPage({ searchParams }: PageProps<"/plan">) {
  await connection();
  const viewer = await requireViewer();
  const access = planAccess(viewer);
  if (!access.any) forbidden();
  const scope = { collegeId: viewer.collegeId };
  // A head prepares the next term's plan while it is still a draft (Step 19).
  const [t, { terms, term }, params] = await Promise.all([
    getTranslations("plan"),
    viewedTerm(viewer.collegeId, true),
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
    locale,
    format,
    framework,
    periodTypes,
    departments,
    groups,
    roles,
    accepted,
    calendar,
  ] = await Promise.all([
    getMessages(),
    getLocale(),
    getFormatter(),
    getTranslations("framework"),
    listExamPeriodTypes(viewer.collegeId),
    listDepartments(viewer.collegeId),
    listAxes(viewer.collegeId),
    listRoles(viewer.collegeId),
    getSetting("files.acceptedTypes", scope),
    termCalendar(viewer.collegeId, term.id),
  ]);
  // The departments whose plan the viewer edits, publishes or reads, in the college's order; the
  // one chosen, or the first.
  const planned = departments.filter(
    ({ id, active }) => active && access.opens(id),
  );
  const department =
    planned.find(({ id }) => id === params.department?.toString()) ??
    planned[0];
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

  // The term before this one, whose plan for the department a first version may start from.
  const previous = terms.find((each) => each.startsOn < term.startsOn);
  const [plan, { published: general }, holders, sections, directory, before] =
    await Promise.all([
      departmentPlan(viewer.collegeId, term.id, department.id),
      termFramework(viewer.collegeId, term.id),
      roleHolders(viewer.collegeId, term.id),
      sectionCounts(viewer.collegeId, term.id),
      listDirectory(viewer.collegeId, { departments: [department.id] }),
      previous
        ? departmentPlan(viewer.collegeId, previous.id, department.id)
        : undefined,
    ]);

  // Whom the department's items reach, as the generation engine reaches them, and the people a
  // plan's item may name: those who hold a role in it in the term on view.
  const reach = departmentsReached(holders, sections).filter(
    ({ departmentId }) => departmentId === department.id,
  );
  const members = new Set(reach.flatMap(({ people }) => [...people]));
  const language = locale.split("-")[0];
  const periods = calendar?.term.periods ?? [];
  const { view, options } = itemVocabulary({
    t: framework,
    periodTypes,
    periods,
    format,
    axes: groups.flatMap((group) => group.axes),
    roles: new Map(
      roles
        .filter((role) => !role.system)
        .map((role) => [role.id, roleLabel(role.labels, language)]),
    ),
    people: new Map(
      directory
        .filter(({ userId }) => members.has(userId))
        .map(({ userId, name, employeeNumber }) => [
          userId,
          { name, employeeNumber },
        ]),
    ),
    accepted,
  });

  // Each item with the weeks it lands in, how many of its times fall outside the term, and the
  // tasks it makes in the department, all as the engine counts them (the owner's notes, 21 October
  // 2026): the editor flags an item that falls outside the term or reaches no one.
  const shape = { weeks: term.weeks, periods };
  const placed = (item: PlanItemInput & { id: string }): PlanItem => ({
    ...view(item),
    weeks: dueWeeks(item.due, shape),
    outside: weeksOutside(item.due, shape),
    tasks: countTasks([item], reach, shape).tasks,
  });
  const tasksOf = (items: readonly PlanItemInput[]) =>
    countTasks(items, reach, shape).tasks;
  const approvals = (items: readonly PlanItemInput[]) =>
    tasksOf(items.filter(({ evidence }) => evidence.requiresApproval));

  const { draft, published, versions } = plan;
  const open = term.status !== "closed";
  const publishes = access.publishes(department.id);
  const date = (at: Date | null) =>
    at ? format.dateTime(at, { dateStyle: "long" }) : "";
  // The draft's preview: the tasks it makes in the department, and the reviews a week that it and
  // the framework's items for the department ask of the head, over the term's weeks, and the week
  // that asks the most beside the average (Audit 7, enhancement 2).
  const preview = draft && {
    impact: t("impact", { tasks: tasksOf(draft.items) }),
    reviews: (() => {
      const own = approvals(draft.items);
      const college = approvals(general?.items ?? []);
      const perWeek = Math.round((own + college) / Math.max(term.weeks, 1));
      const load = t("reviewLoad", {
        perWeek,
        total: own + college,
        framework: college,
        weeks: term.weeks,
      });
      const peak = busiestWeek(
        [...draft.items, ...(general?.items ?? [])].filter(
          ({ evidence }) => evidence.requiresApproval,
        ),
        reach,
        shape,
      );
      return peak && peak.tasks > perWeek
        ? `${load} ${t("reviewPeak", { week: peak.week, tasks: peak.tasks })}`
        : load;
    })(),
  };
  const offered =
    previous && before && (before.published ?? before.draft)
      ? {
          termId: previous.id,
          words: t("copyPrevious", {
            term: previous.name,
            count: (before.published ?? before.draft)?.items.length ?? 0,
          }),
        }
      : undefined;

  return (
    <>
      {header}
      <div className="flex flex-col gap-6">
        {planned.length > 1 ? (
          <DepartmentSelect
            label={t("department")}
            path="/plan"
            departments={planned}
            department={department.id}
          />
        ) : null}
        <NextIntlClientProvider
          messages={{
            ui: messages.ui,
            actions: messages.actions,
            framework: messages.framework,
            plan: messages.plan,
          }}
        >
          <PlanEditor
            key={department.id}
            termId={term.id}
            departmentId={department.id}
            weeks={term.weeks}
            periods={periods.flatMap((period) => {
              const type = periodTypes.find(({ code }) => code === period.type);
              return type ? [{ ...period, name: type.shortName }] : [];
            })}
            draft={
              draft && {
                id: draft.id,
                version: draft.version,
                items: draft.items.map(placed),
              }
            }
            published={
              published && {
                version: published.version,
                date: date(published.publishedAt),
                items: published.items.map(placed),
              }
            }
            framework={(general?.items ?? []).map(placed)}
            frameworkPublished={Boolean(general)}
            versions={versions.map((each) => ({
              version: each.version,
              words:
                each.status === "draft"
                  ? t("versions.draft", {
                      version: each.version,
                      items: each.items,
                    })
                  : t("versions.published", {
                      version: each.version,
                      items: each.items,
                      date: date(each.publishedAt),
                    }),
            }))}
            editable={open}
            edits={access.edits(department.id)}
            publishes={publishes}
            previous={versions.length === 0 ? offered : undefined}
            preview={preview}
            untaught={
              (reach[0]?.sectionTrainers ?? 0) === 0 &&
              (draft?.items ?? []).some(({ appliesTo }) =>
                reachesTrainers(appliesTo),
              )
            }
            options={options}
            limits={frameworkLimits}
          />
        </NextIntlClientProvider>
      </div>
    </>
  );
}
